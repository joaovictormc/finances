import { PLANS } from "./plans";

/**
 * Frase pronta do que um prêmio da roleta entregou.
 *
 * Montada no servidor, e não em cada tela: web e mobile têm quatro lugares que
 * exibem resultado de giro, e a regra de plural e nome de plano não precisa
 * existir quatro vezes.
 *
 * `plan` é opcional porque o histórico de giros não guarda o plano — nesse caso
 * a frase fica em "dias de plano", que continua verdadeira.
 */
export function describePrize(prize: {
  type: string;
  points: number;
  days: number;
  plan?: string;
}): string {
  if (prize.type !== "plan_days") {
    return `+${prize.points} ${prize.points === 1 ? "ponto" : "pontos"}`;
  }
  const planName =
    prize.plan === "familia"
      ? PLANS.familia.name
      : prize.plan === "pro"
        ? PLANS.pro.name
        : "plano";
  return `+${prize.days} ${prize.days === 1 ? "dia" : "dias"} de ${planName}`;
}
