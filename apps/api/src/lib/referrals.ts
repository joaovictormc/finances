import { db } from "@finances/db";
import { sendNotification } from "./notifications";
import { decidePlanGrant } from "./plan-grant";
import type { PlanId } from "./plans";

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

  // Mesma regra do prêmio de dias da roleta. Antes a conta era
  // `currentPeriodEnd ?? new Date()` mais 30 dias, e errava nas duas pontas:
  // período já vencido somava sobre uma data no passado (bônus que não valia
  // nada), e período nulo — acesso sem prazo de uma concessão manual do admin —
  // virava uma assinatura de 30 dias, rebaixando quem indicou.
  //
  // O plano é o do próprio indicador: a recompensa dá tempo, não upgrade.
  const decision = decidePlanGrant({
    days: REFERRAL_REWARD_DAYS,
    plan: referrerSubscription.plan as PlanId,
    now: new Date(),
    subscription: referrerSubscription,
  });

  if (decision.action !== "grant") {
    // Acesso sem prazo não ganha data. A indicação é consumida mesmo assim,
    // senão ficaria pendente pra sempre — esta função só roda uma vez, na
    // primeira assinatura de quem foi indicado.
    await db.referral.update({ where: { id: referral.id }, data: { rewardGranted: true } });
    return;
  }

  await db.$transaction([
    db.subscription.update({
      where: { userId: referral.referrerId },
      data: { currentPeriodEnd: decision.currentPeriodEnd },
    }),
    db.referral.update({
      where: { id: referral.id },
      data: { rewardGranted: true },
    }),
  ]);

  await sendNotification(referral.referrerId, {
    type: "referral_reward",
    link: "/rewards",
    title: "Você ganhou 30 dias grátis! 🎉",
    body: "Alguém que você indicou assinou um plano pago. Adicionamos 30 dias à sua assinatura como recompensa.",
  });
}
