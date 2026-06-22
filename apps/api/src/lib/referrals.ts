import { db } from "@finances/db";
import { sendNotification } from "./notifications";

const REFERRAL_REWARD_DAYS = 30;

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

  return db.referral.create({
    data: { referrerId: referralCode.userId, referredId: userId },
  });
}

// Chamado quando o usuário indicado assina um plano pago pela primeira vez.
// Recompensa: estende a assinatura ativa de quem indicou em 30 dias.
export async function grantReferralReward(referredUserId: string) {
  const referral = await db.referral.findUnique({ where: { referredId: referredUserId } });
  if (!referral || referral.rewardGranted) return;

  const referrerSubscription = await db.subscription.findUnique({
    where: { userId: referral.referrerId },
  });
  if (!referrerSubscription || referrerSubscription.status !== "active") return;

  const base = referrerSubscription.currentPeriodEnd ?? new Date();
  const extended = new Date(base);
  extended.setDate(extended.getDate() + REFERRAL_REWARD_DAYS);

  await db.$transaction([
    db.subscription.update({
      where: { userId: referral.referrerId },
      data: { currentPeriodEnd: extended },
    }),
    db.referral.update({
      where: { id: referral.id },
      data: { rewardGranted: true },
    }),
  ]);

  await sendNotification(referral.referrerId, {
    type: "referral_reward",
    title: "Você ganhou 30 dias grátis! 🎉",
    body: "Alguém que você indicou assinou um plano pago. Adicionamos 30 dias à sua assinatura como recompensa.",
  });
}
