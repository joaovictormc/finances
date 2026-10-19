import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  changelogAutomation: { upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  changelogRelease: { findFirst: vi.fn(), create: vi.fn() },
}));
const chatMock = vi.hoisted(() => vi.fn());
const notifyAdminsMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
vi.mock("./ai/chat", () => ({ chat: chatMock }));
vi.mock("./ai/ai-settings", () => ({
  getAiSettings: vi.fn().mockResolvedValue({}),
  isWithinUsageLimit: vi.fn().mockResolvedValue(true),
  logAiUsage: vi.fn(),
  slotModel: () => ({ provider: "groq", model: "m" }),
}));
vi.mock("./admin-alerts", () => ({ notifyAdmins: notifyAdminsMock }));

import {
  fallbackDraft,
  nextVersion,
  platformsFor,
  relevantCommits,
  runChangelogAutomation,
  type RawCommit,
} from "./changelog-automation";

const NOW = new Date("2026-10-19T15:00:00.000Z");
const commit = (sha: string, message: string, parents = 1): RawCommit => ({ sha, message, parents });

describe("relevantCommits", () => {
  it("fica com feat/fix/perf, sem merge, landing, deploy e docs, e tira o Co-Authored-By", () => {
    const result = relevantCommits([
      commit("1", "feat(mobile): categorias em lista com busca\n\nDetalhe.\n\nCo-Authored-By: Claude <x@y>"),
      commit("2", "fix: admin nasce verificado"),
      commit("3", "docs(deploy): passo a passo"),
      commit("4", "feat(landing): editor da landing"),
      commit("5", "chore(mobile): app.json"),
      commit("6", "Merge branch develop", 2),
      commit("7", "perf(web): menos requisições"),
      commit("8", "atualiza coisas sem padrão"),
    ]);
    expect(result.map((c) => c.sha)).toEqual(["1", "2", "7"]);
    expect(result[0]).toMatchObject({ type: "feat", scope: "mobile", subject: "categorias em lista com busca", body: "Detalhe." });
  });
});

describe("platformsFor", () => {
  const rel = (scope: string | null) => ({ sha: "x", type: "fix", scope, subject: "s", body: "" });
  it("deduz pelo escopo", () => {
    expect(platformsFor([rel("mobile")])).toEqual(["android", "ios"]);
    expect(platformsFor([rel("web")])).toEqual(["web"]);
    expect(platformsFor([rel("mobile"), rel("web")])).toEqual([]);
    expect(platformsFor([rel("mobile"), rel("api")])).toEqual([]);
    expect(platformsFor([rel(null)])).toEqual([]);
  });
});

describe("nextVersion", () => {
  it("novidade sobe a menor, o resto a de correção", () => {
    expect(nextVersion("1.3.1", [{ kind: "new", text: "x" }])).toBe("1.4.0");
    expect(nextVersion("1.3.1", [{ kind: "fix", text: "x" }])).toBe("1.3.2");
    expect(nextVersion(null, [{ kind: "fix", text: "x" }])).toBe("1.0.0");
    expect(nextVersion("Outubro", [{ kind: "fix", text: "x" }])).toBe("");
  });
});

describe("fallbackDraft", () => {
  it("usa os títulos dos commits, com a primeira letra maiúscula", () => {
    const draft = fallbackDraft(relevantCommits([commit("1", "fix(mobile): teclado cobria os campos")]), NOW);
    expect(draft).toEqual({ title: "Atualização de 19/10", items: [{ kind: "fix", text: "Teclado cobria os campos" }] });
  });
});

describe("runChangelogAutomation", () => {
  const fetchMock = vi.fn();
  const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    dbMock.changelogAutomation.updateMany.mockResolvedValue({ count: 1 });
    dbMock.changelogRelease.findFirst.mockResolvedValue({ version: "1.3.1" });
    dbMock.changelogRelease.create.mockImplementation(async ({ data }) => ({ id: "rel1", ...data }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("desligada não faz nada (a não ser forçada)", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: false, lastCommitSha: "a" });
    expect((await runChangelogAutomation({ now: NOW })).status).toBe("disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("primeira vez só marca o ponto de partida", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: null });
    fetchMock.mockResolvedValueOnce(json({ commit: { sha: "head1" } }));
    const result = await runChangelogAutomation({ now: NOW });
    expect(result.status).toBe("baseline");
    expect(dbMock.changelogAutomation.updateMany.mock.calls[0]![0].data.lastCommitSha).toBe("head1");
    expect(dbMock.changelogRelease.create).not.toHaveBeenCalled();
  });

  it("sem commit novo não cria nada", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: "head1" });
    fetchMock.mockResolvedValueOnce(json({ commit: { sha: "head1" } }));
    expect((await runChangelogAutomation({ now: NOW })).status).toBe("up-to-date");
  });

  it("commits novos viram rascunho da IA e os admins são avisados", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: "old" });
    fetchMock
      .mockResolvedValueOnce(json({ commit: { sha: "new" } }))
      .mockResolvedValueOnce(json({ commits: [{ sha: "c1", commit: { message: "feat(mobile): categorias em lista com busca" }, parents: [{}] }] }));
    chatMock.mockResolvedValue({
      content: JSON.stringify({ title: "Categorias com busca", items: [{ kind: "improvement", text: "Ache a categoria digitando parte do nome." }] }),
      toolCalls: [],
      usage: null,
    });

    const result = await runChangelogAutomation({ now: NOW });

    expect(result).toMatchObject({ status: "created", releaseId: "rel1" });
    const data = dbMock.changelogRelease.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ version: "1.3.2", title: "Categorias com busca", source: "ai", platforms: ["android", "ios"] });
    expect(data.commits).toEqual([{ sha: "c1", message: "feat(mobile): categorias em lista com busca" }]);
    expect(notifyAdminsMock.mock.calls[0]![0]).toMatchObject({ type: "admin_changelog_draft", link: "/admin/changelog" });
    // Reserva o intervalo a partir do commit lido antes.
    expect(dbMock.changelogAutomation.updateMany.mock.calls[0]![0].where.lastCommitSha).toBe("old");
  });

  it("IA falhando, rascunho com os títulos dos commits", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: "old" });
    fetchMock
      .mockResolvedValueOnce(json({ commit: { sha: "new" } }))
      .mockResolvedValueOnce(json({ commits: [{ sha: "c1", commit: { message: "fix: teclado cobria os campos" }, parents: [{}] }] }));
    chatMock.mockRejectedValue(new Error("sem chave"));

    await runChangelogAutomation({ now: NOW });

    expect(dbMock.changelogRelease.create.mock.calls[0]![0].data).toMatchObject({
      source: "commits",
      items: [{ kind: "fix", text: "Teclado cobria os campos" }],
    });
  });

  it("outra verificação já pegou o intervalo: não duplica", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: "old" });
    dbMock.changelogAutomation.updateMany.mockResolvedValue({ count: 0 });
    fetchMock
      .mockResolvedValueOnce(json({ commit: { sha: "new" } }))
      .mockResolvedValueOnce(json({ commits: [{ sha: "c1", commit: { message: "fix: x" }, parents: [{}] }] }));

    expect((await runChangelogAutomation({ now: NOW })).status).toBe("up-to-date");
    expect(dbMock.changelogRelease.create).not.toHaveBeenCalled();
  });

  it("só commits sem interesse para o usuário: nenhum rascunho", async () => {
    dbMock.changelogAutomation.upsert.mockResolvedValue({ enabled: true, lastCommitSha: "old" });
    fetchMock
      .mockResolvedValueOnce(json({ commit: { sha: "new" } }))
      .mockResolvedValueOnce(json({ commits: [{ sha: "c1", commit: { message: "docs: atualiza deploy" }, parents: [{}] }] }));

    expect((await runChangelogAutomation({ now: NOW })).status).toBe("no-relevant");
    expect(chatMock).not.toHaveBeenCalled();
  });
});
