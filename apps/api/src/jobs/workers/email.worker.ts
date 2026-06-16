import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { deliverEmail, type EmailJob } from "../../lib/email";

// Consome a fila "email" (alimentada por sendEmail) e entrega via Brevo.
export const emailWorker = new Worker<EmailJob>(
  "email",
  async (job: Job<EmailJob>) => {
    await deliverEmail(job.data);
  },
  { connection: redis, concurrency: 5 }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[email] Job ${job?.id} (${job?.data.template}) falhou:`, err.message);
});
