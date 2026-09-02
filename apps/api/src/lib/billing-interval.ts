import type { BillingRecurrence } from "./subscription-period";

/**
 * Períodos de cobrança que o usuário pode contratar.
 *
 * Até aqui só existia o mensal, implícito no `frequency: 1, frequency_type:
 * "months"` do checkout. Virou dado nomeado porque agora três coisas precisam
 * concordar sobre o tamanho do ciclo: o preapproval do Mercado Pago, o
 * vencimento gravado em `Subscription.currentPeriodEnd`, e o preço cobrado.
 */
export const BILLING_INTERVALS = ["monthly", "semiannual", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Meses cobertos por cada período. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

/** Rótulo em PT-BR — a API devolve pronto pra web e o mobile não duplicarem a tradução. */
export const INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Mensal",
  semiannual: "Semestral",
  annual: "Anual",
};

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** Período contratado → recorrência do Mercado Pago e do cálculo de vencimento. */
export function intervalRecurrence(interval: BillingInterval): BillingRecurrence {
  return { frequency: INTERVAL_MONTHS[interval], unit: "months" };
}
