import { Worker } from "bullmq";
import { quietRedisErrors, redis } from "../../lib/redis";
import { broadcastRelease } from "../../lib/changelog";

type BroadcastJob = { releaseId: string; inApp: boolean; email: boolean };

/**
 * Avisos para todos os usuários. Fora da requisição do admin: com muitos
 * usuários, gravar as notificações e enfileirar os e-mails leva tempo.
 */
export const broadcastWorker = new Worker<BroadcastJob>(
  "broadcast",
  async (job) => {
    if (job.name !== "changelog") return;
    const { users, emails } = await broadcastRelease(job.data.releaseId, {
      inApp: job.data.inApp,
      email: job.data.email,
    });
    console.log(`[broadcast] novidade ${job.data.releaseId}: ${users} usuários, ${emails} e-mails enfileirados`);
  },
  { connection: redis, concurrency: 1 }
);

quietRedisErrors(broadcastWorker);
