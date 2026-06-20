import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  TransactionFiltersSchema,
} from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getUserGroupIds, hasGroupRole } from "../lib/groups";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// List transactions with filters and pagination
app.get("/", zValidator("query", TransactionFiltersSchema), async (c) => {
  const userId = c.get("userId");
  const groupIds = await getUserGroupIds(userId);
  const { page, limit, startDate, endDate, type, categoryId, accountId, search, isIgnored, groupId } =
    c.req.valid("query");

  const skip = (page - 1) * limit;

  const ownershipFilter = { OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }] };
  const scopeFilter =
    groupId === "personal" ? { groupId: null, userId } : groupId ? { groupId } : {};

  const where = {
    AND: [ownershipFilter, scopeFilter],
    ...(startDate && { date: { gte: new Date(startDate) } }),
    ...(endDate && { date: { lte: new Date(endDate) } }),
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    ...(accountId && { accountId }),
    ...(search && {
      description: { contains: search, mode: "insensitive" as const },
    }),
    ...(isIgnored !== undefined && { isIgnored }),
  };

  const [transactions, total] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        account: { select: { id: true, name: true, institution: true, color: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    db.transaction.count({ where }),
  ]);

  return c.json({
    data: transactions,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// Get single transaction
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const groupIds = await getUserGroupIds(userId);
  const id = c.req.param("id");

  const transaction = await db.transaction.findFirst({
    where: { id, OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }] },
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

  if (data.groupId && !(await hasGroupRole(userId, data.groupId, ["owner", "admin", "member"]))) {
    return c.json({ error: "Sem permissão para lançar neste grupo" }, 403);
  }

  // Verify account belongs to the same context (pessoal do usuário ou do grupo informado)
  const account = await db.financialAccount.findFirst({
    where: data.groupId ? { id: data.accountId, groupId: data.groupId } : { id: data.accountId, userId },
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
      group: { select: { id: true, name: true } },
    },
  });

  return c.json(transaction, 201);
});

// Update transaction
app.patch("/:id", zValidator("json", UpdateTransactionSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await db.transaction.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Transação não encontrada" }, 404);
  const canEdit =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canEdit) return c.json({ error: "Transação não encontrada" }, 404);

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
      group: { select: { id: true, name: true } },
    },
  });

  return c.json(transaction);
});

// Delete transaction
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.transaction.findFirst({ where: { id } });
  if (!existing) return c.json({ error: "Transação não encontrada" }, 404);
  const canDelete =
    existing.userId === userId ||
    (existing.groupId && (await hasGroupRole(userId, existing.groupId, ["owner", "admin"])));
  if (!canDelete) return c.json({ error: "Transação não encontrada" }, 404);

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
