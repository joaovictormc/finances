import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import { CreateBudgetSchema, UpdateBudgetSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getUserGroupIds, hasGroupRole } from "../lib/groups";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => {
  const userId = c.get("userId");
  const groupIds = await getUserGroupIds(userId);
  const { year, month } = c.req.query();

  const y = parseInt(year ?? new Date().getFullYear().toString());
  const m = parseInt(month ?? (new Date().getMonth() + 1).toString());
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const budgets = await db.budget.findMany({
    where: {
      OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }],
      startDate: { lte: endDate },
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: startDate } }] }],
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
    },
  });

  // Gasto de todos os orçamentos num groupBy só (antes era um aggregate por
  // orçamento). O escopo de cada um é o mesmo de antes: orçamento pessoal soma
  // tudo que o usuário lançou; orçamento de grupo soma o que foi lançado no grupo.
  const budgetGroupIds = [...new Set(budgets.map((b) => b.groupId).filter((id): id is string => !!id))];
  const spentRows =
    budgets.length === 0
      ? []
      : await db.transaction.groupBy({
          by: ["userId", "groupId", "categoryId"],
          where: {
            OR: [{ userId }, ...(budgetGroupIds.length ? [{ groupId: { in: budgetGroupIds } }] : [])],
            type: "expense",
            isIgnored: false,
            date: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        });

  const enriched = budgets.map((budget) => {
    const spentAmount = spentRows
      .filter((row) => (budget.groupId ? row.groupId === budget.groupId : row.userId === userId))
      .filter((row) => !budget.categoryId || row.categoryId === budget.categoryId)
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
    const budgetAmount = Number(budget.amount);
    const percentage = budgetAmount > 0 ? spentAmount / budgetAmount : 0;

    return {
      ...budget,
      spentAmount,
      percentage,
      isOverBudget: spentAmount > budgetAmount,
      isNearLimit: percentage >= Number(budget.alertThreshold),
    };
  });

  return c.json(enriched);
});

app.post("/", zValidator("json", CreateBudgetSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  if (data.groupId && !(await hasGroupRole(userId, data.groupId, ["owner", "admin", "member"]))) {
    return c.json({ error: "Sem permissão para compartilhar com este grupo" }, 403);
  }

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

  const existing = await db.budget.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Orçamento não encontrado" }, 404);
  const canEdit =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canEdit) return c.json({ error: "Orçamento não encontrado" }, 404);

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

  const existing = await db.budget.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Orçamento não encontrado" }, 404);
  const canDelete =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canDelete) return c.json({ error: "Orçamento não encontrado" }, 404);

  await db.budget.delete({ where: { id } });
  return c.json({ success: true });
});

export default app;
