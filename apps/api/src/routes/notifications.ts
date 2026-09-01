import { Hono } from "hono";
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
