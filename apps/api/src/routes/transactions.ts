import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionFiltersSchema,
} from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// List transactions with filters and pagination
app.get("/", zValidator("query", TransactionFiltersSchema), async (c) => {
  const userId = c.get("userId");
  const { page, limit, startDate, endDate, type, categoryId, accountId, search, isIgnored } =
    c.req.valid("query");

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    db.transaction.findMany({
      where: {
        userId,
        ...(startDate && { date: { gte: new Date(startDate) } }),
        ...(endDate && { date: { lte: new Date(endDate) } }),
        ...(type && { type }),
        ...(categoryId && { categoryId }),
        ...(accountId && { accountId }),
        ...(search && {
          description: { contains: search, mode: "insensitive" as const },
        }),
        ...(isIgnored !== undefined && { isIgnored }),
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        account: { select: { id: true, name: true, institution: true, color: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    db.transaction.count({
      where: {
        userId,
        ...(startDate && { date: { gte: new Date(startDate) } }),
        ...(endDate && { date: { lte: new Date(endDate) } }),
        ...(type && { type }),
        ...(categoryId && { categoryId }),
        ...(accountId && { accountId }),
        ...(search && {
          description: { contains: search, mode: "insensitive" as const },
        }),
        ...(isIgnored !== undefined && { isIgnored }),
      },
    }),
  ]);

  return c.json({
    data: transactions,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// Get single transaction
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const transaction = await db.transaction.findFirst({
    where: { id, userId },
    include: {
      category: true,
      account: true,
    },
  });

  if (!transaction) return c.json({ error: "Transação não encontrada" }, 404);
  return c.json(transaction);
});

// Create transaction
app.post("/", zValidator("json", CreateTransactionSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  // Verify account belongs to user
  const account = await db.financialAccount.findFirst({
    where: { id: data.accountId, userId },
  });
  if (!account) return c.json({ error: "Conta não encontrada" }, 404);

  const transaction = await db.transaction.create({
    data: {
      ...data,
      userId,
      amount: data.amount,
      date: new Date(data.date),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      account: { select: { id: true, name: true, institution: true } },
    },
  });

  return c.json(transaction, 201);
});

// Update transaction
app.patch("/:id", zValidator("json", UpdateTransactionSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.transaction.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Transação não encontrada" }, 404);

  const transaction = await db.transaction.update({
    where: { id },
    data: {
      ...data,
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
    },
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      account: { select: { id: true, name: true, institution: true } },
    },
  });

  return c.json(transaction);
});

// Delete transaction
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.transaction.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Transação não encontrada" }, 404);

  await db.transaction.delete({ where: { id } });
  return c.json({ success: true });
});

// Monthly summary for reports
app.get("/reports/monthly", async (c) => {
  const userId = c.get("userId");
  const { year, month } = c.req.query();

  const y = parseInt(year ?? new Date().getFullYear().toString());
  const m = parseInt(month ?? (new Date().getMonth() + 1).toString());

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const [income, expense, byCategory] = await Promise.all([
    db.transaction.aggregate({
      where: { userId, type: "income", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, type: "expense", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", date: { gte: startDate, lte: endDate }, isIgnored: false },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
  ]);

  // Enrich category names
  const categoryIds = byCategory.map((r) => r.categoryId).filter(Boolean) as string[];
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true, color: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const incomeAmount = Number(income._sum.amount ?? 0);
  const expenseAmount = Number(expense._sum.amount ?? 0);

  return c.json({
    year: y,
    month: m,
    income: incomeAmount,
    expense: expenseAmount,
    balance: incomeAmount - expenseAmount,
    byCategory: byCategory.map((r) => ({
      category: r.categoryId ? catMap[r.categoryId] : null,
      total: Number(r._sum.amount ?? 0),
    })),
  });
});

export default app;
