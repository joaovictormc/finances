import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

/** Quantas a campainha carrega. Além disso vira histórico que ninguém rola. */
const PAGE_SIZE = 30;

app.get("/", async (c) => {
  const userId = c.get("userId");

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        metadata: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { userId, status: { not: "read" } } }),
  ]);

  return c.json({ items, unread });
});

// ── Push no celular ──────────────────────────────────────────────────────────

const PushTokenSchema = z.object({
  token: z.string().min(1).max(255),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().max(120).optional(),
});

app.post("/push-token", zValidator("json", PushTokenSchema), async (c) => {
  const userId = c.get("userId");
  const { token, platform, deviceName } = c.req.valid("json");

  // Upsert pelo token, não pelo par usuário+token: o mesmo aparelho
  // reinstalando reaproveita a linha, e trocar de conta no mesmo celular move o
  // token de dono em vez de deixar o antigo recebendo aviso do novo usuário.
  await db.pushToken.upsert({
    where: { token },
    update: { userId, platform, deviceName, lastUsedAt: new Date() },
    create: { userId, token, platform, deviceName },
  });

  return c.json({ success: true });
});

/** Chamado no logout: o aparelho não deve mais receber aviso desta conta. */
app.post("/push-token/remove", zValidator("json", z.object({ token: z.string() })), async (c) => {
  const userId = c.get("userId");
  const { token } = c.req.valid("json");

  const { count } = await db.pushToken.deleteMany({ where: { token, userId } });
  return c.json({ removed: count });
});

/** Apaga o histórico inteiro do usuário — inclusive o que não foi lido. */
app.delete("/", async (c) => {
  const userId = c.get("userId");
  const { count } = await db.notification.deleteMany({ where: { userId } });
  return c.json({ count });
});

app.post("/read-all", async (c) => {
  const userId = c.get("userId");
  const { count } = await db.notification.updateMany({
    where: { userId, status: { not: "read" } },
    data: { status: "read", readAt: new Date() },
  });
  return c.json({ count });
});

app.post("/:id/read", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  // `updateMany` com o userId no where em vez de `update` por id: sem isso um
  // usuário marcaria como lida a notificação de outro só trocando o id na URL.
  const { count } = await db.notification.updateMany({
    where: { id, userId },
    data: { status: "read", readAt: new Date() },
  });
  if (count === 0) return c.json({ error: "Notificação não encontrada" }, 404);

  return c.json({ success: true });
});

export default app;
