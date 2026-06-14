import Anthropic from "@anthropic-ai/sdk";
import { ParsedExpenseSchema, type ParsedExpense } from "@finances/validations";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um assistente financeiro especializado em interpretar mensagens de usuários brasileiros sobre suas finanças pessoais.

Sua tarefa é extrair informações estruturadas de mensagens em português, incluindo gírias e expressões informais brasileiras.

Exemplos de como os usuários falam:
- "gastei 50 reais no mercado ontem" → despesa, R$50, supermercado, data de ontem
- "recebi salário de 3200" → receita, R$3.200, salário
- "paguei 89,90 no spotify" → despesa, R$89,90, streaming
- "uber 23 conto agora pouco" → despesa, R$23, transporte/uber, hoje
- "botei 150 de gasolina" → despesa, R$150, combustível
- "aluguel 1800 dia 10" → despesa, R$1.800, moradia, dia 10 do mês atual
- "quanto gastei essa semana?" → consulta de gastos da semana
- "qual meu saldo?" → consulta de saldo
- "resumo do mês" → resumo mensal

REGRAS:
1. Valores: converter para número (1.234,56 → 1234.56; "50 conto" → 50; "3k" → 3000)
2. Datas relativas: usar a data atual fornecida como referência
3. Confidence: 0.0 a 1.0 (acima de 0.7 = confiante; abaixo = pedir confirmação)
4. Se não entender, retornar intent "unknown"
5. categoryHint: nome em português da categoria mais provável (sem acentos preferível)`;

const PARSE_TOOL: Anthropic.Tool = {
  name: "parse_financial_message",
  description: "Extrai informações financeiras estruturadas de uma mensagem em português",
  input_schema: {
    type: "object" as const,
    properties: {
      intent: {
        type: "string",
        enum: [
          "record_expense",
          "record_income",
          "query",
          "list_balance",
          "monthly_summary",
          "unknown",
        ],
        description: "Intenção principal da mensagem",
      },
      amount: {
        type: "number",
        description: "Valor monetário em reais (positivo)",
      },
      currency: {
        type: "string",
        default: "BRL",
      },
      description: {
        type: "string",
        description: "Descrição curta da transação",
      },
      categoryHint: {
        type: "string",
        description:
          "Categoria provável (ex: supermercado, uber, netflix, aluguel, salario)",
      },
      date: {
        type: "string",
        description: "Data no formato YYYY-MM-DD",
      },
      confidence: {
        type: "number",
        description: "Confiança na interpretação (0.0 a 1.0)",
      },
      queryType: {
        type: "string",
        enum: [
          "spending_by_category",
          "spending_by_period",
          "account_balance",
          "general",
        ],
      },
    },
    required: ["intent", "confidence"],
  },
};

export async function parseExpenseMessage(
  text: string,
  today: string = new Date().toISOString().split("T")[0] ?? ""
): Promise<ParsedExpense> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Data de hoje: ${today}\n\nMensagem do usuário: "${text}"`,
      },
    ],
    tools: [PARSE_TOOL],
    tool_choice: { type: "any" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      intent: "unknown",
      confidence: 0,
      rawText: text,
      currency: "BRL",
    };
  }

  const parsed = ParsedExpenseSchema.safeParse({
    ...(toolUse.input as Record<string, unknown>),
    rawText: text,
  });

  if (!parsed.success) {
    return {
      intent: "unknown",
      confidence: 0,
      rawText: text,
      currency: "BRL",
    };
  }

  return parsed.data;
}
