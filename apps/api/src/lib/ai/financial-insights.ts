import { db } from "@finances/db";
import { groq } from "./groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "./ai-settings";
import { sendNotification } from "../notifications";

const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal que escreve resumos mensais curtos e diretos em português brasileiro.

Receberá dados agregados das finanças do usuário nos últimos 30 dias e deve responder APENAS com um objeto JSON (sem markdown, sem texto adicional):
{
  "title": string (título curto, ex: "Resumo de junho: você economizou 12% da renda"),
  "body": string (2-4 frases, tom direto e encorajador, cite números em R$ com vírgula decimal),
  "severity": "info" | "warning" | "success" | "critical"
}

Regras:
- "success": taxa de poupança >= 15% ou queda de gastos relevante vs mês anterior
- "warning": gastos subiram >15% vs mês anterior ou taxa de poupança negativa
- "critical": taxa de poupança muito negativa (gastou bem mais do que ganhou)
- "info": demais casos
- Cite a categoria de maior gasto pelo nome`;

export async function generateMonthlyInsight(userId: string) {
  const settings = await getAiSettings();
  if (!settings.monthlyInsightsEnabled || !(await isWithinUsageLimit(settings))) return null;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 30);
  const prevStart = new Date(periodStart);
  prevStart.setDate(prevStart.getDate() - 30);

  const [transactions, prevExpenseAgg] = await Promise.all([
    db.transaction.findMany({
      where: { userId, isIgnored: false, date: { gte: periodStart, lte: periodEnd } },
      include: { category: { select: { name: true } } },
    }),
    db.transaction.aggregate({
      where: { userId, isIgnored: false, type: "expense", date: { gte: prevStart, lt: periodStart } },
      _sum: { amount: true },
    }),
  ]);

  if (transactions.length === 0) return null;

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const previousExpense = Number(prevExpenseAgg._sum.amount ?? 0);

  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const name = t.category?.name ?? "Sem categoria";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(t.amount));
  }
  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));

  const stats = {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    savingsRate: Math.round(savingsRate * 1000) / 1000,
    previousExpense: Math.round(previousExpense * 100) / 100,
    expenseChangePct:
      previousExpense > 0 ? Math.round(((expense - previousExpense) / previousExpense) * 1000) / 1000 : null,
    topCategories,
  };

  const response = await groq.chat.completions.create({
    model: settings.textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Dados dos últimos 30 dias:\n${JSON.stringify(stats)}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  await logAiUsage({ userId, feature: "monthly_insight", model: settings.textModel, usage: response.usage });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;

  let parsed: { title?: string; body?: string; severity?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const title = parsed.title ?? "Resumo financeiro do mês";
  const body = parsed.body ?? "Não foi possível gerar o resumo completo deste mês.";
  const severity = ["info", "warning", "success", "critical"].includes(parsed.severity ?? "")
    ? (parsed.severity as string)
    : "info";

  const insight = await db.aiInsight.create({
    data: {
      userId,
      type: "monthly_summary",
      title,
      body,
      data: stats,
      severity,
      periodStart,
      periodEnd,
    },
  });

  await sendNotification(userId, {
    type: "insight_ready",
    title,
    body,
    emailData: { title, body },
  });

  return insight;
}
