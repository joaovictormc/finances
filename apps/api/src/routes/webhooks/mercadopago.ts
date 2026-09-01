import { Hono } from "hono";
import { db } from "@finances/db";
import { verifyMercadoPagoSignature, getMercadoPagoPreapproval } from "../../lib/mercadopago";
import { grantReferralReward } from "../../lib/referrals";
import { PLANS, type PlanId } from "../../lib/plans";

type MercadoPagoWebhookPayload = {
  type?: string; // "subscription_preapproval" | "payment" | ...
  action?: string;
  data?: { id?: string };
};

/** P2002 = violação de unique no Prisma. Aqui significa "evento já registrado". */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Qual plano o usuário comprou. A fonte da verdade é o evento
 * `checkout_created:{preapprovalId}` que a própria API grava em `POST /checkout`;
 * o valor pago é só o segundo caminho, para assinatura criada antes disso existir.
 *
 * Antes o plano saía de um mapa fixo de valores (19.9 → pro, 29.9 → familia) com
 * fallback silencioso pra "pro": qualquer mudança de preço, cupom ou proração do
 * Mercado Pago rebaixava quem pagou `familia`, sem erro nenhum.
 */
async function resolvePlan(
  preapprovalId: string,
  amount: number | undefined
): Promise<PlanId | null> {
  const checkout = await db.paymentEvent.findUnique({
    where: { mpEventId: `checkout_created:${preapprovalId}` },
  });
  const declared = (checkout?.rawPayload as { plan?: string } | null)?.plan;
  if (declared === "pro" || declared === "familia") return declared;

  if (amount !== undefined) {
    const cents = Math.round(amount * 100);
    const match = Object.values(PLANS).find((plan) => plan.priceCents === cents);
    if (match && match.id !== "free") return match.id;
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
      const plan = await resolvePlan(dataId, preapproval.auto_recurring?.transaction_amount);
      if (!plan) {
        // Nunca conceder um plano que não dá pra justificar: sem o evento de
        // checkout e sem bater com o preço de nenhum plano, o certo é registrar
        // e deixar o admin liberar à mão, não chutar o mais barato.
        console.error(
          `[mercadopago-webhook] plano indeterminado no preapproval ${dataId} — assinatura NÃO ativada, confirmar manualmente`
        );
        return c.json({ ok: true });
      }

      await db.subscription.upsert({
        where: { userId },
        update: {
          status,
          plan,
          mpPreapprovalId: dataId,
          currentPeriodEnd: addOneMonth(new Date()),
          canceledAt: null,
        },
        create: {
          userId,
          plan,
          status,
          mpPreapprovalId: dataId,
          currentPeriodEnd: addOneMonth(new Date()),
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

  return c.json({ ok: true });
});

function addOneMonth(date: Date) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

export default app;
