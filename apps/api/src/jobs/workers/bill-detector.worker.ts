import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { detectRecurringBills } from "../../lib/ai/recurring-detector";
import { billDetectorQueue } from "../queues";

type DetectRecurringJob = { userId: string };

export const billDetectorWorker = new Worker(
  "bill-detector",
  async (job: Job) => {
    switch (job.name) {
      case "fan-out-detect-recurring": {
        const accounts = await db.financialAccount.findMany({
          where: { isArchived: false },
          select: { userId: true },
          distinct: ["userId"],
        });
        for (const { userId } of accounts) {
          await billDetectorQueue.add("detect-recurring", { userId });
        }
        return;
      }
      case "detect-recurring": {
        const { userId } = job.data as DetectRecurringJob;
        await detectRecurringBills(userId);
        return;
      }
      default:
        console.warn(`[bill-detector] Job desconhecido: ${job.name}`);
    }
  },
  { connection: redis, concurrency: 3 }
);

billDetectorWorker.on("failed", (job, err) => {
  console.error(`[bill-detector] Job ${job?.id} (${job?.name}) falhou:`, err.message);
});
