import { db } from "@finances/db";
import type { PlanId } from "./plans";

/** Ordem de capacidade — existe pra um prêmio nunca rebaixar quem já tem plano melhor. */
const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, familia: 2 };

export type PlanGrantDecision =
  | { action: "grant"; plan: PlanId; currentPeriodEnd: Date }
  | { action: "skip"; reason: "sem_dias" | "acesso_sem_prazo" };

/**
 * Decide o que conceder ao somar dias de plano a alguém.
 *
 * Separada do banco porque as bordas é que importam aqui: quem já tem plano
 * melhor, quem tem acesso sem prazo, e quem está com o período vencido.
 */
export function decidePlanGrant(input: {
  /** Dias que o prêmio concede. */
  days: number;
  /** Plano que o prêmio concede. */
  plan: PlanId;
  now: Date;
  subscription: { plan: string; status: string; currentPeriodEnd: Date | null } | null;
}): PlanGrantDecision {
  if (input.days <= 0) return { action: "skip", reason: "sem_dias" };

  const subscription = input.subscription;

  // Concessão manual do admin não tem prazo (currentPeriodEnd nulo). Somar dias
  // a ela significaria datá-la — tirar acesso em vez de dar.
  if (subscription?.status === "active" && subscription.currentPeriodEnd === null) {
    return { action: "skip", reason: "acesso_sem_prazo" };
  }

  const stillValid =
    subscription?.status === "active" &&
    !!subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > input.now.getTime();

  const currentPlan = stillValid ? subscription!.plan : "free";

  // Quem já tem Família e ganha "30 dias de Pro" recebe os dias no Família.
  const plan = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[input.plan] ?? 0)
    ? (currentPlan as PlanId)
    : input.plan;

  // Período vencido recomeça de hoje: somar sobre uma data no passado entregaria
  // dias que já se foram.
  const base = stillValid ? subscription!.currentPeriodEnd! : input.now;
  const currentPeriodEnd = new Date(base);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + input.days);

  return { action: "grant", plan, currentPeriodEnd };
}

/**
 * Soma dias de plano pago a um usuário e devolve o que foi feito.
 *
 * Reaproveita a mesma ideia da recompensa por indicação (`grantReferralReward`):
 * estender `currentPeriodEnd`. É o que torna um prêmio de "mensalidade paga"
 * entregável na hora, sem fila de operação manual.
 */
export async function grantPlanDays(
  userId: string,
  input: { days: number; plan: PlanId },
): Promise<PlanGrantDecision> {
  const subscription = await db.subscription.findUnique({ where: { userId } });
  const decision = decidePlanGrant({ ...input, now: new Date(), subscription });
  if (decision.action === "skip") return decision;

  await db.subscription.upsert({
    where: { userId },
    update: {
      plan: decision.plan,
      status: "active",
      currentPeriodEnd: decision.currentPeriodEnd,
      // Quem havia cancelado e ganhou dias volta a ter acesso — é o prêmio.
      canceledAt: null,
    },
    create: {
      userId,
      plan: decision.plan,
      status: "active",
      currentPeriodEnd: decision.currentPeriodEnd,
    },
  });

  return decision;
}
