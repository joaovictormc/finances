import { Queue } from "bullmq";
import { redis } from "../lib/redis";

const connection = redis;

export const emailQueue = new Queue("email", { connection });
export const openFinanceSyncQueue = new Queue("open-finance-sync", {
  connection,
});
export const aiAnalysisQueue = new Queue("ai-analysis", { connection });
export const billDetectorQueue = new Queue("bill-detector", { connection });
export const gamificationQueue = new Queue("gamification", { connection });
export const billingQueue = new Queue("billing", { connection });

export const allQueues = [
  emailQueue,
  openFinanceSyncQueue,
  aiAnalysisQueue,
  billDetectorQueue,
  gamificationQueue,
  billingQueue,
];
