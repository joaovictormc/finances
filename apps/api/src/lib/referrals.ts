import { db } from "@finances/db";
import { sendNotification } from "./notifications";
import { grantPlanDays } from "./plan-grant";
import { hasPaidAccess } from "./plan-limits";
import { getLevelForPoints } from "./gamification";
import { currentRule, describeReward, ensureDefaultRule, rewardFor } from "./referral-rules";
import type { PlanId } from "./plans";

export async function getOrCreateReferralCode(userId: string) {
  return db.referralCode.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function redeemReferralCode(userId: string, code: string) {
  const referralCode = await db.referralCode.findUnique({ where: { code } });
  if (!referralCode) throw new Error("Código de indicação inválido");
  if (referralCode.userId === userId) throw new Error("Você não pode indicar a si mesmo");

  const existing = await db.referral.findUnique({ where: { referredId: userId } });
  if (existing) return existing;

  // Guarda a regra vigente agora: a recompensa sai dela quando o indicado
  // assinar, mesmo que a campanha já tenha acabado até lá.
  const rule = await currentRule();
  return db.referral.create({
    data: { referrerId: referralCode.userId, referredId: userId, rewardRuleId: rule.id },
  });
}

/**
 * Chamado quando o indicado assina um plano pago pela primeira vez. A
 * recompensa segue a regra guardada no cadastro do indicado: quem indica e já
 * paga ganha dias no próprio plano; quem está no Free ganha o que a regra
 * definir (dias de um plano, pontos ou nada).
 */
export async function grantReferralReward(referredUserId: string) {
  const referral = await db.referral.findUnique({
    where: { referredId: referredUserId },
    include: { rewardRule: true },
  });
  if (!referral || referral.rewardGranted) return;

  // Reivindica antes de conceder: dois webhooks simultâneos não pagam duas vezes.
  const { count } = await db.referral.updateMany({
    where: { id: referral.id, rewardGranted: false },
    data: { rewardGranted: true },
  });
  if (count === 0) return;

  const rule = referral.rewardRule ?? (await ensureDefaultRule());
  const subscription = await db.subscription.findUnique({ where: { userId: referral.referrerId } });
  const referrerPays = !!subscription && subscription.plan !== "free" && hasPaidAccess(subscription);
  const reward = rewardFor(rule, referrerPays);

  if (reward.kind === "none") return;

  if (reward.kind === "points") {
    const profile = await db.gamificationProfile.upsert({
      where: { userId: referral.referrerId },
      update: { points: { increment: reward.points } },
      create: { userId: referral.referrerId, points: reward.points },
    });
    await db.gamificationProfile.update({
      where: { userId: referral.referrerId },
      data: { level: getLevelForPoints(profile.points) },
    });
  } else {
    // "own" = o plano de quem já paga: a recompensa dá tempo, não upgrade.
    const plan = (reward.plan === "own" ? subscription!.plan : reward.plan) as PlanId;
    const decision = await grantPlanDays(referral.referrerId, { days: reward.days, plan });
    // Acesso sem prazo (concessão do admin) não ganha data: nada a avisar.
    if (decision.action !== "grant") return;
  }

  const summary = describeReward(reward)!;
  await sendNotification(referral.referrerId, {
    type: "referral_reward",
    link: "/rewards",
    title: `Você ganhou ${summary}! 🎉`,
    body: `Alguém que você indicou assinou um plano pago. Sua recompensa: ${summary}.`,
  });
}
