import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { PLANS } from "../lib/plans";
import { createSubscriptionCheckout, cancelSubscriptionAtMercadoPago } from "../lib/mercadopago";
import {
  getEffectivePlan,
  isSubscriptionExpired,
  planHasIntegrationsModule,
  planHasFamilyModule,
} from "../lib/plan-limits";
import { checkRateLimit } from "../lib/rate-limit";
import { getPaymentMethodConfig, readPaymentMethodConfig } from "../lib/payment-methods";
import { buildPixPayload, pixTxidFromId } from "../lib/pix";
import {
  BILLING_INTERVALS,
  INTERVAL_LABELS,
  INTERVAL_MONTHS,
  type BillingInterval,
} from "../lib/billing-interval";
import { getCheckoutPriceCents, listPlanPrices } from "../lib/plan-prices";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

/**
 * Catálogo de planos: features vêm do código, preços vêm do banco.
 *
 * `priceCents` continua sendo o mensal — é o preço de vitrine, o que a tela
 * mostra antes do usuário escolher período. Os demais vêm em `prices`.
 */
app.get("/plans", async (c) => {
  const prices = await listPlanPrices();

  return c.json(
    Object.values(PLANS).map((plan) => {
      const available = prices.filter((price) => price.plan === plan.id && price.active);
      const monthly = available.find((price) => price.interval === "monthly");

      return {
        ...plan,
        priceCents: monthly?.priceCents ?? plan.priceCents,
        prices: available.map((price) => ({
          interval: price.interval,
          label: INTERVAL_LABELS[price.interval],
          months: INTERVAL_MONTHS[price.interval],
          priceCents: price.priceCents,
          // Quanto sai por mês no período — deixa o desconto do anual visível
          // sem cada tela ter que refazer a conta.
          monthlyEquivalentCents: Math.round(price.priceCents / INTERVAL_MONTHS[price.interval]),
        })),
      };
    }),
  );
});

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

  return c.json({
    plan: plan.id,
    status: expired ? "past_due" : (subscription?.status ?? "active"),
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    canceledAt: subscription?.canceledAt ?? null,
    hasIntegrationsModule: planHasIntegrationsModule(plan),
    hasFamilyModule: planHasFamilyModule(plan),
  });
});

const CheckoutSchema = z.object({
  plan: z.enum(["pro", "familia"]),
  // Default mensal: é o que todo checkout criava antes dos períodos existirem,
  // então cliente antigo que não manda o campo continua funcionando.
  interval: z.enum(BILLING_INTERVALS).default("monthly"),
});

/** Preço vigente, ou `null` quando o admin desativou o período. */
async function resolveCheckoutPrice(plan: "pro" | "familia", interval: BillingInterval) {
  const priceCents = await getCheckoutPriceCents(plan, interval);
  if (priceCents === null || priceCents <= 0) return null;
  return priceCents;
}

app.post("/checkout", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan, interval } = c.req.valid("json");

  // Cada checkout cria um preapproval no Mercado Pago (chamada externa) e uma
  // linha em PaymentEvent. Sem limite, um laço de script enche a mesma lista
  // que o admin usa pra confirmar pagamento.
  if (!(await checkRateLimit({ key: "checkout", userId, max: 10, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas tentativas de checkout. Tente novamente em alguns minutos." }, 429);
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return c.json({ error: "Usuário não encontrado" }, 404);

  const priceCents = await resolveCheckoutPrice(plan, interval);
  if (priceCents === null) {
    return c.json({ error: "Este período não está disponível para contratação" }, 400);
  }

  const { preapprovalId, checkoutUrl } = await createSubscriptionCheckout({
    userId,
    email: user.email,
    plan,
    interval,
    priceCents,
  });

  // Só grava "pending" na assinatura se não houver uma assinatura ATIVA hoje —
  // sobrescrever plan/status aqui derrubaria o plano pago atual (getEffectivePlan
  // trata status != "active" como free) mesmo sem o pagamento do novo plano ter
  // sido confirmado ainda. A confirmação real (webhook do Mercado Pago) já sabe
  // qual plano ativar a partir do valor pago, independente do que foi gravado aqui.
  const existing = await db.subscription.findUnique({ where: { userId } });
  if (existing?.status !== "active") {
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
      rawPayload: { userId, plan, interval, preapprovalId, priceCents },
    },
  });

  return c.json({ checkoutUrl });
});

app.post("/checkout-pix", zValidator("json", CheckoutSchema), async (c) => {
  const userId = c.get("userId");
  const { plan, interval } = c.req.valid("json");

  if (!(await checkRateLimit({ key: "checkout-pix", userId, max: 10, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas tentativas de checkout. Tente novamente em alguns minutos." }, 429);
  }

  const { enabled, config } = await readPaymentMethodConfig("pix");
  if (!enabled || !config.key) {
    return c.json({ error: "Pagamento via Pix não está disponível no momento" }, 503);
  }

  const priceCents = await resolveCheckoutPrice(plan, interval);
  if (priceCents === null) {
    return c.json({ error: "Este período não está disponível para contratação" }, 400);
  }

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
  if (existingSubscription?.status !== "active") {
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
      rawPayload: { userId, plan, interval, txid, amount: priceCents / 100 },
    },
  });

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
  await db.subscription.update({
    where: { userId },
    data: { status: "canceled", canceledAt: new Date() },
  });

  return c.json({ success: true });
});

export default app;
