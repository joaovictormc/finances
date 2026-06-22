import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getUserGroupIds } from "../lib/groups";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/annual", async (c) => {
  const userId = c.get("userId");
  const year = parseInt(c.req.query("year") ?? new Date().getFullYear().toString());

  const [user, groupIds] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    getUserGroupIds(userId),
  ]);

  const ownershipFilter = { OR: [{ userId, groupId: null }, { groupId: { in: groupIds } }] };
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const transactions = await db.transaction.findMany({
    where: { AND: [ownershipFilter], date: { gte: startDate, lte: endDate }, isIgnored: false },
    select: { type: true, amount: true, date: true, categoryId: true },
  });

  const monthlyMap = new Map<number, { income: number; expense: number }>();
  for (let m = 1; m <= 12; m++) monthlyMap.set(m, { income: 0, expense: 0 });

  const categoryTotals = new Map<string, number>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    const month = tx.date.getMonth() + 1;
    const bucket = monthlyMap.get(month)!;

    if (tx.type === "income") {
      bucket.income += amount;
      totalIncome += amount;
    } else if (tx.type === "expense") {
      bucket.expense += amount;
      totalExpense += amount;
      if (tx.categoryId) {
        categoryTotals.set(tx.categoryId, (categoryTotals.get(tx.categoryId) ?? 0) + amount);
      }
    }
  }

  const categoryIds = [...categoryTotals.keys()];
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNameMap = new Map(categories.map((cat) => [cat.id, cat.name]));

  const topCategories = [...categoryTotals.entries()]
    .map(([categoryId, total]) => ({
      name: categoryNameMap.get(categoryId) ?? "Outros",
      total,
      percentage: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const monthlyTotals = [...monthlyMap.entries()]
    .map(([month, totals]) => ({ month, ...totals }))
    .sort((a, b) => a.month - b.month);

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { AnnualReportDocument } = await import("../lib/pdf/annual-report");

  const buffer = await renderToBuffer(
    AnnualReportDocument({
      userName: user?.name ?? "Usuário",
      year,
      monthlyTotals,
      topCategories,
      totalIncome,
      totalExpense,
    })
  );

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="relatorio-anual-${year}.pdf"`);
  return c.body(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
});

export default app;
