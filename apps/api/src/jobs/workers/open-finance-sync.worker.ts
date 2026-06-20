import { Worker, type Job } from "bullmq";
import { redis } from "../../lib/redis";
import { db } from "@finances/db";
import { fetchTransactions, type PluggyTransaction } from "../../lib/pluggy/client";

type SyncJob = {
  financialAccountId: string;
  pluggyAccountId: string | null;
};

function mapTransactionType(t: PluggyTransaction): string {
  // Pluggy inverte a semântica de `type` em contas de cartão de crédito
  // (compra aparece como CREDIT) — classificar pelo sinal do valor é confiável
  // independente do tipo de conta.
  return t.amount >= 0 ? "income" : "expense";
}

export const openFinanceSyncWorker = new Worker<SyncJob>(
  "open-finance-sync",
  async (job: Job<SyncJob>) => {
    const { financialAccountId, pluggyAccountId } = job.data;
    if (!pluggyAccountId) return;

    const account = await db.financialAccount.findUnique({
      where: { id: financialAccountId },
    });
    if (!account) return;

    let cursor: string | undefined;

    do {
      const { results, next } = await fetchTransactions(pluggyAccountId, cursor);

      for (const tx of results) {
        await db.transaction.upsert({
          where: { externalId_accountId: { externalId: tx.id, accountId: financialAccountId } },
          update: {
            type: mapTransactionType(tx),
            amount: Math.abs(tx.amount),
            description: tx.description,
            rawDescription: tx.descriptionRaw,
            date: new Date(tx.date),
            aiMerchantName: tx.merchant?.businessName ?? null,
          },
          create: {
            userId: account.userId,
            accountId: financialAccountId,
            type: mapTransactionType(tx),
            amount: Math.abs(tx.amount),
            description: tx.description,
            rawDescription: tx.descriptionRaw,
            date: new Date(tx.date),
            source: "open_finance",
            externalId: tx.id,
            aiMerchantName: tx.merchant?.businessName ?? null,
          },
        });
      }

      cursor = next ?? undefined;
    } while (cursor);

    await db.financialAccount.update({
      where: { id: financialAccountId },
      data: { lastSyncedAt: new Date() },
    });
  },
  { connection: redis, concurrency: 3 }
);

openFinanceSyncWorker.on("failed", (job, err) => {
  console.error(`[open-finance-sync] Job ${job?.id} failed:`, err.message);
});
