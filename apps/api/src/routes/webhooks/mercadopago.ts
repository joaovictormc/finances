import { Hono } from "hono";
import { db } from "@finances/db";
import {
  verifyMercadoPagoSignature,
  getMercadoPagoPreapproval,
  getMercadoPagoInvoice,
} from "../../lib/mercadopago";
import { grantReferralReward } from "../../lib/referrals";
import { findPlanByPriceCents, isPaidPlan, type PaidPlanId } from "../../lib/plan-prices";
import { isBillingInterval, type BillingInterval } from "../../lib/billing-interval";
import { isUniqueViolation } from "../../lib/prisma-errors";
import { addRecurrence, nextPeriodEnd, parseRecurrence } from "../../lib/subscription-period";

type MercadoPagoWebhookPayload = {
  type?: string; // "subscription_preapproval" | "payment" | ...
  action?: string;
  data?: { id?: string };
};

/**
 * Qual plano e período o usuário comprou. A fonte da verdade é o evento
 * `checkout_created:{preapprovalId}` que a própria API grava em `POST /checkout`;
 * o valor pago é só o segundo caminho, para assinatura criada antes disso existir.
 *
 * Antes o plano saía de um mapa fixo de valores (19.9 → pro, 29.9 → familia) com
 * fallback silencioso pra "pro": qualquer mudança de preço, cupom ou proração do
 * Mercado Pago rebaixava quem pagou `familia`, sem erro nenhum.
 */
async function resolveCheckout(
  preapprovalId: string,
  amount: number | undefined
): Promise<{ plan: PaidPlanId; interval: BillingInterval } | null> {
  const checkout = await db.paymentEvent.findUnique({
    where: { mpEventId: `checkout_created:${preapprovalId}` },
  });
  const declared = checkout?.rawPayload as { plan?: string; interval?: string } | null;

  if (declared?.plan && isPaidPlan(declared.plan)) {
    // Checkout anterior aos períodos existirem não gravou `interval`; era mensal.
    const interval =
      declared.interval && isBillingInterval(declared.interval) ? declared.interval : "monthly";
    return { plan: declared.plan, interval };
  }

  // Sem o evento de checkout, o valor pago é a única pista. Preço que bate com
  // mais de um plano ou período é ambíguo, e aí não se ativa nada.
  if (amount !== undefined) {
    return findPlanByPriceCents(Math.round(amount * 100));
  }

  return null;
}

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

  // Reserva do evento e checagem de duplicata na mesma operação. Com
  // findUnique seguido de create, dois webhooks iguais simultâneos passavam os
  // dois — e o guard de primeira ativação lá embaixo via os dois como
  // "primeira vez", concedendo a recompensa por indicação em dobro.
  const mpEventId = `${payload.type ?? "unknown"}:${dataId}:${payload.action ?? ""}`;
  try {
    await db.paymentEvent.create({
      data: { mpEventId, type: payload.type ?? "unknown", rawPayload: payload },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ ok: true });
    throw error;
  }

  if (payload.type === "subscription_preapproval") {
    const preapproval = await getMercadoPagoPreapproval(dataId);
    const userId = preapproval.external_reference;
    if (!userId) return c.json({ ok: true });

    const status =
      preapproval.status === "authorized"
        ? "active"
        : preapproval.status === "cancelled"
          ? "canceled"
          : "past_due";

    const previous = await db.subscription.findUnique({ where: { userId } });

    if (status === "active") {
      const checkout = await resolveCheckout(
        dataId,
        preapproval.auto_recurring?.transaction_amount
      );
      if (!checkout) {
        // Nunca conceder um plano que não dá pra justificar: sem o evento de
        // checkout e sem bater com o preço de nenhum plano, o certo é registrar
        // e deixar o admin liberar à mão, não chutar o mais barato.
        console.error(
          `[mercadopago-webhook] plano indeterminado no preapproval ${dataId} — assinatura NÃO ativada, confirmar manualmente`
        );
        return c.json({ ok: true });
      }

      // O período sai da recorrência que o próprio preapproval declara, não de
      // um mês fixo: é o que faz um plano semestral ou anual valer o tempo certo.
      const periodEnd = addRecurrence(new Date(), parseRecurrence(preapproval.auto_recurring));
      const { plan, interval } = checkout;

      await db.subscription.upsert({
        where: { userId },
        update: {
          status,
          plan,
          interval,
          mpPreapprovalId: dataId,
          currentPeriodEnd: periodEnd,
          canceledAt: null,
        },
        create: {
          userId,
          plan,
          interval,
          status,
          mpPreapprovalId: dataId,
          currentPeriodEnd: periodEnd,
        },
      });

      if (previous?.status !== "active") {
        await grantReferralReward(userId);
      }
    } else {
      await db.subscription.upsert({
        where: { userId },
        update: {
          status,
          mpPreapprovalId: dataId,
          canceledAt: status === "canceled" ? new Date() : null,
        },
        create: { userId, plan: "free", status, mpPreapprovalId: dataId, currentPeriodEnd: null },
      });
    }
  }

  if (payload.type === "subscription_authorized_payment") {
    await applyRecurringPayment(dataId);
  }

  return c.json({ ok: true });
});

/**
 * Cobrança recorrente da assinatura.
 *
 * O Mercado Pago não reemite `subscription_preapproval` a cada renovação — o
 * preapproval segue `authorized` e o que chega é este evento. Enquanto ele não
 * era tratado, `currentPeriodEnd` era gravado uma única vez na autorização e
 * nunca mais avançava: quem continuava pagando perdia o plano assim que o
 * primeiro período vencia.
 */
async function applyRecurringPayment(invoiceId: string): Promise<void> {
  const invoice = await getMercadoPagoInvoice(invoiceId);

  // Só renova o que foi de fato pago. Tentativa recusada não mexe no período:
  // o Mercado Pago ainda vai retentar, e encurtar o acesso aqui tiraria dias já
  // pagos. Desistência de vez muda o status do preapproval, que cai no branch
  // de cima.
  if (invoice.payment?.status !== "approved") return;

  const preapprovalId = invoice.preapproval_id;
  if (!preapprovalId) return;

  const subscription = await db.subscription.findUnique({
    where: { mpPreapprovalId: preapprovalId },
  });
  if (!subscription) {
    console.error(
      `[mercadopago-webhook] cobrança ${invoiceId} do preapproval ${preapprovalId} sem assinatura correspondente — renovação NÃO aplicada`
    );
    return;
  }

  const preapproval = await getMercadoPagoPreapproval(preapprovalId);

  await db.subscription.update({
    where: { id: subscription.id },
    data: {
      // Pagamento aprovado tira a assinatura de past_due sem precisar de outro evento.
      status: "active",
      canceledAt: null,
      // Concessão sem prazo (currentPeriodEnd nulo, como o admin grava numa
      // liberação manual) continua sem prazo: datar por causa de uma cobrança
      // tiraria acesso em vez de dar.
      ...(subscription.currentPeriodEnd
        ? {
            currentPeriodEnd: nextPeriodEnd({
              currentPeriodEnd: subscription.currentPeriodEnd,
              now: new Date(),
              recurrence: parseRecurrence(preapproval.auto_recurring),
            }),
          }
        : {}),
    },
  });
}

export default app;
