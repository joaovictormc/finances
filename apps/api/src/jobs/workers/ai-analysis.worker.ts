import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { generateMonthlyInsight } from "../../lib/ai/financial-insights";
import { checkBudgetForecasts } from "../../lib/ai/budget-forecast";
import { aiAnalysisQueue } from "../queues";

type GenerateMonthlyInsightJob = { userId: string };
type CheckBudgetForecastJob = { userId: string };

// UserProfile só existe para usuários que já vincularam Telegram ou completaram
// onboarding — sem profile, aiInsightsEnabled vale o default do schema (true).
async function getAiEnabledUserIds(): Promise<string[]> {
  const users = await db.user.findMany({ select: { id: true, profile: { select: { aiInsightsEnabled: true } } } });
  return users.filter((u) => u.profile?.aiInsightsEnabled !== false).map((u) => u.id);
}

export const aiAnalysisWorker = new Worker(
  "ai-analysis",
  async (job: Job) => {
    switch (job.name) {
      case "fan-out-monthly-insights": {
        for (const userId of await getAiEnabledUserIds()) {
          await aiAnalysisQueue.add("generate-monthly-insight", { userId });
        }
        return;
      }
      case "generate-monthly-insight": {
        const { userId } = job.data as GenerateMonthlyInsightJob;
        await generateMonthlyInsight(userId);
        return;
      }
      case "fan-out-budget-forecasts": {
        for (const userId of await getAiEnabledUserIds()) {
          await aiAnalysisQueue.add("check-budget-forecast", { userId });
        }
        return;
      }
      case "check-budget-forecast": {
        const { userId } = job.data as CheckBudgetForecastJob;
        await checkBudgetForecasts(userId);
        return;
      }
      default:
        console.warn(`[ai-analysis] Job desconhecido: ${job.name}`);
    }
  },
  { connection: redis, concurrency: 3 }
);

aiAnalysisWorker.on("failed", (job, err) => {
  console.error(`[ai-analysis] Job ${job?.id} (${job?.name}) falhou:`, err.message);
});
