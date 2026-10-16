import { Hono } from "hono";
import { db } from "@finances/db";
import { getPlanCatalog } from "../lib/plan-catalog";
import { getPublishedPage, listPublishedSlugs, parseSections, readPreviewToken } from "../lib/landing";

/**
 * Rotas sem login, lidas pela landing page. Só dados que já são públicos na
 * vitrine (planos e preços) — nada de usuário passa por aqui.
 */
const app = new Hono();

app.get("/plans", async (c) => {
  const catalog = await getPlanCatalog();
  // Preço muda raramente (admin em /admin/pricing): 5 min de cache no
  // navegador/CDN poupa o banco sem atrasar reajuste de forma perceptível.
  c.header("Cache-Control", "public, max-age=300");
  return c.json(
    catalog.map(({ id, name, priceCents, prices, historyMonths, aiInsights, receiptScan, assistant, maxGroupMembers }) => ({
      id,
      name,
      priceCents,
      prices,
      historyMonths,
      aiInsights,
      receiptScan,
      assistant,
      maxGroupMembers,
    }))
  );
});

// ── Landing page ─────────────────────────────────────────────────────────────
// Só o conteúdo publicado; o rascunho sai apenas com token de pré-visualização.

app.get("/landing/pages", async (c) => {
  c.header("Cache-Control", "public, max-age=60");
  return c.json(await listPublishedSlugs());
});

app.get("/landing/pages/:slug", async (c) => {
  const page = await getPublishedPage(c.req.param("slug"));
  if (!page) return c.json({ error: "Página não encontrada" }, 404);
  c.header("Cache-Control", "public, max-age=60");
  return c.json(page);
});

app.get("/landing/preview/:token", async (c) => {
  const pageId = readPreviewToken(c.req.param("token"));
  if (!pageId) return c.json({ error: "Link de pré-visualização inválido ou expirado" }, 401);
  const page = await db.landingPage.findUnique({ where: { id: pageId } });
  if (!page) return c.json({ error: "Página não encontrada" }, 404);
  c.header("Cache-Control", "no-store");
  return c.json({
    slug: page.slug,
    title: page.title,
    description: page.description,
    sections: parseSections(page.draftSections),
    publishedAt: null,
  });
});

export default app;
