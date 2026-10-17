import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { CouponPreviewSchema } from "@finances/validations";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { createSubscriptionCheckout, cancelSubscriptionAtMercadoPago } from "../lib/mercadopago";
import {
  getEffectivePlan,
  isSubscriptionExpired,
  hasPaidAccess,
  planHasIntegrationsModule,
  planHasFamilyModule,
} from "../lib/plan-limits";
import { checkRateLimit } from "../lib/rate-limit";
import { getPaymentMethodConfig, readPaymentMethodConfig } from "../lib/payment-methods";
import { buildPixPayload, pixTxidFromId } from "../lib/pix";
import { BILLING_INTERVALS, type BillingInterval } from "../lib/billing-interval";
import { getCheckoutPriceCents } from "../lib/plan-prices";
import { COUPON_MESSAGES, applyDiscount, checkCoupon, reserveRedemption } from "../lib/coupons";
import { getPlanCatalog } from "../lib/plan-catalog";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

// Catálogo (features do código + preços do banco) — ver lib/plan-catalog.ts.
app.get("/plans", async (c) => c.json(await getPlanCatalog()));

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

  // O status tem que contar a mesma história que o gate de acesso: assinatura
  // ativa com período vencido já não dá plano pago, e devolver "active" aqui
  // faria a tela de cobrança contradizer o resto do app.
  const expired = subscription ? isSubscriptionExpired(subscription) : false;

  // Pix não renova sozinho: a tela oferece "Renovar com Pix" no plano atual.
  const paymentMethod = subscription?.mpPreapprovalId?.startsWith("pix:")
    ? "pix"
    : subscription?.mpPreapprovalId
      ? "card"
      : null;

  return c.json({
    plan: plan.id,
    status: expired ? "past_due" : (subscription?.status ?? "active"),
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    canceledAt: subscription?.canceledAt ?? null,
    interval: subscription?.interval ?? null,
    paymentMethod,
    hasIntegrationsModule: planHasIntegrationsModule(plan),
    hasFamilyModule: planHasFamilyModule(plan),
  });
});

const CheckoutSchema = z.object({
  plan: z.enum(["pro", "familia"]),
  // Default mensal: é o que todo checkout criava antes dos períodos existirem,
  // então cliente antigo que não manda o campo continua funcionando.
  interval: z.enum(BILLING_INTERVALS).default("monthly"),
  /** Cupom de desconto opcional; o preço com desconto vale para a assinatura inteira. */
  couponCode: z.string().trim().max(30).optional(),
});

type PricedCheckout =
  | {
      ok: true;
      originalCents: number;
      finalCents: number;
      couponId: string | null;
      couponCode: string | null;
    }
  | { ok: false; status: 400; error: string };

/** Preço vigente com o cupom (se houver) já aplicado e validado. */
async function priceWithCoupon(
  userId: string,
  plan: "pro" | "familia",
  interval: BillingInterval,
  couponCode: string | undefined
): Promise<PricedCheckout> {
  const originalCents = await resolveCheckoutPrice(plan, interval);
  if (originalCents === null) return { ok: false, status: 400, error: "Este período não está disponível para contratação" };
  if (!couponCode) return { ok: true, originalCents, finalCents: originalCents, couponId: null, couponCode: null };

  const check = await checkCoupon(couponCode, userId, plan);
  if (!check.ok) return { ok: false, status: 400, error: COUPON_MESSAGES[check.reason] };
  return {
    ok: true,
    originalCents,
    finalCents: applyDiscount(originalCents, check.coupon),
    couponId: check.coupon.id,
    couponCode: check.coupon.code,
  };
}

/** Prévia do cupom na tela de planos: preço com desconto antes de pagar. */
app.post("/coupon/preview", zValidator("json", CouponPreviewSchema), async (c) => {
  const userId = c.get("userId");
  const { code, plan, interval } = c.req.valid("json");
  const priced = await priceWithCoupon(userId, plan, interval, code);
  if (!priced.ok) return c.json({ error: priced.error }, priced.status);
  const coupon = await db.coupon.findUnique({
    where: { id: priced.couponId! },
    select: { code: true, description: true, percentOff: true, amountOffCents: true },
  });
  return c.json({ ...coupon, plan, interval, originalCents: priced.originalCents, finalCents: priced.finalCents });
});

/** Preço vigente, ou `null` quando o admin desativou o período. */
async function resolveCheckoutPrice(plan: "pro" | "familia", interval: BillingInterval) {
  const priceCents = await getCheckoutPriceCents(plan, interval);
  if (priceCents === null || priceCents <= 0) return null;
  return priceCents;
}

app.post("/checkout", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan, interval, couponCode } = c.req.valid("json");

  // Cada checkout cria um preapproval no Mercado Pago (chamada externa) e uma
  // linha em PaymentEvent. Sem limite, um laço de script enche a mesma lista
  // que o admin usa pra confirmar pagamento.
  if (!(await checkRateLimit({ key: "checkout", userId, max: 10, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas tentativas de checkout. Tente novamente em alguns minutos." }, 429);
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return c.json({ error: "Usuário não encontrado" }, 404);

  const priced = await priceWithCoupon(userId, plan, interval, couponCode);
  if (!priced.ok) return c.json({ error: priced.error }, priced.status);
  const priceCents = priced.finalCents;

  const { preapprovalId, checkoutUrl } = await createSubscriptionCheckout({
    userId,
    email: user.email,
    plan,
    interval,
    priceCents,
  });

  // Só grava "pending" se a pessoa não tem acesso pago hoje — sobrescrever
  // plan/status derrubaria o plano atual (inclusive o de quem cancelou e ainda
  // está no período pago) antes de o pagamento novo ser confirmado. A
  // confirmação real (webhook do Mercado Pago) já sabe qual plano ativar a
  // partir do valor pago, independente do que foi gravado aqui.
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (!existing || !hasPaidAccess(existing)) {
    await db.subscription.upsert({
      where: { userId },
      update: { plan, interval, status: "pending", mpPreapprovalId: preapprovalId },
      create: { userId, plan, interval, status: "pending", mpPreapprovalId: preapprovalId },
    });
  }

  await db.paymentEvent.create({
    data: {
      mpEventId: `checkout_created:${preapprovalId}`,
      type: "checkout_created",
      // `interval` aqui é a fonte da verdade do período pro webhook — mesmo
      // papel que `plan` já cumpria pra não depender do valor pago.
      rawPayload: {
        userId,
        plan,
        interval,
        preapprovalId,
        priceCents,
        ...(priced.couponCode && { couponCode: priced.couponCode, originalCents: priced.originalCents }),
      },
    },
  });

  if (priced.couponId) {
    await reserveRedemption({
      couponId: priced.couponId,
      userId,
      checkoutRef: preapprovalId,
      plan,
      interval,
      originalCents: priced.originalCents,
      finalCents: priced.finalCents,
    });
  }

  return c.json({ checkoutUrl });
});

app.post("/checkout-pix", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan, interval, couponCode } = c.req.valid("json");

  if (!(await checkRateLimit({ key: "checkout-pix", userId, max: 10, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas tentativas de checkout. Tente novamente em alguns minutos." }, 429);
  }

  const { enabled, config } = await readPaymentMethodConfig("pix");
  if (!enabled || !config.key) {
    return c.json({ error: "Pagamento via Pix não está disponível no momento" }, 503);
  }

  const priced = await priceWithCoupon(userId, plan, interval, couponCode);
  if (!priced.ok) return c.json({ error: priced.error }, priced.status);
  const priceCents = priced.finalCents;

  const txid = pixTxidFromId(randomUUID());

  const payload = buildPixPayload({
    key: config.key,
    receiverName: config.receiverName || "ControlAI",
    receiverCity: config.receiverCity || "Sao Paulo",
    amount: priceCents / 100,
    txid,
  });

  // Mesmo motivo do /checkout: não sobrescrever uma assinatura ATIVA antes do
  // pagamento Pix ser confirmado manualmente (ver /admin/payment-events/:id/confirm-pix).
  const existingSubscription = await db.subscription.findUnique({ where: { userId } });
  if (!existingSubscription || !hasPaidAccess(existingSubscription)) {
    await db.subscription.upsert({
      where: { userId },
      update: { plan, interval, status: "pending", mpPreapprovalId: `pix:${txid}` },
      create: { userId, plan, interval, status: "pending", mpPreapprovalId: `pix:${txid}` },
    });
  }

  await db.paymentEvent.create({
    data: {
      mpEventId: `pix_checkout_created:${txid}`,
      type: "pix_checkout_created",
      // O admin confirma esse Pix à mão depois; `interval` é o que diz a ele
      // quantos meses liberar.
      rawPayload: {
        userId,
        plan,
        interval,
        txid,
        amount: priceCents / 100,
        ...(priced.couponCode && { couponCode: priced.couponCode, originalAmount: priced.originalCents / 100 }),
      },
    },
  });

  if (priced.couponId) {
    await reserveRedemption({
      couponId: priced.couponId,
      userId,
      checkoutRef: `pix:${txid}`,
      plan,
      interval,
      originalCents: priced.originalCents,
      finalCents: priced.finalCents,
    });
  }

  return c.json({ payload, txid, amount: priceCents / 100 });
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
  // Para a recorrência; o acesso continua até `currentPeriodEnd` (hasPaidAccess).
  const updated = await db.subscription.update({
    where: { userId },
    data: { status: "canceled", canceledAt: new Date() },
  });

  return c.json({ success: true, accessUntil: hasPaidAccess(updated) ? updated.currentPeriodEnd : null });
});

export default app;
