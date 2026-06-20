import { Hono } from "hono";
import { db } from "@finances/db";
import { openFinanceSyncQueue } from "../../jobs/queues";

// A Pluggy não assina o payload do webhook (sem HMAC). Por isso o handler nunca
// confia nos dados do corpo além do itemId/event — toda informação real é
// buscada de volta na API autenticada da Pluggy pelo worker de sync.
const PLUGGY_WEBHOOK_IP = "52.67.145.81";

type PluggyWebhookPayload = {
  event: string;
  itemId?: string;
  id?: string;
};

const app = new Hono();

app.post("/", async (c) => {
  const forwardedFor = c.req.header("x-forwarded-for");
  const sourceIp = forwardedFor?.split(",")[0]?.trim();
  if (sourceIp && sourceIp !== PLUGGY_WEBHOOK_IP) {
    console.warn(`[pluggy-webhook] IP inesperado: ${sourceIp}`);
  }

  const payload = await c.req.json<PluggyWebhookPayload>();
  const itemId = payload.itemId ?? payload.id;

  if (!itemId) return c.json({ ok: true });

  if (
    payload.event === "item/updated" ||
    payload.event === "transactions/created" ||
    payload.event === "transactions/updated"
  ) {
    const accounts = await db.financialAccount.findMany({
      where: { pluggyItemId: itemId },
      select: { id: true, pluggyAccountId: true },
    });

    await Promise.all(
      accounts.map((account) =>
        openFinanceSyncQueue.add("sync-account", {
          financialAccountId: account.id,
          pluggyAccountId: account.pluggyAccountId,
        })
      )
    );
  }

  return c.json({ ok: true });
});

export default app;
