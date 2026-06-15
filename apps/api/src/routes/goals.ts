import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import { CreateGoalSchema, UpdateGoalSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");

  const goals = await db.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return c.json(goals);
});

app.post("/", zValidator("json", CreateGoalSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const goal = await db.goal.create({
    data: {
      ...data,
      userId,
      ...(data.targetDate && { targetDate: new Date(data.targetDate) }),
    },
  });

  return c.json(goal, 201);
});

app.patch("/:id", zValidator("json", UpdateGoalSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.goal.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Meta não encontrada" }, 404);

  const goal = await db.goal.update({
    where: { id },
    data: {
      ...data,
      ...(data.targetDate && { targetDate: new Date(data.targetDate) }),
    },
  });

  return c.json(goal);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.goal.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Meta não encontrada" }, 404);

  await db.goal.delete({ where: { id } });
  return c.json({ success: true });
});

export default app;
