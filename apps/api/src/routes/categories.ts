import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const { type } = c.req.query();

  const categories = await db.category.findMany({
    where: {
      OR: [{ isSystem: true }, { userId }],
      parentId: null,
      ...(type && { type }),
    },
    include: {
      children: {
        where: { OR: [{ isSystem: true }, { userId }] },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return c.json(categories);
});

export default app;
