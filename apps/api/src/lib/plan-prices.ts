import { db } from "@finances/db";
import { PLANS } from "./plans";
import { BILLING_INTERVALS, INTERVAL_MONTHS, type BillingInterval } from "./billing-interval";

/** Planos que passam por checkout — o free não tem preço. */
export const PAID_PLANS = ["pro", "familia"] as const;
export type PaidPlanId = (typeof PAID_PLANS)[number];

export function isPaidPlan(value: string): value is PaidPlanId {
  return (PAID_PLANS as readonly string[]).includes(value);
}

export type PlanPriceEntry = {
  plan: PaidPlanId;
  interval: BillingInterval;
  /** Total do período inteiro, em centavos — não é o valor por mês. */
  priceCents: number;
  /** `false` esconde o período do checkout sem apagar o preço configurado. */
  active: boolean;
};

/**
 * Preço padrão de um período: o mensal do plano vezes os meses, sem desconto.
 *
 * Vale só até o admin definir o preço real. Embutir um desconto aqui seria
 * decidir política de preço em código — exatamente o que essa tabela veio tirar
 * do código.
 */
function defaultPriceCents(plan: PaidPlanId, interval: BillingInterval): number {
  return PLANS[plan].priceCents * INTERVAL_MONTHS[interval];
}

function key(plan: string, interval: string): string {
  return `${plan}:${interval}`;
}

/**
 * Todos os preços, criando no banco as linhas que ainda faltarem.
 *
 * Mesmo padrão do `getGamificationSettings`: a tabela se preenche sozinha na
 * primeira leitura, então a tela do admin abre já com o que editar em vez de
 * uma lista vazia.
 */
export async function listPlanPrices(): Promise<PlanPriceEntry[]> {
  const rows = await db.planPrice.findMany();
  const byKey = new Map(rows.map((row) => [key(row.plan, row.interval), row]));

  const missing = [];
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      if (!byKey.has(key(plan, interval))) {
        missing.push({ plan, interval, priceCents: defaultPriceCents(plan, interval) });
      }
    }
  }
  if (missing.length > 0) {
    // skipDuplicates cobre duas leituras simultâneas tentando criar a mesma linha.
    await db.planPrice.createMany({ data: missing, skipDuplicates: true });
  }

  const entries: PlanPriceEntry[] = [];
  for (const plan of PAID_PLANS) {
    for (const interval of BILLING_INTERVALS) {
      const row = byKey.get(key(plan, interval));
      entries.push({
        plan,
        interval,
        priceCents: row?.priceCents ?? defaultPriceCents(plan, interval),
        active: row?.active ?? true,
      });
    }
  }
  return entries;
}

/**
 * Valor a cobrar por um plano/período. `null` quando o admin desativou o
 * período — o checkout tem que recusar em vez de cobrar um preço escondido.
 */
export async function getCheckoutPriceCents(
  plan: PaidPlanId,
  interval: BillingInterval,
): Promise<number | null> {
  const row = await db.planPrice.findUnique({
    where: { plan_interval: { plan, interval } },
  });
  if (!row) return defaultPriceCents(plan, interval);
  return row.active ? row.priceCents : null;
}

/** Grava os preços editados no admin. */
export async function updatePlanPrices(
  entries: { plan: PaidPlanId; interval: BillingInterval; priceCents: number; active: boolean }[],
): Promise<PlanPriceEntry[]> {
  for (const entry of entries) {
    await db.planPrice.upsert({
      where: { plan_interval: { plan: entry.plan, interval: entry.interval } },
      update: { priceCents: entry.priceCents, active: entry.active },
      create: entry,
    });
  }
  return listPlanPrices();
}

/**
 * Que plano e período custam exatamente esse valor.
 *
 * Só o segundo caminho do webhook, para quando não existe o evento de checkout
 * que declara a compra. Um valor que serve a mais de um plano — ou ao mesmo
 * plano em períodos diferentes — é ambíguo, e aí é melhor não ativar nada do
 * que ativar o errado.
 */
export async function findPlanByPriceCents(
  cents: number,
): Promise<{ plan: PaidPlanId; interval: BillingInterval } | null> {
  const matches = (await listPlanPrices()).filter((entry) => entry.priceCents === cents);
  if (matches.length !== 1) return null;
  const match = matches[0]!;
  return { plan: match.plan, interval: match.interval };
}
