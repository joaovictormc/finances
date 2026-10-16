import { PLANS } from "./plans";
import { INTERVAL_LABELS, INTERVAL_MONTHS } from "./billing-interval";
import { listPlanPrices } from "./plan-prices";

/**
 * Catálogo de planos: features vêm do código, preços vêm do banco.
 *
 * `priceCents` continua sendo o mensal — é o preço de vitrine, o que a tela
 * mostra antes do usuário escolher período. Os demais vêm em `prices`.
 * Usado pela tela de planos do app (autenticada) e pela landing (pública).
 */
export async function getPlanCatalog() {
  const prices = await listPlanPrices();

  return Object.values(PLANS).map((plan) => {
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
  });
}
