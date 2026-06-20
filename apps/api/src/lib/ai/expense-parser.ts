import { groq, GROQ_TEXT_MODEL } from "./groq-client";
import { ParsedExpenseSchema, type ParsedExpense } from "@finances/validations";

const SYSTEM_PROMPT = `Você é um assistente financeiro especializado em interpretar mensagens de usuários brasileiros sobre suas finanças pessoais.

Sua tarefa é extrair informações estruturadas de mensagens em português, incluindo gírias e expressões informais brasileiras, e responder APENAS com um objeto JSON (sem markdown, sem texto adicional).

Formato do JSON de saída:
{
  "intent": "record_expense" | "record_income" | "query" | "list_balance" | "monthly_summary" | "unknown",
  "amount": number (opcional, valor em reais, positivo),
  "currency": "BRL",
  "description": string (opcional, descrição curta),
  "categoryHint": string (opcional, ex: "supermercado", "uber", "netflix", "aluguel", "salario"),
  "date": string (opcional, formato YYYY-MM-DD),
  "confidence": number (0.0 a 1.0),
  "queryType": "spending_by_category" | "spending_by_period" | "account_balance" | "general" (opcional)
}

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
2. Datas relativas: usar a data atual fornecida como referência. Retornar SEMPRE no formato YYYY-MM-DD
3. Confidence: 0.0 a 1.0 (acima de 0.7 = confiante; abaixo = pedir confirmação)
4. Se não entender, retornar intent "unknown" com confidence 0
5. categoryHint: nome em português da categoria mais provável (sem acentos preferível)`;

export async function parseExpenseMessage(
  text: string,
  today: string = new Date().toISOString().split("T")[0] ?? ""
): Promise<ParsedExpense> {
  const response = await groq.chat.completions.create({
    model: GROQ_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Data de hoje: ${today}\n\nMensagem do usuário: "${text}"` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    return { intent: "unknown", confidence: 0, rawText: text, currency: "BRL" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { intent: "unknown", confidence: 0, rawText: text, currency: "BRL" };
  }

  const parsed = ParsedExpenseSchema.safeParse({
    ...(json as Record<string, unknown>),
    rawText: text,
  });

  if (!parsed.success) {
    return { intent: "unknown", confidence: 0, rawText: text, currency: "BRL" };
  }

  return parsed.data;
}
