import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, Prisma } from "@finances/db";
import { ChangelogPublishSchema, ChangelogReleaseInputSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { broadcastQueue } from "../jobs/queues";
import { toPublicRelease } from "../lib/changelog";
import { getAutomationState, runChangelogAutomation, setAutomationEnabled } from "../lib/changelog-automation";
import { z } from "zod";

/** Admin › Novidades: rascunho, edição e publicação com aviso. Só admin. */
const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth, requireAdmin);

type Row = NonNullable<Awaited<ReturnType<typeof db.changelogRelease.findUnique>>>;

function toAdmin(row: Row) {
  return {
    ...toPublicRelease(row),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    commits: (row.commits as Array<{ sha: string; message: string }> | null) ?? [],
  };
}

// ── Rascunhos automáticos a partir dos commits ───────────────────────────────

app.get("/automation", async (c) => c.json(await getAutomationState()));

app.patch("/automation", zValidator("json", z.object({ enabled: z.boolean() })), async (c) =>
  c.json(await setAutomationEnabled(c.req.valid("json").enabled))
);

/** "Verificar agora": roda mesmo com a automação desligada. */
app.post("/automation/run", async (c) => {
  const result = await runChangelogAutomation({ force: true });
  return c.json({ result, state: await getAutomationState() });
});

app.get("/", async (c) => {
  const rows = await db.changelogRelease.findMany({ orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] });
  return c.json(rows.map(toAdmin));
});

app.post("/", zValidator("json", ChangelogReleaseInputSchema), async (c) => {
  const input = c.req.valid("json");
  const row = await db.changelogRelease.create({
    data: { ...input, items: input.items as unknown as Prisma.InputJsonValue },
  });
  return c.json(toAdmin(row), 201);
});

// Publicada também pode ser editada (corrigir um texto): o aviso já enviado
// não é refeito.
app.patch("/:id", zValidator("json", ChangelogReleaseInputSchema), async (c) => {
  const id = c.req.param("id");
  if (!(await db.changelogRelease.findUnique({ where: { id }, select: { id: true } }))) {
    return c.json({ error: "Novidade não encontrada." }, 404);
  }
  const input = c.req.valid("json");
  const row = await db.changelogRelease.update({
    where: { id },
    data: { ...input, items: input.items as unknown as Prisma.InputJsonValue },
  });
  return c.json(toAdmin(row));
});

app.delete("/:id", async (c) => {
  await db.changelogRelease.delete({ where: { id: c.req.param("id") } }).catch(() => null);
  return c.json({ success: true });
});

/**
 * Publica e avisa. O aviso roda em fila (broadcast.worker), para não prender a
 * requisição com muitos usuários; o worker só dispara uma vez por novidade.
 */
app.post("/:id/publish", zValidator("json", ChangelogPublishSchema), async (c) => {
  const id = c.req.param("id");
  const row = await db.changelogRelease.findUnique({ where: { id } });
  if (!row) return c.json({ error: "Novidade não encontrada." }, 404);
  if (row.publishedAt) return c.json({ error: "Esta novidade já foi publicada." }, 409);

  const { notifyInApp, notifyEmail } = c.req.valid("json");
  const published = await db.changelogRelease.update({
    where: { id },
    // Sem nenhum aviso escolhido, marca como avisada: só aparece na tela e na janela.
    data: { publishedAt: new Date(), ...(!notifyInApp && !notifyEmail && { notifiedAt: new Date() }) },
  });
  if (notifyInApp || notifyEmail) {
    await broadcastQueue.add("changelog", { releaseId: id, inApp: notifyInApp, email: notifyEmail }, { attempts: 3, backoff: { type: "exponential", delay: 10_000 } });
  }
  return c.json(toAdmin(published));
});

export default app;
