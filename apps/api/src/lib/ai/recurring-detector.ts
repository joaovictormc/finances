import { db } from "@finances/db";
import { sendNotification } from "../notifications";

type CandidateTx = {
  id: string;
  date: Date;
  amount: number;
  categoryId: string | null;
  accountId: string;
};

function normalizeMerchant(description: string, merchantName: string | null): string {
  const raw = merchantName ?? description;
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Janelas de tolerância: intervalo médio entre ocorrências dentro da faixa
// e baixa variação entre as datas indica recorrência real (não coincidência).
const FREQUENCY_WINDOWS: { frequency: string; min: number; max: number; maxSpread: number }[] = [
  { frequency: "weekly", min: 6, max: 8, maxSpread: 3 },
  { frequency: "monthly", min: 25, max: 35, maxSpread: 7 },
  { frequency: "annual", min: 355, max: 375, maxSpread: 10 },
];

export async function detectRecurringBills(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 120);

  const transactions = await db.transaction.findMany({
    where: { userId, type: "expense", isIgnored: false, date: { gte: since } },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      aiMerchantName: true,
      categoryId: true,
      accountId: true,
    },
    orderBy: { date: "asc" },
  });

  const groups = new Map<string, CandidateTx[]>();
  for (const t of transactions) {
    const key = normalizeMerchant(t.description, t.aiMerchantName);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push({ id: t.id, date: t.date, amount: Number(t.amount), categoryId: t.categoryId, accountId: t.accountId });
    groups.set(key, list);
  }

  const createdInsights: string[] = [];

  for (const [merchantPattern, group] of groups) {
    if (group.length < 2) continue;

    const dates = group.map((t) => t.date.getTime()).sort((a, b) => a - b);
    const diffsDays = dates.slice(1).map((t, i) => (t - dates[i]!) / (1000 * 60 * 60 * 24));
    const avgInterval = average(diffsDays);
    const spread = Math.max(...diffsDays) - Math.min(...diffsDays);

    const window = FREQUENCY_WINDOWS.find(
      (w) => avgInterval >= w.min && avgInterval <= w.max && spread <= w.maxSpread
    );
    if (!window) continue;

    const amounts = group.map((t) => t.amount);
    const avgAmount = average(amounts);
    const amountVariance = Math.max(...amounts) - Math.min(...amounts);
    const lastTx = group[group.length - 1]!;
    const nextDueDate = new Date(lastTx.date);
    nextDueDate.setDate(nextDueDate.getDate() + Math.round(avgInterval));

    const existing = await db.recurringBill.findFirst({
      where: { userId, merchantPattern },
    });

    let recurringBillId: string;
    if (existing) {
      await db.recurringBill.update({
        where: { id: existing.id },
        data: {
          lastPaidDate: lastTx.date,
          nextDueDate,
          expectedAmount: avgAmount,
          amountVariance,
        },
      });
      recurringBillId = existing.id;
    } else {
      const categoryId = group.some((t) => t.categoryId)
        ? mostCommon(group.map((t) => t.categoryId).filter((c): c is string => c !== null))
        : null;
      const accountId = mostCommon(group.map((t) => t.accountId));

      const created = await db.recurringBill.create({
        data: {
          userId,
          categoryId,
          accountId,
          name: merchantPattern,
          expectedAmount: avgAmount,
          amountVariance,
          frequency: window.frequency,
          dayOfMonth: window.frequency === "monthly" ? lastTx.date.getDate() : null,
          nextDueDate,
          lastPaidDate: lastTx.date,
          merchantPattern,
        },
      });
      recurringBillId = created.id;

      const insight = await db.aiInsight.create({
        data: {
          userId,
          type: "recurring_detected",
          title: `Detectamos uma cobrança recorrente: ${merchantPattern}`,
          body: `Identificamos ${group.length} pagamentos para "${merchantPattern}" em intervalos de aproximadamente ${Math.round(
            avgInterval
          )} dias, valor médio de R$ ${avgAmount.toFixed(2).replace(".", ",")}. Adicionamos como conta recorrente.`,
          severity: "info",
        },
      });
      createdInsights.push(insight.id);

      await sendNotification(userId, {
        type: "insight_ready",
        title: insight.title,
        body: insight.body,
      });
    }

    await db.transaction.updateMany({
      where: { id: { in: group.map((t) => t.id) }, recurringBillId: null },
      data: { recurringBillId },
    });
  }

  return createdInsights;
}
