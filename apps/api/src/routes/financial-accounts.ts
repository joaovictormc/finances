import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import {
  CreateFinancialAccountSchema,
  UpdateFinancialAccountSchema,
} from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");

  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return c.json(accounts);
});

app.post("/", zValidator("json", CreateFinancialAccountSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const account = await db.financialAccount.create({
    data: { ...data, userId },
  });

  return c.json(account, 201);
});

app.patch("/:id", zValidator("json", UpdateFinancialAccountSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.financialAccount.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);

  const account = await db.financialAccount.update({
    where: { id },
    data,
  });

  return c.json(account);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.financialAccount.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Conta não encontrada" }, 404);

  // Soft delete via archive
  const account = await db.financialAccount.update({
    where: { id },
    data: { isArchived: true },
  });

  return c.json(account);
});

export default app;
