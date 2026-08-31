import { db } from "@finances/db";
import type Groq from "groq-sdk";

/**
 * Ferramentas de consulta financeira expostas aos modelos da Groq via tool
 * calling. Vivem aqui, e não dentro de uma rota, porque têm dois consumidores:
 * a pergunta avulsa (`POST /api/ai/query`) e o assistente com histórico
 * (`POST /api/assistant/conversations/:id/messages`).
 *
 * Toda função filtra por `userId` — nenhuma ferramenta enxerga dado de outro
 * usuário, mesmo que o modelo peça.
 */
export const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
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
      description:
        "Retorna a situação dos orçamentos do mês atual: limite, gasto até agora e percentual usado",
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
      description:
        "Retorna as contas recorrentes ativas (assinaturas, boletos) e sua próxima data de vencimento e valor esperado",
      parameters: { type: "object", properties: {} },
    },
  },
];

/**
 * Nomes válidos — usados para validar a seleção de ferramentas de um agente.
 * O `ChatCompletionTool` do SDK tipa `function` como opcional (é união com
 * outros tipos de tool), daí o filtro.
 */
export const TOOL_NAMES = TOOLS.map((tool) => tool.function?.name).filter(
  (name): name is string => Boolean(name)
);

/** Rótulos em PT-BR para a tela de configuração de agentes. */
export const TOOL_LABELS: Record<string, string> = {
  get_spending_by_category: "Gastos por categoria",
  get_account_balance: "Saldo das contas",
  get_budget_status: "Situação dos orçamentos",
  get_monthly_summary: "Resumo mensal",
  get_upcoming_bills: "Contas a vencer",
};

/**
 * Recorta o conjunto de ferramentas para um agente. Lista vazia = todas, que é
 * o padrão de um agente recém-criado e do assistente sem agente selecionado.
 */
export function selectTools(enabledTools: string[]): Groq.Chat.Completions.ChatCompletionTool[] {
  if (enabledTools.length === 0) return TOOLS;
  return TOOLS.filter((tool) => tool.function && enabledTools.includes(tool.function.name));
}

async function getSpendingByCategory(userId: string, startDate: string, endDate: string) {
  const result = await db.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "expense",
      isIgnored: false,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    _sum: { amount: true },
  });

  const categoryIds = result.map((r) => r.categoryId).filter((id): id is string => id !== null);
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
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

export async function executeTool(userId: string, name: string, args: Record<string, unknown>) {
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

/**
 * Contexto de data para o prompt. O modelo não sabe que dia é hoje e, sem isto,
 * erra o mês nas perguntas relativas ("este mês", "mês passado").
 */
export function buildDateContext(): string {
  const today = new Date();
  const isoDate = today.toISOString().split("T")[0];
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  return `Hoje é ${isoDate}. Quando a pergunta mencionar "este mês", "o mês" ou "mês atual" sem especificar qual, use SEMPRE ano=${currentYear} e mês=${currentMonth} (o mês em curso, não o mês anterior). Quando mencionar "próximo mês" para despesas futuras, contas ou boletos a pagar, use a ferramenta get_upcoming_bills em vez de get_budget_status ou get_monthly_summary — essas só cobrem o mês atual e meses já encerrados, não lançamentos futuros.`;
}
