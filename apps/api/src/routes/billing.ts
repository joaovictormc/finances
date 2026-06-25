import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { PLANS, getPlan } from "../lib/plans";
import { createSubscriptionCheckout, cancelSubscriptionAtMercadoPago } from "../lib/mercadopago";
import { getEffectivePlan, planHasIntegrationsModule, planHasFamilyModule } from "../lib/plan-limits";
import { getPaymentMethodConfig } from "../lib/payment-methods";
import { buildPixPayload, pixTxidFromId } from "../lib/pix";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/plans", (c) => c.json(Object.values(PLANS)));

app.get("/payment-methods", async (c) => {
  const [mercadopago, pix] = await Promise.all([
    getPaymentMethodConfig("mercadopago"),
    getPaymentMethodConfig("pix"),
  ]);
  return c.json({
    mercadopago: mercadopago.enabled,
    pix: pix.enabled,
  });
});

app.get("/subscription", async (c) => {
  const userId = c.get("userId");
  const subscription = await db.subscription.findUnique({ where: { userId } });
  const plan = await getEffectivePlan(userId);
  return c.json({
    plan: plan.id,
    status: subscription?.status ?? "active",
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    canceledAt: subscription?.canceledAt ?? null,
    hasIntegrationsModule: planHasIntegrationsModule(plan),
    hasFamilyModule: planHasFamilyModule(plan),
  });
});

const CheckoutSchema = z.object({ plan: z.enum(["pro", "familia"]) });

app.post("/checkout", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan } = c.req.valid("json");

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return c.json({ error: "Usuário não encontrado" }, 404);

  const { preapprovalId, checkoutUrl } = await createSubscriptionCheckout({ userId, email: user.email, plan });

  await db.subscription.upsert({
    where: { userId },
    update: { plan, status: "pending", mpPreapprovalId: preapprovalId },
    create: { userId, plan, status: "pending", mpPreapprovalId: preapprovalId },
  });

  await db.paymentEvent.create({
    data: {
      mpEventId: `checkout_created:${preapprovalId}`,
      type: "checkout_created",
      rawPayload: { userId, plan, preapprovalId },
    },
  });

  return c.json({ checkoutUrl });
});

app.post("/checkout-pix", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan } = c.req.valid("json");

  const pixConfig = await getPaymentMethodConfig("pix");
  const config = (pixConfig.config as Record<string, string>) ?? {};
  if (!pixConfig.enabled || !config.key) {
    return c.json({ error: "Pagamento via Pix não está disponível no momento" }, 503);
  }

  const planDef = getPlan(plan);
  const txid = pixTxidFromId(randomUUID());

  const payload = buildPixPayload({
    key: config.key,
    receiverName: config.receiverName || "ControlAI",
    receiverCity: config.receiverCity || "Sao Paulo",
    amount: planDef.priceCents / 100,
    txid,
  });

  await db.subscription.upsert({
    where: { userId },
    update: { plan, status: "pending", mpPreapprovalId: `pix:${txid}` },
    create: { userId, plan, status: "pending", mpPreapprovalId: `pix:${txid}` },
  });

  await db.paymentEvent.create({
    data: {
      mpEventId: `pix_checkout_created:${txid}`,
      type: "pix_checkout_created",
      rawPayload: { userId, plan, txid, amount: planDef.priceCents / 100 },
    },
  });

  return c.json({ payload, txid, amount: planDef.priceCents / 100 });
});

app.post("/cancel", async (c) => {
  const userId = c.get("userId");
  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (!subscription || !subscription.mpPreapprovalId) {
    return c.json({ error: "Nenhuma assinatura ativa encontrada" }, 404);
  }

  if (!subscription.mpPreapprovalId.startsWith("pix:")) {
    await cancelSubscriptionAtMercadoPago(subscription.mpPreapprovalId);
  }
  await db.subscription.update({
    where: { userId },
    data: { status: "canceled", canceledAt: new Date() },
  });

  return c.json({ success: true });
});

export default app;
