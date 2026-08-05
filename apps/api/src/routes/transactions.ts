import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finances/db";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  BulkCategorizeTransactionsSchema,
  SuggestCategoriesSchema,
  TransactionFiltersSchema,
} from "@finances/validations";
import { suggestCategories } from "../lib/ai/category-suggester";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getUserGroupIds, hasGroupRole } from "../lib/groups";
import { getHistoryCutoffDate } from "../lib/plan-limits";
import { parseCsvTransactions } from "../lib/import/csv-parser";
import { parseOfxTransactions } from "../lib/import/ofx-parser";
import { validateImportFileBatch } from "../lib/import/import-limits";
import { parseMonthlyReportPeriod } from "../lib/report-period";
import { redis } from "../lib/redis";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// Categoria de sistema aplicada quando o parser de import detecta que uma
// linha é o pagamento da própria fatura de cartão (heurística em
// lib/import/credit-card-payment.ts) — cacheada em memória do processo pois
// é uma categoria fixa do seed, não muda em runtime.
let creditCardPaymentCategoryIdCache: string | null | undefined;
async function getCreditCardPaymentCategoryId(): Promise<string | null> {
  if (creditCardPaymentCategoryIdCache !== undefined) return creditCardPaymentCategoryIdCache;
  const category = await db.category.findFirst({
    where: { isSystem: true, type: "transfer", name: "Pagamento de Fatura de Cartão" },
    select: { id: true },
  });
  creditCardPaymentCategoryIdCache = category?.id ?? null;
  return creditCardPaymentCategoryIdCache;
}

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

  const historyCutoff = await getHistoryCutoffDate(userId);
  const requestedStart = startDate ? new Date(startDate) : null;
  const effectiveStart =
    historyCutoff && requestedStart
      ? new Date(Math.max(historyCutoff.getTime(), requestedStart.getTime()))
      : historyCutoff ?? requestedStart;

  const where = {
    AND: [ownershipFilter, scopeFilter],
    ...(effectiveStart && { date: { gte: effectiveStart } }),
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

app.post("/import/batch", async (c) => {
  const userId = c.get("userId");
  try {
    const rateLimitKey = `rate-limit:statement-import:${userId}`;
    const requests = await redis.incr(rateLimitKey);
    if (requests === 1) await redis.expire(rateLimitKey, 15 * 60);
    if (requests > 10) {
      return c.json({ error: "Muitas importações. Tente novamente mais tarde." }, 429);
    }
  } catch {
    // Redis indisponível não deve impedir o acesso aos próprios dados. Os
    // limites rígidos de tamanho e quantidade continuam sendo aplicados.
  }

  const formData = await c.req.raw.formData();
  const accountId = formData.get("accountId");
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  const paymentMethods = formData.getAll("paymentMethods").map(String);

  if (typeof accountId !== "string" || !accountId || files.length !== paymentMethods.length) {
    return c.json({ error: "Conta, arquivos e tipos de extrato são obrigatórios" }, 400);
  }

  try {
    validateImportFileBatch(files);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Lote inválido" }, 400);
  }

  const groupIds = await getUserGroupIds(userId);
  const account = await db.financialAccount.findFirst({
    where: { id: accountId, OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }] },
  });
  if (!account) return c.json({ error: "Conta não encontrada" }, 404);

  const results = [];
  for (const [index, file] of files.entries()) {
    const paymentMethod = paymentMethods[index] === "credit" ? "credit" : "debit";
    try {
      const text = await file.text();
      const isOfx = file.name.toLowerCase().endsWith(".ofx") || text.includes("<OFX>");
      const rows = isOfx ? parseOfxTransactions(text) : parseCsvTransactions(text);
      if (rows.length === 0) throw new Error("Nenhuma transação válida encontrada");

      const creditCardPaymentCategoryId = rows.some((r) => r.type === "transfer")
        ? await getCreditCardPaymentCategoryId()
        : null;

      const created = await db.transaction.createMany({
        data: rows.map((row) => ({
          userId,
          accountId: account.id,
          groupId: account.groupId,
          type: row.type,
          categoryId: row.type === "transfer" ? creditCardPaymentCategoryId : undefined,
          paymentMethod,
          amount: row.amount,
          description: row.description,
          date: new Date(row.date),
          source: "import" as const,
          externalId: row.externalId,
        })),
        skipDuplicates: true,
      });

      results.push({
        fileName: file.name,
        status: "success" as const,
        imported: created.count,
        duplicates: rows.length - created.count,
        totalInFile: rows.length,
      });
    } catch (error) {
      results.push({
        fileName: file.name,
        status: "error" as const,
        imported: 0,
        duplicates: 0,
        totalInFile: 0,
        error: error instanceof Error ? error.message : "Arquivo inválido",
      });
    }
  }

  if (results.some((result) => result.status === "success")) {
    await db.financialAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  return c.json(
    {
      imported: results.reduce((sum, result) => sum + result.imported, 0),
      filesProcessed: results.length,
      results,
    },
    201
  );
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

  // A restrição "crédito só em conta com cartão" antes só existia na tela
  // (useEffect); uma chamada direta à API conseguia burlar. Reforça aqui.
  if (data.paymentMethod === "credit" && !account.hasCreditCard) {
    return c.json({ error: "Esta conta não tem cartão de crédito habilitado" }, 400);
  }

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

app.patch("/bulk-category", zValidator("json", BulkCategorizeTransactionsSchema), async (c) => {
  const userId = c.get("userId");
  const { transactionIds, categoryId } = c.req.valid("json");

  const category = await db.category.findFirst({
    where: { id: categoryId, OR: [{ isSystem: true }, { userId }] },
    select: { id: true, type: true },
  });
  if (!category) return c.json({ error: "Categoria não encontrada" }, 404);

  const transactions = await db.transaction.findMany({
    where: { id: { in: transactionIds } },
    select: { id: true, userId: true, groupId: true, type: true },
  });

  if (transactions.length !== transactionIds.length) {
    return c.json({ error: "Uma ou mais transações não foram encontradas" }, 404);
  }

  const groupIds = [
    ...new Set(transactions.map((transaction) => transaction.groupId).filter(Boolean) as string[]),
  ];
  const groupPermissions = new Map(
    await Promise.all(
      groupIds.map(async (groupId) => [
        groupId,
        await hasGroupRole(userId, groupId, ["owner", "admin"]),
      ] as const)
    )
  );

  const canEditAll = transactions.every(
    (transaction) =>
      (transaction.groupId === null && transaction.userId === userId) ||
      (transaction.groupId !== null && groupPermissions.get(transaction.groupId) === true)
  );
  if (!canEditAll) {
    return c.json({ error: "Uma ou mais transações não foram encontradas" }, 404);
  }

  if (transactions.some((transaction) => transaction.type !== category.type)) {
    return c.json({ error: "A categoria deve ter o mesmo tipo das transações" }, 400);
  }

  const result = await db.transaction.updateMany({
    where: { id: { in: transactionIds } },
    data: { categoryId: category.id },
  });

  return c.json({ updated: result.count });
});

// Sugere categoria por IA para as transações informadas — não aplica nada,
// devolve só a sugestão; o cliente decide se chama /bulk-category ou
// PATCH /:id para confirmar (ver docs/ajustes-pos-teste.md).
app.post("/suggest-categories", zValidator("json", SuggestCategoriesSchema), async (c) => {
  const userId = c.get("userId");
  const { transactionIds } = c.req.valid("json");
  const groupIds = await getUserGroupIds(userId);

  const transactions = await db.transaction.findMany({
    where: {
      id: { in: transactionIds },
      OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }],
    },
    select: { id: true, description: true, amount: true, type: true },
  });
  if (transactions.length === 0) {
    return c.json({ error: "Nenhuma transação encontrada" }, 404);
  }

  const categories = await db.category.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    select: { id: true, name: true, type: true },
  });

  const suggestions = await suggestCategories(
    transactions.map((t) => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
    })),
    categories,
    userId
  );

  // Cache leve de confidence/merchantName pra não custar outra chamada de IA
  // se o usuário só recarregar a tela — não grava categoryId (é sugestão, não aplicação).
  await Promise.all(
    suggestions
      .filter((s) => s.confidence > 0)
      .map((s) =>
        db.transaction.update({
          where: { id: s.transactionId },
          data: { aiCategoryConfidence: s.confidence, aiMerchantName: s.merchantName },
        })
      )
  );

  return c.json({ suggestions });
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

  const effectivePaymentMethod = data.paymentMethod ?? existing.paymentMethod;
  if (effectivePaymentMethod === "credit") {
    const effectiveAccountId = data.accountId ?? existing.accountId;
    const account = await db.financialAccount.findFirst({ where: { id: effectiveAccountId } });
    if (!account?.hasCreditCard) {
      return c.json({ error: "Esta conta não tem cartão de crédito habilitado" }, 400);
    }
  }

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

  let period;
  try {
    period = parseMonthlyReportPeriod(year, month);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Período inválido" }, 400);
  }

  const [income, expense, byCategory] = await Promise.all([
    db.transaction.aggregate({
      where: {
        userId,
        type: "income",
        date: { gte: period.start, lt: period.endExclusive },
        isIgnored: false,
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: {
        userId,
        type: "expense",
        date: { gte: period.start, lt: period.endExclusive },
        isIgnored: false,
      },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "expense",
        date: { gte: period.start, lt: period.endExclusive },
        isIgnored: false,
      },
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
    year: period.year,
    month: period.month,
    income: incomeAmount,
    expense: expenseAmount,
    balance: incomeAmount - expenseAmount,
    byCategory: byCategory.map((r) => ({
      category: r.categoryId ? catMap[r.categoryId] : null,
      total: Number(r._sum.amount ?? 0),
    })),
  });
});

// Import de extrato bancário (CSV ou OFX) — cria transações em lote, ignorando duplicatas
// (mesma combinação externalId+accountId já existente, via @@unique do schema).
app.post("/import", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.parseBody();
  const file = body.file;
  const accountId = body.accountId;
  const paymentMethod = body.paymentMethod === "credit" ? "credit" : "debit";

  if (!(file instanceof File) || typeof accountId !== "string" || !accountId) {
    return c.json({ error: "Envie um arquivo (file) e o accountId da conta" }, 400);
  }

  const groupIds = await getUserGroupIds(userId);
  const account = await db.financialAccount.findFirst({
    where: { id: accountId, OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }] },
  });
  if (!account) return c.json({ error: "Conta não encontrada" }, 404);

  const text = await file.text();
  const isOfx = file.name.toLowerCase().endsWith(".ofx") || text.includes("<OFX>");

  let rows;
  try {
    rows = isOfx ? parseOfxTransactions(text) : parseCsvTransactions(text);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Arquivo inválido" }, 400);
  }

  if (rows.length === 0) {
    return c.json({ error: "Nenhuma transação válida encontrada no arquivo" }, 400);
  }

  const creditCardPaymentCategoryId = rows.some((r) => r.type === "transfer")
    ? await getCreditCardPaymentCategoryId()
    : null;

  const result = await db.transaction.createMany({
    data: rows.map((row) => ({
      userId,
      accountId: account.id,
      groupId: account.groupId,
      type: row.type,
      categoryId: row.type === "transfer" ? creditCardPaymentCategoryId : undefined,
      paymentMethod,
      amount: row.amount,
      description: row.description,
      date: new Date(row.date),
      source: "import" as const,
      externalId: row.externalId,
    })),
    skipDuplicates: true,
  });

  await db.financialAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return c.json({ imported: result.count, totalInFile: rows.length }, 201);
});

export default app;
