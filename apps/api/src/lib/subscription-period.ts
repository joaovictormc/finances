/**
 * Cálculo do fim do período de uma assinatura.
 *
 * Isolado do webhook porque é a regra que decide até quando alguém tem plano
 * pago — errar aqui tira acesso de quem pagou, ou dá acesso de graça.
 */

/** Recorrência da cobrança, no mesmo vocabulário do `auto_recurring` do Mercado Pago. */
export type BillingRecurrence = { frequency: number; unit: "days" | "months" };

/** Mensal — o que todo checkout cria hoje, e o fallback quando o Mercado Pago não informa. */
export const MONTHLY: BillingRecurrence = { frequency: 1, unit: "months" };

/**
 * Soma meses preservando o fim do mês.
 *
 * `setMonth` transborda: 31/jan + 1 mês vira 03/mar, porque fevereiro não tem
 * dia 31. Numa data de cobrança isso adianta o vencimento em dois dias e ainda
 * empurra todos os meses seguintes.
 */
function addMonths(base: Date, months: number): Date {
  const result = new Date(base);
  const day = result.getDate();
  result.setDate(1); // evita o transbordo antes de trocar o mês
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}

/** Avança uma data em um ciclo de cobrança. */
export function addRecurrence(base: Date, recurrence: BillingRecurrence): Date {
  if (recurrence.unit === "months") return addMonths(base, recurrence.frequency);
  const result = new Date(base);
  result.setDate(result.getDate() + recurrence.frequency);
  return result;
}

/**
 * Traduz o `auto_recurring` do preapproval para a recorrência interna.
 *
 * Cai no mensal quando o Mercado Pago não manda nada reconhecível: é o que todo
 * checkout cria hoje, então errar pra menos é o lado seguro — no pior caso o
 * usuário renova antes da hora, em vez de ganhar meses que não pagou.
 */
export function parseRecurrence(
  autoRecurring: { frequency?: number; frequency_type?: string } | null | undefined,
): BillingRecurrence {
  const frequency = autoRecurring?.frequency;
  if (typeof frequency !== "number" || !Number.isFinite(frequency) || frequency <= 0) return MONTHLY;

  const unit = autoRecurring?.frequency_type;
  if (unit === "days" || unit === "months") return { frequency, unit };
  return MONTHLY;
}

/**
 * Novo fim de período depois de uma cobrança confirmada.
 *
 * Renovação cobrada antes do período acabar soma em cima do que ainda resta;
 * cobrada depois — assinatura que ficou `past_due` e voltou — parte de agora,
 * senão o usuário pagaria por dias que já passaram.
 */
export function nextPeriodEnd(input: {
  currentPeriodEnd: Date | null;
  now: Date;
  recurrence: BillingRecurrence;
}): Date {
  const base =
    input.currentPeriodEnd && input.currentPeriodEnd.getTime() > input.now.getTime()
      ? input.currentPeriodEnd
      : input.now;
  return addRecurrence(base, input.recurrence);
}
