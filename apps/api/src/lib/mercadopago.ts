import { createHmac } from "node:crypto";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { getPlan, type PlanId } from "./plans";
import { getPaymentMethodConfig } from "./payment-methods";

async function getMercadoPagoConfig(): Promise<Record<string, string>> {
  const stored = await getPaymentMethodConfig("mercadopago");
  return (stored.config as Record<string, string>) ?? {};
}

async function getClient(): Promise<MercadoPagoConfig> {
  const config = await getMercadoPagoConfig();
  const accessToken = config.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago não configurado");
  return new MercadoPagoConfig({ accessToken });
}

interface CreateSubscriptionInput {
  userId: string;
  email: string;
  plan: PlanId;
}

export async function createSubscriptionCheckout({ userId, email, plan }: CreateSubscriptionInput) {
  const planDef = getPlan(plan);
  if (planDef.priceCents <= 0) throw new Error("Plano gratuito não requer checkout");

  const preapproval = new PreApproval(await getClient());
  const result = await preapproval.create({
    body: {
      reason: `ControlAI — Plano ${planDef.name}`,
      external_reference: userId,
      payer_email: email,
      back_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: planDef.priceCents / 100,
        currency_id: "BRL",
      },
      status: "pending",
    },
  });

  return {
    preapprovalId: result.id!,
    checkoutUrl: result.init_point!,
  };
}

export async function cancelSubscriptionAtMercadoPago(preapprovalId: string) {
  const preapproval = new PreApproval(await getClient());
  await preapproval.update({ id: preapprovalId, body: { status: "cancelled" } });
}

export async function getMercadoPagoPreapproval(preapprovalId: string) {
  const preapproval = new PreApproval(await getClient());
  return preapproval.get({ id: preapprovalId });
}

/**
 * Valida a assinatura HMAC do webhook do Mercado Pago.
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#editor_5
 */
export async function verifyMercadoPagoSignature(input: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
}): Promise<boolean> {
  const config = await getMercadoPagoConfig();
  const secret = config.webhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !input.xSignature) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim()];
    })
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${input.dataId};request-id:${input.xRequestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected === hash;
}
