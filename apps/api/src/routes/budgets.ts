import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import { CreateBudgetSchema, UpdateBudgetSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const { year, month } = c.req.query();

  const y = parseInt(year ?? new Date().getFullYear().toString());
  const m = parseInt(month ?? (new Date().getMonth() + 1).toString());
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const budgets = await db.budget.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  // Calculate spent amount for each budget
  const enriched = await Promise.all(
    budgets.map(async (budget) => {
      const spent = await db.transaction.aggregate({
        where: {
          userId,
          type: "expense",
          isIgnored: false,
          date: { gte: startDate, lte: endDate },
          ...(budget.categoryId && { categoryId: budget.categoryId }),
        },
        _sum: { amount: true },
      });

      const spentAmount = Number(spent._sum.amount ?? 0);
      const budgetAmount = Number(budget.amount);
      const percentage = budgetAmount > 0 ? spentAmount / budgetAmount : 0;

      return {
        ...budget,
        spentAmount,
        percentage,
        isOverBudget: spentAmount > budgetAmount,
        isNearLimit: percentage >= Number(budget.alertThreshold),
      };
    })
  );

  return c.json(enriched);
});

app.post("/", zValidator("json", CreateBudgetSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const budget = await db.budget.create({
    data: {
      ...data,
      userId,
      startDate: new Date(data.startDate),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  return c.json(budget, 201);
});

app.patch("/:id", zValidator("json", UpdateBudgetSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.budget.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Orçamento não encontrado" }, 404);

  const budget = await db.budget.update({
    where: { id },
    data: {
      ...data,
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  return c.json(budget);
});

app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.budget.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Orçamento não encontrado" }, 404);

  await db.budget.delete({ where: { id } });
  return c.json({ success: true });
});

export default app;
