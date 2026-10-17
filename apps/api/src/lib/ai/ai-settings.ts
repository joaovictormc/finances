import { db } from "@finances/db";
import type { ChatUsage } from "./chat";
import { isAiProviderId, type AiProviderId } from "./providers";

const SINGLETON_ID = "singleton";

export type AiFeature =
  | "monthly_insight"
  | "nl_query"
  | "category_suggestion"
  | "receipt_scan"
  | "assistant";

export async function getAiSettings() {
  return db.aiSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

/**
 * Três funções, cada uma com provedor e modelo próprios: texto (insights,
 * perguntas e sugestão de categoria), imagem (leitura de cupom) e assistente.
 */
export type AiSlot = "text" | "vision" | "assistant";

type SettingsRow = Awaited<ReturnType<typeof getAiSettings>>;

export function slotModel(settings: SettingsRow, slot: AiSlot): { provider: AiProviderId; model: string } {
  const provider = settings[`${slot}Provider`];
  return {
    // Valor fora da lista (edição manual no banco) cai na Groq, que é o padrão.
    provider: isAiProviderId(provider) ? provider : "groq",
    model: settings[`${slot}Model`],
  };
}

export async function updateAiSettings(data: {
  textProvider?: AiProviderId;
  visionProvider?: AiProviderId;
  assistantProvider?: AiProviderId;
  textModel?: string;
  visionModel?: string;
  assistantModel?: string;
  assistantEnabled?: boolean;
  monthlyInsightsEnabled?: boolean;
  nlQueryEnabled?: boolean;
  categorySuggestionEnabled?: boolean;
  receiptScanEnabled?: boolean;
  monthlyTokenLimit?: number | null;
  monthlyBudgetUsd?: number | null;
}) {
  return db.aiSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });
}

/** Soma de tokens (prompt+completion) usados desde o início do mês corrente. */
export async function getMonthlyTokenUsage(): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const agg = await db.aiUsageLog.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { promptTokens: true, completionTokens: true },
  });

  return (agg._sum.promptTokens ?? 0) + (agg._sum.completionTokens ?? 0);
}

/** true se ainda há orçamento de tokens no mês (ou se o plano é ilimitado). */
export async function isWithinUsageLimit(
  settings: Pick<Awaited<ReturnType<typeof getAiSettings>>, "monthlyTokenLimit">
): Promise<boolean> {
  if (settings.monthlyTokenLimit == null) return true;
  const used = await getMonthlyTokenUsage();
  return used < settings.monthlyTokenLimit;
}

export async function logAiUsage(input: {
  userId?: string;
  feature: AiFeature;
  provider: AiProviderId;
  model: string;
  usage?: ChatUsage | null;
}) {
  await db.aiUsageLog.create({
    data: {
      userId: input.userId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      promptTokens: input.usage?.promptTokens,
      completionTokens: input.usage?.completionTokens,
    },
  });
}
