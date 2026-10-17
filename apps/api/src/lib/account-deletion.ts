import { db } from "@finances/db";
import { cancelSubscriptionAtMercadoPago } from "./mercadopago";

/**
 * Antes de excluir a conta: para a cobrança recorrente no cartão. Sem isso o
 * Mercado Pago seguiria cobrando quem não tem mais conta (a assinatura some
 * do nosso banco, mas o preapproval continua `authorized` lá).
 *
 * Pix não tem recorrência no Mercado Pago (`pix:` no id) e assinatura já
 * cancelada não tem o que parar. Se o Mercado Pago falhar, lança: a exclusão
 * é bloqueada e o usuário tenta de novo, em vez de perder a conta e seguir
 * sendo cobrado.
 */
export async function stopRecurringBilling(userId: string): Promise<void> {
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { status: true, mpPreapprovalId: true },
  });
  const preapprovalId = subscription?.mpPreapprovalId;
  if (!preapprovalId || preapprovalId.startsWith("pix:") || subscription.status === "canceled") return;
  await cancelSubscriptionAtMercadoPago(preapprovalId);
}
