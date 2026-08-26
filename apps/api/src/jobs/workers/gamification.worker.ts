import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { generateWeeklyRecap } from "../../lib/gamification";
import { gamificationQueue } from "../queues";

type WeeklyRecapJob = { userId: string };

export const gamificationWorker = new Worker(
  "gamification",
  async (job: Job) => {
    switch (job.name) {
      case "fan-out-weekly-recap": {
        const profiles = await db.gamificationProfile.findMany({
          select: { userId: true },
        });
        for (const { userId } of profiles) {
          await gamificationQueue.add("weekly-recap", { userId });
        }
        return;
      }
      case "weekly-recap": {
        const { userId } = job.data as WeeklyRecapJob;
        await generateWeeklyRecap(userId);
        return;
      }
      default:
        console.warn(`[gamification] Job desconhecido: ${job.name}`);
    }
  },
  { connection: redis, concurrency: 3 }
);

gamificationWorker.on("failed", (job, err) => {
  console.error(`[gamification] Job ${job?.id} (${job?.name}) falhou:`, err.message);
});
