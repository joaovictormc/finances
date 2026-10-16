import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, Prisma } from "@finances/db";
import { z } from "zod";
import { CreateLandingPageSchema, LANDING_HOME_SLUG, LandingMenuSchema, UpdateLandingPageSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  createPreviewToken,
  ensureHomePage,
  getMenu,
  updateMenu,
  pathForSlug,
  revalidateLanding,
  toAdminPage,
} from "../lib/landing";

/** Editor da landing page no painel admin. Só admin. */
const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth, requireAdmin);

app.get("/pages", async (c) => {
  await ensureHomePage();
  const pages = await db.landingPage.findMany({ orderBy: { createdAt: "asc" } });
  // A inicial sempre primeiro.
  pages.sort((a, b) => Number(b.slug === LANDING_HOME_SLUG) - Number(a.slug === LANDING_HOME_SLUG));
  return c.json(pages.map(toAdminPage));
});

app.post("/pages", zValidator("json", CreateLandingPageSchema), async (c) => {
  const { slug, title } = c.req.valid("json");
  try {
    const page = await db.landingPage.create({ data: { slug, title } });
    return c.json(toAdminPage(page), 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return c.json({ error: "Já existe uma página com esse endereço." }, 409);
    }
    throw err;
  }
});

app.get("/pages/:id", async (c) => {
  const page = await db.landingPage.findUnique({ where: { id: c.req.param("id") } });
  if (!page) return c.json({ error: "Página não encontrada." }, 404);
  return c.json(toAdminPage(page));
});

/** Salva o rascunho (e as configurações da página). Não muda o que está no ar. */
app.patch("/pages/:id", zValidator("json", UpdateLandingPageSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  const current = await db.landingPage.findUnique({ where: { id } });
  if (!current) return c.json({ error: "Página não encontrada." }, 404);
  if (current.slug === LANDING_HOME_SLUG && data.slug && data.slug !== LANDING_HOME_SLUG) {
    return c.json({ error: "O endereço da página inicial não pode mudar." }, 400);
  }

  try {
    const page = await db.landingPage.update({
      where: { id },
      data: {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.showInFooter !== undefined && { showInFooter: data.showInFooter }),
        ...(data.sections !== undefined && { draftSections: data.sections as unknown as Prisma.InputJsonValue }),
      },
    });
    // Título, endereço e rodapé valem na hora (não fazem parte do rascunho
    // de seções): uma página publicada precisa ser regerada.
    const touchesLive = data.slug !== undefined || data.title !== undefined || data.description !== undefined || data.showInFooter !== undefined;
    if (current.publishedAt && touchesLive) {
      void revalidateLanding([...new Set([pathForSlug(current.slug), pathForSlug(page.slug), "/"])]);
    }
    return c.json(toAdminPage(page));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return c.json({ error: "Já existe uma página com esse endereço." }, 409);
    }
    throw err;
  }
});

app.post("/pages/:id/publish", async (c) => {
  const current = await db.landingPage.findUnique({ where: { id: c.req.param("id") } });
  if (!current) return c.json({ error: "Página não encontrada." }, 404);
  const page = await db.landingPage.update({
    where: { id: current.id },
    data: { publishedSections: current.draftSections as Prisma.InputJsonValue, publishedAt: new Date() },
  });
  // A inicial também, por causa dos links de rodapé de páginas novas.
  const revalidated = await revalidateLanding([...new Set([pathForSlug(page.slug), "/"])]);
  return c.json({ page: toAdminPage(page), revalidated });
});

/** Volta o rascunho para o que está no ar. */
app.post("/pages/:id/discard", async (c) => {
  const current = await db.landingPage.findUnique({ where: { id: c.req.param("id") } });
  if (!current) return c.json({ error: "Página não encontrada." }, 404);
  if (!current.publishedAt || current.publishedSections === null) {
    return c.json({ error: "Esta página ainda não foi publicada." }, 400);
  }
  const page = await db.landingPage.update({
    where: { id: current.id },
    data: { draftSections: current.publishedSections as Prisma.InputJsonValue },
  });
  return c.json(toAdminPage(page));
});

app.post("/pages/:id/preview-token", async (c) => {
  const page = await db.landingPage.findUnique({ where: { id: c.req.param("id") }, select: { id: true } });
  if (!page) return c.json({ error: "Página não encontrada." }, 404);
  return c.json({ token: createPreviewToken(page.id) });
});

app.delete("/pages/:id", async (c) => {
  const current = await db.landingPage.findUnique({ where: { id: c.req.param("id") } });
  if (!current) return c.json({ error: "Página não encontrada." }, 404);
  if (current.slug === LANDING_HOME_SLUG) return c.json({ error: "A página inicial não pode ser excluída." }, 400);
  await db.landingPage.delete({ where: { id: current.id } });
  if (current.publishedAt) void revalidateLanding([pathForSlug(current.slug), "/"]);
  return c.json({ success: true });
});

// ── Menu do site (cabeçalho e rodapé de todas as páginas) ─────────────────────

app.get("/menu", async (c) => c.json({ menu: await getMenu() }));

app.patch("/menu", zValidator("json", z.object({ menu: LandingMenuSchema })), async (c) => {
  return c.json(await updateMenu(c.req.valid("json").menu));
});

export default app;
