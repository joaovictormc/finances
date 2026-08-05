import { groq } from "./groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "./ai-settings";
import type { CategorySuggestion } from "@finances/validations";

type SuggestableTransaction = {
  id: string;
  description: string;
  amount: number;
  type: string;
};

type SuggestableCategory = { id: string; name: string; type: string };

const SYSTEM_PROMPT = `Você é um assistente financeiro que sugere categorias para transações
bancárias de usuários brasileiros. Você recebe uma lista de transações e uma lista de
categorias disponíveis (com id, nome e tipo). Para cada transação, escolha a categoria mais
provável dentre as fornecidas — NUNCA invente uma categoria que não esteja na lista, e a
categoria escolhida precisa ter o mesmo "type" da transação.

Responda APENAS com um objeto JSON (sem markdown, sem texto adicional) no formato:
{
  "suggestions": [
    { "transactionId": string, "categoryId": string | null, "confidence": number (0.0 a 1.0), "merchantName": string opcional }
  ]
}

Se nenhuma categoria da lista parecer adequada, retorne categoryId: null e confidence: 0.`;

/**
 * Sugere uma categoria por transação via IA, sem gravar nada em `categoryId`
 * — só cacheia confidence/merchantName como metadata. O usuário decide se
 * aplica (ver docs/ajustes-pos-teste.md, "Sugestão de categorias com IA").
 */
export async function suggestCategories(
  transactions: SuggestableTransaction[],
  categories: SuggestableCategory[],
  userId?: string
): Promise<CategorySuggestion[]> {
  const settings = await getAiSettings();
  if (!settings.categorySuggestionEnabled || !(await isWithinUsageLimit(settings))) {
    return transactions.map((t) => ({
      transactionId: t.id,
      categoryId: null,
      categoryName: null,
      confidence: 0,
    }));
  }

  const response = await groq.chat.completions.create({
    model: settings.textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          categorias: categories.map((c) => ({ id: c.id, nome: c.name, tipo: c.type })),
          transacoes: transactions.map((t) => ({
            id: t.id,
            descricao: t.description,
            valor: t.amount,
            tipo: t.type,
          })),
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });
  await logAiUsage({
    userId,
    feature: "category_suggestion",
    model: settings.textModel,
    usage: response.usage,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    return transactions.map((t) => ({
      transactionId: t.id,
      categoryId: null,
      categoryName: null,
      confidence: 0,
    }));
  }

  let parsed: { suggestions?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const byId = new Map((parsed.suggestions ?? []).map((s) => [String(s.transactionId), s]));

  return transactions.map((t) => {
    const suggestion = byId.get(t.id);
    const categoryId = typeof suggestion?.categoryId === "string" ? suggestion.categoryId : null;
    const category = categoryId ? categoryMap.get(categoryId) : undefined;
    // categoria sugerida precisa existir de fato na lista permitida e bater o type,
    // senão descarta a sugestão em vez de confiar cegamente no que o modelo respondeu.
    if (!category || category.type !== t.type) {
      return { transactionId: t.id, categoryId: null, categoryName: null, confidence: 0 };
    }
    const confidence =
      typeof suggestion?.confidence === "number"
        ? Math.max(0, Math.min(1, suggestion.confidence))
        : 0;
    return {
      transactionId: t.id,
      categoryId: category.id,
      categoryName: category.name,
      confidence,
      merchantName:
        typeof suggestion?.merchantName === "string" ? suggestion.merchantName : undefined,
    };
  });
}
