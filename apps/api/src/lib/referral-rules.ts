import { db } from "@finances/db";
import { getPlan } from "./plans";

type Rule = NonNullable<Awaited<ReturnType<typeof db.referralRewardRule.findFirst>>>;

/** Regra sem período, sempre existente. Na criação, mesma recompensa para quem paga e para quem está no Free. */
export async function ensureDefaultRule(): Promise<Rule> {
  const existing = await db.referralRewardRule.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return db.referralRewardRule.create({
    data: {
      name: "Padrão",
      isDefault: true,
      paidReferrerDays: 30,
      freeRewardType: "plan_days",
      freeRewardPlan: "pro",
      freeRewardDays: 30,
    },
  });
}

/**
 * Campanha vigente agora (ativa e dentro do período), ou a regra padrão. Com
 * campanhas sobrepostas, vale a que começou por último.
 */
export async function currentRule(now = new Date()): Promise<Rule> {
  const campaign = await db.referralRewardRule.findFirst({
    where: {
      isDefault: false,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });
  return campaign ?? ensureDefaultRule();
}

export type ReferrerReward =
  | { kind: "plan_days"; days: number; plan: "pro" | "familia" | "own" }
  | { kind: "points"; points: number }
  | { kind: "none" };

/** O que quem indica ganha, conforme já pague ou esteja no Free. */
export function rewardFor(rule: Rule, referrerPays: boolean): ReferrerReward {
  if (referrerPays) {
    return rule.paidReferrerDays > 0 ? { kind: "plan_days", days: rule.paidReferrerDays, plan: "own" } : { kind: "none" };
  }
  if (rule.freeRewardType === "plan_days" && rule.freeRewardDays > 0) {
    return { kind: "plan_days", days: rule.freeRewardDays, plan: rule.freeRewardPlan === "familia" ? "familia" : "pro" };
  }
  if (rule.freeRewardType === "points" && rule.freeRewardPoints > 0) {
    return { kind: "points", points: rule.freeRewardPoints };
  }
  return { kind: "none" };
}

/** Frase curta da recompensa: "30 dias grátis no seu plano", "30 dias de Pro", "200 pontos". */
export function describeReward(reward: ReferrerReward): string | null {
  if (reward.kind === "none") return null;
  if (reward.kind === "points") return `${reward.points} pontos`;
  if (reward.plan === "own") return `${reward.days} dias grátis no seu plano`;
  return `${reward.days} dias de ${getPlan(reward.plan).name}`;
}
