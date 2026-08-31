import { db } from "@finances/db";
import type { CompletionUsage } from "groq-sdk/resources/completions";

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

export async function updateAiSettings(data: {
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
  model: string;
  usage?: CompletionUsage | null;
}) {
  await db.aiUsageLog.create({
    data: {
      userId: input.userId,
      feature: input.feature,
      model: input.model,
      promptTokens: input.usage?.prompt_tokens,
      completionTokens: input.usage?.completion_tokens,
    },
  });
}
