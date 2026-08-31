import { Queue } from "bullmq";
import { redis } from "../lib/redis";

const connection = redis;

export const emailQueue = new Queue("email", { connection });
export const botMessagesQueue = new Queue("bot-messages", { connection });
export const voiceTranscriptionQueue = new Queue("voice-transcription", {
  connection,
});
export const openFinanceSyncQueue = new Queue("open-finance-sync", {
  connection,
});
export const aiAnalysisQueue = new Queue("ai-analysis", { connection });
export const billDetectorQueue = new Queue("bill-detector", { connection });
export const gamificationQueue = new Queue("gamification", { connection });

export const allQueues = [
  emailQueue,
  openFinanceSyncQueue,
  aiAnalysisQueue,
  billDetectorQueue,
  gamificationQueue,
];
