import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import type Groq from "groq-sdk";
import { groq, GROQ_TEXT_MODEL } from "../lib/ai/groq-client";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/insights", async (c) => {
  const userId = c.get("userId");
  const insights = await db.aiInsight.findMany({
    where: { userId, isDismissed: false },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });
  return c.json(insights);
});

app.patch("/insights/:id/dismiss", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.aiInsight.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Insight não encontrado" }, 404);

  await db.aiInsight.update({ where: { id }, data: { isDismissed: true, isRead: true } });
  return c.json({ success: true });
});

// ── Consultas em linguagem natural via tool-calling (Groq) ───────────────────

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_spending_by_category",
      description: "Retorna o total gasto por categoria em um período de datas",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Data inicial, formato YYYY-MM-DD" },
          endDate: { type: "string", description: "Data final, formato YYYY-MM-DD" },
        },
        required: ["startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Retorna o saldo (receitas - despesas) de cada conta financeira do usuário",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_status",
      description: "Retorna a situação dos orçamentos do mês atual: limite, gasto até agora e percentual usado",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_summary",
      description: "Retorna o total de receitas e despesas de um mês específico",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Ano, ex: 2026" },
          month: { type: "number", description: "Mês de 1 a 12" },
        },
        required: ["year", "month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_bills",
      description: "Retorna as contas recorrentes ativas (assinaturas, boletos) e sua próxima data de vencimento e valor esperado",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function getSpendingByCategory(userId: string, startDate: string, endDate: string) {
  const result = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, type: "expense", isIgnored: false, date: { gte: new Date(startDate), lte: new Date(endDate) } },
    _sum: { amount: true },
  });

  const categoryIds = result.map((r) => r.categoryId).filter((id): id is string => id !== null);
  const categories = await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return result.map((r) => ({
    category: r.categoryId ? nameById.get(r.categoryId) ?? "Desconhecida" : "Sem categoria",
    total: Number(r._sum.amount ?? 0),
  }));
}

async function getAccountBalance(userId: string) {
  const accounts = await db.financialAccount.findMany({
    where: { userId, isArchived: false },
    select: { id: true, name: true },
  });

  return Promise.all(
    accounts.map(async (account) => {
      const [income, expense] = await Promise.all([
        db.transaction.aggregate({
          where: { userId, accountId: account.id, type: "income", isIgnored: false },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { userId, accountId: account.id, type: "expense", isIgnored: false },
          _sum: { amount: true },
        }),
      ]);
      return {
        account: account.name,
        balance: Number(income._sum.amount ?? 0) - Number(expense._sum.amount ?? 0),
      };
    })
  );
}

async function getBudgetStatus(userId: string) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const budgets = await db.budget.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    include: { category: { select: { name: true } } },
  });

  return Promise.all(
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
      return {
        budget: budget.name,
        category: budget.category?.name ?? "geral",
        limit: budgetAmount,
        spent: spentAmount,
        percentUsed: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
      };
    })
  );
}

async function getMonthlySummary(userId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const [income, expense] = await Promise.all([
    db.transaction.aggregate({
      where: { userId, type: "income", isIgnored: false, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, type: "expense", isIgnored: false, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
  ]);

  return {
    income: Number(income._sum.amount ?? 0),
    expense: Number(expense._sum.amount ?? 0),
  };
}

async function getUpcomingBills(userId: string) {
  const bills = await db.recurringBill.findMany({
    where: { userId, isActive: true },
    orderBy: { nextDueDate: "asc" },
    select: { name: true, expectedAmount: true, nextDueDate: true, frequency: true },
  });

  return bills.map((b) => ({
    name: b.name,
    expectedAmount: Number(b.expectedAmount ?? 0),
    nextDueDate: b.nextDueDate?.toISOString().split("T")[0] ?? null,
    frequency: b.frequency,
  }));
}

async function executeTool(userId: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_spending_by_category":
      return getSpendingByCategory(userId, args.startDate as string, args.endDate as string);
    case "get_account_balance":
      return getAccountBalance(userId);
    case "get_budget_status":
      return getBudgetStatus(userId);
    case "get_monthly_summary":
      return getMonthlySummary(userId, args.year as number, args.month as number);
    case "get_upcoming_bills":
      return getUpcomingBills(userId);
    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}

function buildQuerySystemPrompt() {
  const today = new Date();
  const isoDate = today.toISOString().split("T")[0];
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  return `Você é um consultor financeiro pessoal que responde perguntas sobre as finanças do usuário em português brasileiro, de forma direta e com números formatados em R$ (vírgula decimal).

Use as ferramentas disponíveis para buscar os dados necessários antes de responder. Se a pergunta não tiver relação com finanças pessoais, responda educadamente que só pode ajudar com isso.

Hoje é ${isoDate}. Quando a pergunta mencionar "este mês", "o mês" ou "mês atual" sem especificar qual, use SEMPRE ano=${currentYear} e mês=${currentMonth} (o mês em curso, não o mês anterior). Quando mencionar "próximo mês" para despesas futuras, contas ou boletos a pagar, use a ferramenta get_upcoming_bills em vez de get_budget_status ou get_monthly_summary — essas só cobrem o mês atual e meses já encerrados, não lançamentos futuros.`;
}

const QuerySchema = z.object({ question: z.string().min(1).max(500) });

app.post("/query", zValidator("json", QuerySchema), async (c) => {
  const userId = c.get("userId");
  const { question } = c.req.valid("json");

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildQuerySystemPrompt() },
    { role: "user", content: question },
  ];

  for (let i = 0; i < 4; i++) {
    const response = await groq.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const message = response.choices[0]?.message;
    if (!message) break;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return c.json({ answer: message.content ?? "Não consegui gerar uma resposta." });
    }

    messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

    for (const call of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        // mantém args vazio se o modelo enviar argumentos inválidos
      }
      const result = await executeTool(userId, call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return c.json({ answer: "Não consegui concluir a análise. Tente reformular a pergunta." });
});

export default app;
