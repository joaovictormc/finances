import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { createConnectToken, fetchAccounts, type PluggyAccount } from "../lib/pluggy/client";
import { openFinanceSyncQueue } from "../jobs/queues";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.post("/connect-token", async (c) => {
  const userId = c.get("userId");
  const connectToken = await createConnectToken(userId);
  return c.json({ connectToken });
});

function mapAccountType(account: PluggyAccount): string {
  if (account.type === "CREDIT") return "credit_card";
  if (account.subtype === "SAVINGS_ACCOUNT") return "savings";
  return "checking";
}

app.post("/items", async (c) => {
  const userId = c.get("userId");
  const { itemId } = await c.req.json<{ itemId: string }>();
  if (!itemId) return c.json({ error: "itemId é obrigatório" }, 400);

  const pluggyAccounts = await fetchAccounts(itemId);

  const accounts = await Promise.all(
    pluggyAccounts.map(async (pa) => {
      const account = await db.financialAccount.upsert({
        where: { pluggyAccountId: pa.id },
        update: {
          name: pa.marketingName ?? pa.name,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
          type: mapAccountType(pa),
          name: pa.marketingName ?? pa.name,
          institution: pa.marketingName ?? pa.name,
          currency: pa.currencyCode,
          pluggyItemId: itemId,
          pluggyAccountId: pa.id,
          lastSyncedAt: new Date(),
        },
      });

      await openFinanceSyncQueue.add("sync-account", {
        financialAccountId: account.id,
        pluggyAccountId: pa.id,
      });

      return account;
    })
  );

  return c.json({ accounts }, 201);
});

export default app;
