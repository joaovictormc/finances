import { z } from "zod";
import { db, Prisma } from "@finances/db";
import { ChangelogItemSchema, type ChangelogItem, type ChangelogPlatform } from "@finances/validations";
import { chat } from "./ai/chat";
import { getAiSettings, isWithinUsageLimit, logAiUsage, slotModel } from "./ai/ai-settings";
import { notifyAdmins } from "./admin-alerts";
import { summarizeItems } from "./changelog";

/**
 * Rascunhos de Novidades a partir dos commits da branch do ambiente: produção
 * acompanha a main, homologação a develop (CHANGELOG_BRANCH). O texto sai em
 * linguagem de usuário pela IA configurada em /admin/ai; quem publica é o
 * admin, depois de revisar.
 */

const SINGLETON_ID = "singleton";
const GITHUB_API = "https://api.github.com";

export function automationConfig() {
  return {
    repo: process.env.CHANGELOG_REPO?.trim() || "joaovictormc/finances",
    branch: process.env.CHANGELOG_BRANCH?.trim() || "main",
  };
}

// ── Commits ──────────────────────────────────────────────────────────────────

export type RawCommit = { sha: string; message: string; parents: number };
export type RelevantCommit = { sha: string; type: string; scope: string | null; subject: string; body: string };

/** Só o que muda algo para quem usa o app. */
const USER_FACING_TYPES = new Set(["feat", "fix", "perf"]);
/** Escopos que não chegam a quem usa o app (site de anúncio, infraestrutura). */
const IGNORED_SCOPES = new Set(["landing", "deploy", "docs", "ci"]);

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

/** Conventional commits relevantes; merges e o resto ficam de fora. */
export function relevantCommits(commits: RawCommit[]): RelevantCommit[] {
  const result: RelevantCommit[] = [];
  for (const commit of commits) {
    if (commit.parents > 1) continue;
    const [header = "", ...rest] = commit.message.split("\n");
    const match = CONVENTIONAL.exec(header.trim());
    if (!match) continue;
    const [, type = "", scope, subject = ""] = match;
    if (!USER_FACING_TYPES.has(type.toLowerCase())) continue;
    if (scope && IGNORED_SCOPES.has(scope.toLowerCase())) continue;
    const body = rest
      .filter((line) => !/^co-authored-by:/i.test(line.trim()))
      .join("\n")
      .trim();
    result.push({ sha: commit.sha, type: type.toLowerCase(), scope: scope?.toLowerCase() ?? null, subject: subject.trim(), body });
  }
  return result;
}

/**
 * Plataformas pelos escopos: só mobile → Android e iPhone; só web → Web;
 * qualquer outro (API, sem escopo) vale para todas → lista vazia.
 */
export function platformsFor(commits: RelevantCommit[]): ChangelogPlatform[] {
  const platforms = new Set<ChangelogPlatform>();
  for (const commit of commits) {
    if (commit.scope === "mobile") {
      platforms.add("android");
      platforms.add("ios");
    } else if (commit.scope === "web") {
      platforms.add("web");
    } else {
      return [];
    }
  }
  return platforms.size === 3 ? [] : [...platforms];
}

/** Próxima versão: novidade sobe a menor, o resto só a de correção. */
export function nextVersion(previous: string | null, items: ChangelogItem[]): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(previous?.trim() ?? "");
  if (!match) return previous ? "" : "1.0.0";
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  return items.some((item) => item.kind === "new") ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

class GithubError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function github<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "controlai-changelog",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new GithubError(res.status, `GitHub respondeu ${res.status} em ${path}`);
  return (await res.json()) as T;
}

async function branchHead(repo: string, branch: string): Promise<string> {
  const data = await github<{ commit: { sha: string } }>(`/repos/${repo}/branches/${encodeURIComponent(branch)}`);
  return data.commit.sha;
}

async function commitsBetween(repo: string, base: string, head: string): Promise<RawCommit[]> {
  const data = await github<{ commits: Array<{ sha: string; commit: { message: string }; parents: unknown[] }> }>(
    `/repos/${repo}/compare/${base}...${head}`
  );
  return data.commits.map((c) => ({ sha: c.sha, message: c.commit.message, parents: c.parents.length }));
}

// ── Rascunho ─────────────────────────────────────────────────────────────────

const AiDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  items: z.array(ChangelogItemSchema).max(30),
});
type Draft = z.infer<typeof AiDraftSchema>;

const SYSTEM_PROMPT = `Você escreve as notas de atualização do ControlAI, um app de finanças pessoais e da família, para quem usa o app (não para programadores).

Recebe commits do código e devolve um objeto JSON:
{"title": "frase curta com a principal mudança", "items": [{"kind": "new" | "improvement" | "fix", "text": "..."}]}

Regras:
- Português do Brasil, frases curtas e concretas, dizendo o que a pessoa nota no app. Sem termos técnicos (nada de API, componente, hook, migration, endpoint, banco).
- "new" = algo que não existia; "improvement" = algo que ficou melhor; "fix" = algo que estava errado e foi corrigido.
- Junte commits que falam da mesma coisa num item só.
- Deixe de fora o que não muda nada para quem usa o app: painel administrativo, infraestrutura, deploy, testes, documentação, logs, refatoração interna.
- Nunca invente funcionalidades ou detalhes que não estejam nos commits.
- Se nada interessa a quem usa o app, devolva {"title": "Sem mudanças para o usuário", "items": []}.`;

function commitsPrompt(commits: RelevantCommit[]): string {
  return commits
    .map((c) => `- ${c.type}${c.scope ? `(${c.scope})` : ""}: ${c.subject}${c.body ? `\n  ${c.body.slice(0, 800).replace(/\n/g, "\n  ")}` : ""}`)
    .join("\n");
}

export async function draftWithAi(commits: RelevantCommit[]): Promise<Draft | null> {
  const settings = await getAiSettings();
  if (!(await isWithinUsageLimit(settings))) return null;
  const { provider, model } = slotModel(settings, "changelog");
  const response = await chat({
    provider,
    model,
    json: true,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Commits desta atualização:\n${commitsPrompt(commits)}` },
    ],
  });
  await logAiUsage({ feature: "changelog_draft", provider, model, usage: response.usage });
  if (!response.content) return null;
  try {
    const parsed = AiDraftSchema.safeParse(JSON.parse(response.content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const KIND_BY_TYPE: Record<string, ChangelogItem["kind"]> = { feat: "new", fix: "fix", perf: "improvement" };

/** Sem IA: os títulos dos commits viram os itens, para o admin reescrever. */
export function fallbackDraft(commits: RelevantCommit[], now = new Date()): Draft {
  const day = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  return {
    title: `Atualização de ${day}`,
    items: commits.slice(0, 30).map((c) => ({
      kind: KIND_BY_TYPE[c.type] ?? "improvement",
      text: c.subject.charAt(0).toUpperCase() + c.subject.slice(1),
    })),
  };
}

// ── Execução ─────────────────────────────────────────────────────────────────

export type AutomationResult =
  | { status: "disabled" | "baseline" | "up-to-date" | "no-relevant"; message: string }
  | { status: "created"; message: string; releaseId: string }
  | { status: "error"; message: string };

async function getRow() {
  return db.changelogAutomation.upsert({ where: { id: SINGLETON_ID }, update: {}, create: { id: SINGLETON_ID } });
}

/**
 * Uma verificação: lê os commits novos da branch e, se houver mudança para o
 * usuário, cria o rascunho e avisa os admins. `force` roda mesmo desligada
 * (botão "Verificar agora").
 */
export async function runChangelogAutomation({ force = false, now = new Date() } = {}): Promise<AutomationResult> {
  const row = await getRow();
  if (!row.enabled && !force) return { status: "disabled", message: "Rascunhos automáticos desligados." };
  const { repo, branch } = automationConfig();

  let head: string;
  let commits: RawCommit[] = [];
  try {
    head = await branchHead(repo, branch);
    if (row.lastCommitSha && row.lastCommitSha !== head) {
      commits = await commitsBetween(repo, row.lastCommitSha, head);
    }
  } catch (error) {
    const message =
      error instanceof GithubError && error.status === 404 && row.lastCommitSha
        ? "O último commit lido não existe mais na branch (histórico reescrito). O ponto de partida foi refeito."
        : `Não foi possível ler os commits de ${repo}@${branch}: ${(error as Error).message}`;
    if (error instanceof GithubError && error.status === 404 && row.lastCommitSha) {
      await db.changelogAutomation.update({ where: { id: SINGLETON_ID }, data: { lastCommitSha: null, lastCheckedAt: now, lastError: message } });
    } else {
      await db.changelogAutomation.update({ where: { id: SINGLETON_ID }, data: { lastCheckedAt: now, lastError: message } });
    }
    return { status: "error", message };
  }

  // Primeira verificação: só marca de onde começar, sem resumir o histórico todo.
  if (!row.lastCommitSha) {
    await db.changelogAutomation.updateMany({
      where: { id: SINGLETON_ID, lastCommitSha: null },
      data: { lastCommitSha: head, lastCheckedAt: now, lastError: null },
    });
    return { status: "baseline", message: `Ponto de partida marcado em ${head.slice(0, 7)}. Os próximos commits viram rascunho.` };
  }

  if (row.lastCommitSha === head) {
    await db.changelogAutomation.update({ where: { id: SINGLETON_ID }, data: { lastCheckedAt: now, lastError: null } });
    return { status: "up-to-date", message: "Nenhum commit novo." };
  }

  // Reserva o intervalo: duas verificações ao mesmo tempo não geram dois rascunhos.
  const claimed = await db.changelogAutomation.updateMany({
    where: { id: SINGLETON_ID, lastCommitSha: row.lastCommitSha },
    data: { lastCommitSha: head, lastCheckedAt: now, lastError: null },
  });
  if (claimed.count === 0) return { status: "up-to-date", message: "Outra verificação já processou estes commits." };

  const relevant = relevantCommits(commits);
  if (relevant.length === 0) {
    return { status: "no-relevant", message: `${commits.length} commit(s) novo(s), nenhum com mudança para o usuário.` };
  }

  let draft: Draft | null = null;
  let source: "ai" | "commits" = "ai";
  try {
    draft = await draftWithAi(relevant);
  } catch (error) {
    console.error("[changelog-automation] IA falhou, usando os títulos dos commits:", (error as Error).message);
  }
  if (!draft) {
    draft = fallbackDraft(relevant, now);
    source = "commits";
  }
  if (draft.items.length === 0) {
    return { status: "no-relevant", message: "A IA não encontrou mudança para o usuário nestes commits." };
  }

  const previous = await db.changelogRelease.findFirst({ orderBy: { createdAt: "desc" }, select: { version: true } });
  const release = await db.changelogRelease.create({
    data: {
      version: nextVersion(previous?.version ?? null, draft.items) || "a definir",
      title: draft.title,
      items: draft.items as unknown as Prisma.InputJsonValue,
      platforms: platformsFor(relevant),
      source,
      commits: relevant.map((c) => ({ sha: c.sha, message: `${c.type}${c.scope ? `(${c.scope})` : ""}: ${c.subject}` })),
    },
  });

  await notifyAdmins({
    type: "admin_changelog_draft",
    link: "/admin/changelog",
    title: `Novidade para revisar: ${release.title}`,
    body: `${source === "ai" ? "Rascunho escrito pela IA" : "Rascunho com os títulos dos commits (IA indisponível)"} a partir de ${relevant.length} commit(s) da ${branch}. ${summarizeItems(draft.items)}`,
    metadata: { releaseId: release.id },
    emailTemplate: "notice",
    emailData: {
      title: `Novidade para revisar: ${release.title}`,
      body: `${relevant.length} commit(s) novo(s) na ${branch} viraram um rascunho em Admin › Novidades. Revise o texto e publique quando estiver certo.`,
      ctaLabel: "Revisar no painel",
      ctaUrl: `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/admin/changelog`,
    },
  });

  return { status: "created", message: `Rascunho "${release.title}" criado.`, releaseId: release.id };
}

export async function getAutomationState() {
  const row = await getRow();
  return {
    ...automationConfig(),
    enabled: row.enabled,
    lastCommitSha: row.lastCommitSha,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export async function setAutomationEnabled(enabled: boolean) {
  await db.changelogAutomation.upsert({
    where: { id: SINGLETON_ID },
    update: { enabled },
    create: { id: SINGLETON_ID, enabled },
  });
  return getAutomationState();
}
