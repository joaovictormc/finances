import { db } from "@finances/db";
import {
  RECEIPT_REWARD_TERMS,
  RECEIPT_REWARD_TERMS_VERSION,
  type ReceiptRewardStatus,
} from "@finances/validations";
import { ACCESS_KEY_MESSAGES, extractAccessKey, validateAccessKey } from "./access-key";
import { getGamificationSettings } from "./gamification-settings";
import { isUniqueViolation } from "./prisma-errors";

/**
 * Área de recompensa por cupom fiscal. Só participa quem aceitou o termo
 * próprio (RECEIPT_REWARD_TERMS) na versão atual; a recompensa, por enquanto,
 * são pontos da gamificação.
 */

const DAY_MS = 86_400_000;
/** Brasil sem horário de verão desde 2019: o dia começa às 03:00 UTC. */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

function startOfTodayBrt(now: Date): Date {
  const shifted = new Date(now.getTime() - BRT_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + BRT_OFFSET_MS);
}

async function activeConsent(userId: string) {
  const latest = await db.receiptRewardConsent.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { acceptedAt: "desc" },
  });
  return {
    row: latest,
    active: !!latest && latest.termsVersion === RECEIPT_REWARD_TERMS_VERSION,
    outdated: !!latest && latest.termsVersion !== RECEIPT_REWARD_TERMS_VERSION,
  };
}

async function usage(userId: string, now: Date) {
  const [today, week] = await Promise.all([
    db.rewardReceipt.count({ where: { userId, status: "approved", createdAt: { gte: startOfTodayBrt(now) } } }),
    db.rewardReceipt.count({ where: { userId, status: "approved", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
  ]);
  return { today, week };
}

export async function getReceiptRewardStatus(userId: string, now = new Date()): Promise<ReceiptRewardStatus> {
  const [settings, consent, used, totals, history] = await Promise.all([
    getGamificationSettings(),
    activeConsent(userId),
    usage(userId, now),
    db.rewardReceipt.aggregate({ where: { userId, status: "approved" }, _count: true, _sum: { points: true } }),
    db.rewardReceipt.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const rules = settings.receiptReward;
  return {
    enabled: rules.enabled,
    terms: { version: RECEIPT_REWARD_TERMS_VERSION, sections: RECEIPT_REWARD_TERMS },
    consent: {
      active: consent.active,
      acceptedAt: consent.active ? consent.row!.acceptedAt.toISOString() : null,
      outdated: consent.outdated,
    },
    rules: {
      pointsPerReceipt: rules.points,
      dailyLimit: rules.dailyLimit,
      weeklyLimit: rules.weeklyLimit,
      maxAgeDays: rules.maxAgeDays,
    },
    usage: used,
    totals: { receipts: totals._count, points: totals._sum.points ?? 0 },
    history: history.map((r) => ({
      id: r.id,
      uf: r.uf,
      model: r.model,
      issuedMonth: r.issuedMonth,
      status: r.status,
      points: r.points,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function acceptReceiptRewardTerms(
  userId: string,
  version: string,
  meta: { ipAddress?: string | null; userAgent?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Aceitar uma versão que a tela não mostrou (cache antigo) não vale.
  if (version !== RECEIPT_REWARD_TERMS_VERSION) {
    return { ok: false, error: "O termo foi atualizado. Recarregue a tela e leia a versão nova." };
  }
  const consent = await activeConsent(userId);
  if (consent.active) return { ok: true };
  await db.$transaction([
    // Versão anterior aceita deixa de valer ao aceitar a nova.
    db.receiptRewardConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.receiptRewardConsent.create({
      data: {
        userId,
        termsVersion: version,
        ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    }),
  ]);
  return { ok: true };
}

/** Sair do programa: não envia mais cupons; o histórico fica (evita reuso do cupom). */
export async function revokeReceiptRewardTerms(userId: string) {
  await db.receiptRewardConsent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export type SubmitResult =
  | { ok: true; points: number; uf: string; issuedMonth: string }
  | { ok: false; status: 400 | 403 | 409 | 429; error: string };

export async function submitRewardReceipt(userId: string, code: string, now = new Date()): Promise<SubmitResult> {
  const { receiptReward: rules } = await getGamificationSettings();
  if (!rules.enabled) return { ok: false, status: 403, error: "O programa de recompensa por cupom não está ativo no momento." };

  const consent = await activeConsent(userId);
  if (!consent.active) {
    return { ok: false, status: 403, error: "Para enviar cupons, aceite o termo do programa." };
  }

  const key = extractAccessKey(code);
  if (!key) return { ok: false, status: 400, error: ACCESS_KEY_MESSAGES.formato };
  const checked = validateAccessKey(key, { now, maxAgeDays: rules.maxAgeDays });
  if (!checked.ok) {
    const error =
      checked.reason === "antigo"
        ? `Este cupom é antigo demais: valem compras dos últimos ${rules.maxAgeDays} dias.`
        : ACCESS_KEY_MESSAGES[checked.reason];
    return { ok: false, status: 400, error };
  }

  const used = await usage(userId, now);
  if (used.today >= rules.dailyLimit) {
    return { ok: false, status: 429, error: `Você já enviou ${rules.dailyLimit} cupom(ns) hoje. Volte amanhã.` };
  }
  if (used.week >= rules.weeklyLimit) {
    return { ok: false, status: 429, error: `Limite de ${rules.weeklyLimit} cupons em 7 dias atingido. Tente de novo em alguns dias.` };
  }

  const { info } = checked;
  try {
    await db.$transaction([
      db.rewardReceipt.create({
        data: {
          userId,
          accessKey: info.key,
          uf: info.uf,
          model: info.model,
          issuerCnpj: info.cnpj,
          issuedMonth: info.issuedMonth,
          points: rules.points,
        },
      }),
      db.gamificationProfile.upsert({
        where: { userId },
        update: { points: { increment: rules.points } },
        create: { userId, points: rules.points },
      }),
    ]);
  } catch (error) {
    // A chave é única no sistema inteiro: a mesma nota não vale duas vezes.
    if (isUniqueViolation(error)) return { ok: false, status: 409, error: "Este cupom já foi enviado." };
    throw error;
  }
  return { ok: true, points: rules.points, uf: info.uf, issuedMonth: info.issuedMonth };
}
