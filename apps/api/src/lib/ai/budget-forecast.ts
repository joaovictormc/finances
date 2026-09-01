import { db } from "@finances/db";
import { sendNotification } from "../notifications";
import { notifyGroupMembers } from "../groups";

export async function checkBudgetForecasts(userId: string) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const daysInMonth = endDate.getDate();
  const daysElapsed = today.getDate();

  const budgets = await db.budget.findMany({
    where: {
      userId,
      period: "monthly",
      startDate: { lte: endDate },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    include: { category: { select: { name: true } } },
  });

  if (budgets.length === 0) return [];

  const existingForecasts = await db.aiInsight.findMany({
    where: { userId, type: "budget_forecast", periodStart: startDate },
    select: { data: true },
  });
  const alertedBudgetIds = new Set(
    existingForecasts
      .map((i) => (i.data as { budgetId?: string } | null)?.budgetId)
      .filter((id): id is string => !!id)
  );

  const createdInsights: string[] = [];

  for (const budget of budgets) {
    if (alertedBudgetIds.has(budget.id)) continue;

    const spentAgg = await db.transaction.aggregate({
      where: {
        userId,
        type: "expense",
        isIgnored: false,
        date: { gte: startDate, lte: today },
        ...(budget.categoryId && { categoryId: budget.categoryId }),
      },
      _sum: { amount: true },
    });

    const spentSoFar = Number(spentAgg._sum.amount ?? 0);
    const budgetAmount = Number(budget.amount);
    const projected = daysElapsed > 0 ? (spentSoFar / daysElapsed) * daysInMonth : spentSoFar;
    const threshold = Number(budget.alertThreshold) * budgetAmount;

    if (projected < threshold || budgetAmount <= 0) continue;

    const categoryName = budget.category?.name ?? "geral";
    const willExceedBy = projected - budgetAmount;
    const title =
      willExceedBy > 0
        ? `No ritmo atual, "${budget.name}" vai ultrapassar o limite`
        : `Orçamento "${budget.name}" perto do limite`;
    const body =
      willExceedBy > 0
        ? `Considerando seus gastos em ${categoryName} até agora (R$ ${spentSoFar
            .toFixed(2)
            .replace(".", ",")}), a projeção é fechar o mês em R$ ${projected
            .toFixed(2)
            .replace(".", ",")} — R$ ${willExceedBy.toFixed(2).replace(".", ",")} acima do limite de R$ ${budgetAmount
            .toFixed(2)
            .replace(".", ",")}.`
        : `Você já gastou R$ ${spentSoFar.toFixed(2).replace(".", ",")} de R$ ${budgetAmount
            .toFixed(2)
            .replace(".", ",")} em ${categoryName} neste mês.`;

    const insight = await db.aiInsight.create({
      data: {
        userId,
        type: "budget_forecast",
        title,
        body,
        data: { budgetId: budget.id, spentSoFar, projected, budgetAmount },
        severity: willExceedBy > 0 ? "warning" : "info",
        periodStart: startDate,
        periodEnd: endDate,
      },
    });
    createdInsights.push(insight.id);

    const notificationInput = {
      type: "budget_alert",
      link: "/budgets",
      title,
      body,
      emailTemplate: "budget-alert",
      emailData: {
        budgetName: budget.name,
        categoryName,
        percentUsed: Math.round((projected / budgetAmount) * 100),
        spent: `R$ ${spentSoFar.toFixed(2).replace(".", ",")}`,
        limit: `R$ ${budgetAmount.toFixed(2).replace(".", ",")}`,
      },
    };

    if (budget.groupId) {
      await notifyGroupMembers(budget.groupId, notificationInput);
    } else {
      await sendNotification(userId, notificationInput);
    }
  }

  return createdInsights;
}
