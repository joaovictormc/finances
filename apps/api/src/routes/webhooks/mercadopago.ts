import { Hono } from "hono";
import { db } from "@finances/db";
import { verifyMercadoPagoSignature, getMercadoPagoPreapproval } from "../../lib/mercadopago";
import { grantReferralReward } from "../../lib/referrals";

type MercadoPagoWebhookPayload = {
  type?: string; // "subscription_preapproval" | "payment" | ...
  action?: string;
  data?: { id?: string };
};

const PLAN_BY_AMOUNT: Record<number, "pro" | "familia"> = {
  19.9: "pro",
  29.9: "familia",
};

const app = new Hono();

app.post("/", async (c) => {
  const payload = await c.req.json<MercadoPagoWebhookPayload>();
  const dataId = payload.data?.id;
  if (!dataId) return c.json({ ok: true });

  const valid = await verifyMercadoPagoSignature({
    xSignature: c.req.header("x-signature"),
    xRequestId: c.req.header("x-request-id"),
    dataId,
  });
  if (!valid) {
    console.warn("[mercadopago-webhook] assinatura inválida, ignorando evento");
    return c.json({ error: "Assinatura inválida" }, 401);
  }

  const mpEventId = `${payload.type ?? "unknown"}:${dataId}:${payload.action ?? ""}`;
  const alreadyProcessed = await db.paymentEvent.findUnique({ where: { mpEventId } });
  if (alreadyProcessed) return c.json({ ok: true });

  await db.paymentEvent.create({
    data: { mpEventId, type: payload.type ?? "unknown", rawPayload: payload },
  });

  if (payload.type === "subscription_preapproval") {
    const preapproval = await getMercadoPagoPreapproval(dataId);
    const userId = preapproval.external_reference;
    if (!userId) return c.json({ ok: true });

    const status = preapproval.status === "authorized" ? "active" : preapproval.status === "cancelled" ? "canceled" : "past_due";
    const amount = preapproval.auto_recurring?.transaction_amount;
    const plan = amount ? PLAN_BY_AMOUNT[amount] ?? "pro" : "pro";

    const previous = await db.subscription.findUnique({ where: { userId } });

    await db.subscription.upsert({
      where: { userId },
      update: {
        status,
        plan: status === "active" ? plan : undefined,
        mpPreapprovalId: dataId,
        currentPeriodEnd: status === "active" ? addOneMonth(new Date()) : undefined,
        canceledAt: status === "canceled" ? new Date() : null,
      },
      create: {
        userId,
        plan: status === "active" ? plan : "free",
        status,
        mpPreapprovalId: dataId,
        currentPeriodEnd: status === "active" ? addOneMonth(new Date()) : null,
      },
    });

    if (status === "active" && previous?.status !== "active") {
      await grantReferralReward(userId);
    }
  }

  return c.json({ ok: true });
});

function addOneMonth(date: Date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export default app;
