import { createHmac, timingSafeEqual } from "node:crypto";
import { db, type Prisma } from "@finances/db";
import {
  DEFAULT_HOME_PAGE,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_LANDING_MENU,
  LANDING_HOME_SLUG,
  LandingMenuSchema,
  LandingSectionsSchema,
  type LandingMenuItem,
  type LandingSection,
} from "@finances/validations";

/** Lê seções gravadas como JSON; conteúdo que não bate com o schema não é servido. */
export function parseSections(raw: unknown): LandingSection[] {
  const parsed = LandingSectionsSchema.safeParse(raw ?? []);
  if (!parsed.success) {
    console.error("[landing] seções inválidas no banco:", parsed.error.issues.slice(0, 3));
    return [];
  }
  return parsed.data;
}

const asJson = (sections: LandingSection[]) => sections as unknown as Prisma.InputJsonValue;

/**
 * Garante a página inicial. Na primeira vez nasce já publicada com o conteúdo
 * de fábrica — o site não pode ficar em branco só porque ninguém abriu o
 * editor ainda.
 */
export async function ensureHomePage() {
  return db.landingPage.upsert({
    where: { slug: LANDING_HOME_SLUG },
    update: {},
    create: {
      slug: LANDING_HOME_SLUG,
      title: DEFAULT_HOME_PAGE.title,
      description: DEFAULT_HOME_PAGE.description,
      draftSections: asJson(DEFAULT_HOME_SECTIONS),
      publishedSections: asJson(DEFAULT_HOME_SECTIONS),
      publishedAt: new Date(),
    },
  });
}

type PageRow = Awaited<ReturnType<typeof db.landingPage.findUniqueOrThrow>>;

/** Rascunho diferente do que está no ar (ou nunca publicado). */
export function hasUnpublishedChanges(page: Pick<PageRow, "draftSections" | "publishedSections" | "publishedAt">) {
  if (!page.publishedAt) return true;
  return JSON.stringify(page.draftSections) !== JSON.stringify(page.publishedSections);
}

export function toAdminPage(page: PageRow) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    showInFooter: page.showInFooter,
    isHome: page.slug === LANDING_HOME_SLUG,
    sections: parseSections(page.draftSections),
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(page),
  };
}

export function pathForSlug(slug: string): string {
  return slug === LANDING_HOME_SLUG ? "/" : `/${slug}`;
}

/**
 * Pede à landing para regerar as páginas. Falhar aqui não desfaz a
 * publicação (o conteúdo já está no banco e a landing também revalida
 * sozinha de hora em hora) — só avisa o admin que vai demorar a aparecer.
 */
export async function revalidateLanding(paths: string[]): Promise<boolean> {
  const url = process.env.LANDING_URL;
  const secret = process.env.LANDING_REVALIDATE_SECRET;
  if (!url || !secret) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.error("[landing] revalidação falhou:", err);
    return false;
  }
}

// ── Pré-visualização ──────────────────────────────────────────────────────────
// Token assinado e de vida curta: a landing busca o rascunho com ele, sem
// precisar da sessão do admin (são domínios diferentes).

const PREVIEW_TTL_MS = 30 * 60 * 1000;

function previewSecret(): string {
  const secret = process.env.LANDING_PREVIEW_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("LANDING_PREVIEW_SECRET (ou BETTER_AUTH_SECRET) não configurado");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", previewSecret()).update(payload).digest("base64url");
}

export function createPreviewToken(pageId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: pageId, e: now + PREVIEW_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Devolve o id da página se o token é autêntico e não expirou. */
export function readPreviewToken(token: string, now = Date.now()): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p: unknown; e: unknown };
    if (typeof p !== "string" || typeof e !== "number" || e < now) return null;
    return p;
  } catch {
    return null;
  }
}

// ── Leitura pública ───────────────────────────────────────────────────────────

export async function getPublishedPage(slug: string) {
  if (slug === LANDING_HOME_SLUG) await ensureHomePage();
  const page = await db.landingPage.findUnique({ where: { slug } });
  if (!page || !page.publishedAt || page.publishedSections === null) return null;
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    sections: parseSections(page.publishedSections),
    publishedAt: page.publishedAt.toISOString(),
  };
}

export async function listPublishedSlugs() {
  const [pages, menu] = await Promise.all([
    db.landingPage.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, title: true, showInFooter: true },
      orderBy: { createdAt: "asc" },
    }),
    getMenu(),
  ]);
  return {
    slugs: pages.map((p) => p.slug),
    footer: pages.filter((p) => p.showInFooter).map((p) => ({ slug: p.slug, title: p.title })),
    menu,
  };
}

// ── Menu do site ──────────────────────────────────────────────────────────────

const SETTINGS_ID = "singleton";

/** Menu atual; na primeira leitura, o de fábrica (as seções da inicial). */
export async function getMenu(): Promise<LandingMenuItem[]> {
  const settings = await db.landingSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, menu: DEFAULT_LANDING_MENU as unknown as Prisma.InputJsonValue },
  });
  const parsed = LandingMenuSchema.safeParse(settings.menu);
  return parsed.success ? parsed.data : DEFAULT_LANDING_MENU;
}

/**
 * Salva o menu e regera todas as páginas publicadas: o cabeçalho aparece em
 * cada uma delas.
 */
export async function updateMenu(menu: LandingMenuItem[]): Promise<{ menu: LandingMenuItem[]; revalidated: boolean }> {
  await db.landingSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { menu: menu as unknown as Prisma.InputJsonValue },
    create: { id: SETTINGS_ID, menu: menu as unknown as Prisma.InputJsonValue },
  });
  const pages = await db.landingPage.findMany({ where: { publishedAt: { not: null } }, select: { slug: true } });
  const revalidated = await revalidateLanding([...new Set(["/", ...pages.map((p) => pathForSlug(p.slug))])]);
  return { menu, revalidated };
}
