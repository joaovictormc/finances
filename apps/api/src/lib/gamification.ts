import { db } from "@finances/db";
import { getGamificationSettings, DEFAULT_SPIN_PRIZES, type SpinPrize } from "./gamification-settings";
import { grantPlanDays, type PlanGrantDecision } from "./plan-grant";
import { PLANS } from "./plans";
import { sendNotification } from "./notifications";
import { describePrize } from "./prize-description";

/**
 * Sorteia um prêmio ponderado pelo `weight` de cada um (não confia em RNG do
 * cliente — sempre chamado no servidor). Reaproveitado por `rollWeeklySpin`
 * (sorteio real) e `simulateSpins` (simulação no admin, sem side effects).
 */
export function pickWeightedPrize(prizes: SpinPrize[]): SpinPrize {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return prizes[prizes.length - 1]!; // fallback por arredondamento de ponto flutuante
}

export type SpinSimulationResult = {
  label: string;
  points: number;
  weight: number;
  configuredProbability: number;
  count: number;
  observedProbability: number;
};

/** Roda N sorteios em memória (sem tocar em GamificationProfile) pra validar as probabilidades configuradas. */
export function simulateSpins(prizes: SpinPrize[], spins: number): SpinSimulationResult[] {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  const counts = new Map<string, number>();
  for (let i = 0; i < spins; i++) {
    const prize = pickWeightedPrize(prizes);
    counts.set(prize.label, (counts.get(prize.label) ?? 0) + 1);
  }
  return prizes.map((p) => {
    const count = counts.get(p.label) ?? 0;
    return {
      label: p.label,
      points: p.points,
      weight: p.weight,
      configuredProbability: totalWeight > 0 ? p.weight / totalWeight : 0,
      count,
      observedProbability: spins > 0 ? count / spins : 0,
    };
  });
}

// Pontos ganhos por transação registrada; bônus na primeira do dia (incentiva
// o registro diário sem exigir múltiplos lançamentos).
const POINTS_PER_TRANSACTION = 5;
const FIRST_TRANSACTION_OF_DAY_BONUS = 10;

// Streak só desbloqueia a Roleta Semanal a partir de 7 dias consecutivos.
export const SPIN_UNLOCK_STREAK = 7;

// Tabela de thresholds de nível: level N precisa de LEVEL_THRESHOLDS[N-1] pontos acumulados.
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

export function getLevelForPoints(points: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    const threshold = LEVEL_THRESHOLDS[i]!;
    if (points >= threshold) level = i + 1;
  }
  return level;
}

function toDateOnlyUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function diffInDays(a: Date, b: Date): number {
  const ms = toDateOnlyUTC(a).getTime() - toDateOnlyUTC(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Chamada fire-and-forget depois de criar uma transação (mesmo padrão não-bloqueante
 * já usado para sugestão de categoria por IA). Incrementa pontos, recalcula streak
 * (dias consecutivos com pelo menos 1 transação) e nível.
 */
export async function awardDailyPoints(userId: string, transactionDate: Date): Promise<void> {
  try {
    const today = toDateOnlyUTC(transactionDate);

    const profile = await db.gamificationProfile.findUnique({ where: { userId } });

    if (!profile) {
      await db.gamificationProfile.create({
        data: {
          userId,
          points: POINTS_PER_TRANSACTION + FIRST_TRANSACTION_OF_DAY_BONUS,
          level: getLevelForPoints(POINTS_PER_TRANSACTION + FIRST_TRANSACTION_OF_DAY_BONUS),
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: today,
        },
      });
      return;
    }

    const lastActivity = profile.lastActivityDate ? toDateOnlyUTC(profile.lastActivityDate) : null;
    const daysSinceLastActivity = lastActivity ? diffInDays(today, lastActivity) : null;

    // Segunda transação do mesmo dia: soma pontos, mas não mexe em streak/lastActivityDate de novo.
    if (daysSinceLastActivity === 0) {
      const points = profile.points + POINTS_PER_TRANSACTION;
      await db.gamificationProfile.update({
        where: { userId },
        data: { points, level: getLevelForPoints(points) },
      });
      return;
    }

    let currentStreak: number;
    if (daysSinceLastActivity === 1) {
      // Dia seguinte ao último registro: streak continua.
      currentStreak = profile.currentStreak + 1;
    } else {
      // Hiato (ou primeiro registro depois de nunca ter tido lastActivityDate): reseta.
      currentStreak = 1;
    }

    const points = profile.points + POINTS_PER_TRANSACTION + FIRST_TRANSACTION_OF_DAY_BONUS;

    await db.gamificationProfile.update({
      where: { userId },
      data: {
        points,
        level: getLevelForPoints(points),
        currentStreak,
        longestStreak: Math.max(profile.longestStreak, currentStreak),
        lastActivityDate: today,
      },
    });
  } catch (err) {
    // Nunca deixa a criação da transação falhar por causa de gamificação.
    console.error("[gamification] falha ao computar pontos/streak:", err);
  }
}


/** Campos comuns ao giro grátis e ao comprado. */
type SpinAward = {
  prizeLabel: string;
  prizeType: "points" | "plan_days";
  /** Pontos somados — sempre 0 num prêmio de dias de plano. */
  prizePoints: number;
  /** Dias de plano concedidos — sempre 0 num prêmio de pontos. */
  prizeDays: number;
  /** Frase pronta: "+30 dias de Pro" ou "+50 pontos". */
  prizeSummary: string;
  /** Saldo e nível já atualizados. */
  points: number;
  level: number;
};

type SpinResult =
  | ({ ok: true } & SpinAward)
  | { ok: false; reason: "streak_insufficiente" | "ja_girou_essa_semana" | "perfil_nao_encontrado" };

function startOfIsoWeekUTC(date: Date): Date {
  const d = toDateOnlyUTC(date);
  const day = d.getUTCDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

/** Sorteia e aplica o prêmio da Roleta Semanal. Idempotente por semana (ISO, seg-dom). */
export async function rollWeeklySpin(userId: string): Promise<SpinResult> {
  const profile = await db.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, reason: "perfil_nao_encontrado" };
  if (profile.currentStreak < SPIN_UNLOCK_STREAK) return { ok: false, reason: "streak_insufficiente" };

  const now = new Date();
  if (profile.lastSpinAt) {
    const currentWeekStart = startOfIsoWeekUTC(now);
    const lastSpinWeekStart = startOfIsoWeekUTC(profile.lastSpinAt);
    if (currentWeekStart.getTime() === lastSpinWeekStart.getTime()) {
      return { ok: false, reason: "ja_girou_essa_semana" };
    }
  }

  const settings = await getGamificationSettings();
  const spinPrizes = settings.spinPrizes.length > 0 ? settings.spinPrizes : DEFAULT_SPIN_PRIZES;
  const prize = pickWeightedPrize(spinPrizes);
  await applyPlanDaysPrize(userId, prize);

  const prizePoints = prize.type === "points" ? prize.points : 0;
  const points = profile.points + prizePoints;

  const updated = await db.gamificationProfile.update({
    where: { userId },
    data: { points, level: getLevelForPoints(points), lastSpinAt: now },
  });

  await logSpin(userId, prize, "weekly");

  return {
    ok: true,
    prizeLabel: prize.label,
    prizeType: prize.type,
    prizePoints,
    prizeDays: prize.days,
    prizeSummary: describePrize(prize),
    points: updated.points,
    level: updated.level,
  };
}

/**
 * Aplica a parte de plano do prêmio, quando houver.
 *
 * Chamada ANTES de marcar o giro como usado: se a concessão falhar, o usuário
 * não perde o giro da semana nem os pontos gastos, e pode tentar de novo. Na
 * ordem inversa ele veria o confete e não receberia nada — exatamente o que o
 * tipo de prêmio existe pra impedir.
 */
async function applyPlanDaysPrize(userId: string, prize: SpinPrize): Promise<PlanGrantDecision | null> {
  if (prize.type !== "plan_days") return null;

  const decision = await grantPlanDays(userId, { days: prize.days, plan: prize.plan });
  if (decision.action !== "grant") return decision;

  try {
    await sendNotification(userId, {
      type: "spin_plan_days",
      link: "/settings/billing",
      title: `Você ganhou ${prize.days} dias de ${PLANS[decision.plan].name}! 🎉`,
      body: `Seu acesso ao plano ${PLANS[decision.plan].name} vale até ${decision.currentPeriodEnd.toLocaleDateString("pt-BR")}.`,
    });
  } catch (err) {
    // O prêmio já está concedido; falhar o giro por causa do aviso seria pior.
    console.error("[gamification] falha ao avisar sobre dias de plano do prêmio:", err);
  }

  return decision;
}

/** Registra o resultado de um giro real (grátis ou comprado) — nunca deixa o giro falhar por causa do log. */
async function logSpin(userId: string, prize: SpinPrize, source: "weekly" | "purchased"): Promise<void> {
  try {
    await db.gamificationSpinLog.create({
      data: {
        userId,
        prizeLabel: prize.label,
        prizePoints: prize.points,
        prizeType: prize.type,
        prizeDays: prize.days,
        source,
      },
    });
  } catch (err) {
    console.error("[gamification] falha ao registrar log de giro:", err);
  }
}

// Custo em pontos pra comprar um giro avulso, sem depender da streak de 7 dias
// nem do limite semanal do giro grátis — mecânica independente (gasta pontos,
// ganha um prêmio sorteado igual ao giro normal).
export const EXTRA_SPIN_COST = 50;

type BuySpinResult =
  | ({ ok: true } & SpinAward)
  | { ok: false; reason: "pontos_insuficientes" | "perfil_nao_encontrado" };

/** Compra um giro avulso com pontos — não mexe em streak/lastSpinAt (giro grátis semanal continua intacto). */
export async function buyExtraSpin(userId: string): Promise<BuySpinResult> {
  const profile = await db.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, reason: "perfil_nao_encontrado" };
  if (profile.points < EXTRA_SPIN_COST) return { ok: false, reason: "pontos_insuficientes" };

  const settings = await getGamificationSettings();
  const spinPrizes = settings.spinPrizes.length > 0 ? settings.spinPrizes : DEFAULT_SPIN_PRIZES;
  const prize = pickWeightedPrize(spinPrizes);
  await applyPlanDaysPrize(userId, prize);

  const prizePoints = prize.type === "points" ? prize.points : 0;
  const points = profile.points - EXTRA_SPIN_COST + prizePoints;

  const updated = await db.gamificationProfile.update({
    where: { userId },
    data: { points, level: getLevelForPoints(points) },
  });

  await logSpin(userId, prize, "purchased");

  return {
    ok: true,
    prizeLabel: prize.label,
    prizeType: prize.type,
    prizePoints,
    prizeDays: prize.days,
    prizeSummary: describePrize(prize),
    points: updated.points,
    level: updated.level,
  };
}

/** Últimos N giros reais do usuário (para exibir em /rewards). */
export async function getSpinHistory(userId: string, limit = 10) {
  const entries = await db.gamificationSpinLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      prizeLabel: true,
      prizePoints: true,
      prizeType: true,
      prizeDays: true,
      source: true,
      createdAt: true,
    },
  });

  return entries.map((entry) => ({
    ...entry,
    summary: describePrize({
      type: entry.prizeType,
      points: entry.prizePoints,
      days: entry.prizeDays,
    }),
  }));
}

// ── Estatísticas reais de uso (admin) ─────────────────────────────────────────

export type GamificationStats = {
  activeUsers: number;
  spinsThisWeek: number;
  totalSpins: number;
  levelDistribution: { level: number; count: number }[];
  badgeRedemptions: { slug: string; label: string; icon: string; count: number }[];
  topPrizes: { label: string; count: number }[];
};

export async function getGamificationStats(): Promise<GamificationStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeUsers, spinsThisWeek, totalSpins, levelGroups, badgeCounts, prizeGroups] = await Promise.all([
    db.gamificationProfile.count(),
    db.gamificationSpinLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.gamificationSpinLog.count(),
    db.gamificationProfile.groupBy({ by: ["level"], _count: { level: true }, orderBy: { level: "asc" } }),
    Promise.all(
      BADGE_CATALOG.map(async (b) => ({
        slug: b.slug,
        label: b.label,
        icon: b.icon,
        count: await db.gamificationProfile.count({ where: { unlockedBadges: { has: b.slug } } }),
      }))
    ),
    db.gamificationSpinLog.groupBy({
      by: ["prizeLabel"],
      _count: { prizeLabel: true },
      orderBy: { _count: { prizeLabel: "desc" } },
      take: 5,
    }),
  ]);

  return {
    activeUsers,
    spinsThisWeek,
    totalSpins,
    levelDistribution: levelGroups.map((g) => ({ level: g.level, count: g._count.level })),
    badgeRedemptions: badgeCounts.sort((a, b) => b.count - a.count),
    topPrizes: prizeGroups.map((g) => ({ label: g.prizeLabel, count: g._count.prizeLabel })),
  };
}

// ── Loja de emblemas ──────────────────────────────────────────────────────────
// Catálogo estático (não precisa de gerência no admin, ao contrário dos prêmios
// da roleta) — resgatável com pontos acumulados, puramente cosmético (exibido
// perto do nome do usuário), sem efeito em regras de negócio.
export type Badge = { slug: string; label: string; icon: string; cost: number };

export const BADGE_CATALOG: Badge[] = [
  { slug: "poupador", label: "Poupador Nato", icon: "🐷", cost: 50 },
  { slug: "disciplinado", label: "Disciplinado", icon: "🔥", cost: 150 },
  { slug: "estrategista", label: "Estrategista", icon: "🧠", cost: 300 },
  { slug: "lenda", label: "Lenda das Finanças", icon: "👑", cost: 600 },
];

type RedeemBadgeResult =
  | { ok: true; unlockedBadges: string[]; points: number }
  | { ok: false; reason: "emblema_invalido" | "ja_desbloqueado" | "pontos_insuficientes" | "perfil_nao_encontrado" };

export async function redeemBadge(userId: string, slug: string): Promise<RedeemBadgeResult> {
  const badge = BADGE_CATALOG.find((b) => b.slug === slug);
  if (!badge) return { ok: false, reason: "emblema_invalido" };

  const profile = await db.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, reason: "perfil_nao_encontrado" };
  if (profile.unlockedBadges.includes(slug)) return { ok: false, reason: "ja_desbloqueado" };
  if (profile.points < badge.cost) return { ok: false, reason: "pontos_insuficientes" };

  const updated = await db.gamificationProfile.update({
    where: { userId },
    data: { points: profile.points - badge.cost, unlockedBadges: { push: slug } },
  });

  return { ok: true, unlockedBadges: updated.unlockedBadges, points: updated.points };
}

type SetActiveBadgeResult =
  | { ok: true; activeBadge: string | null }
  | { ok: false; reason: "emblema_nao_desbloqueado" | "perfil_nao_encontrado" };

/** `slug: null` remove o emblema em exibição. Não custa pontos — só equipa algo já resgatado. */
export async function setActiveBadge(userId: string, slug: string | null): Promise<SetActiveBadgeResult> {
  const profile = await db.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, reason: "perfil_nao_encontrado" };
  if (slug !== null && !profile.unlockedBadges.includes(slug)) {
    return { ok: false, reason: "emblema_nao_desbloqueado" };
  }

  const updated = await db.gamificationProfile.update({ where: { userId }, data: { activeBadge: slug } });
  return { ok: true, activeBadge: updated.activeBadge };
}

/** Gera o AiInsight `weekly_recap` de um usuário (chamado pelo job semanal fan-out). */
export async function generateWeeklyRecap(userId: string): Promise<void> {
  const profile = await db.gamificationProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const title =
    profile.currentStreak >= SPIN_UNLOCK_STREAK
      ? `🔥 Sequência de ${profile.currentStreak} dias — roleta semanal liberada!`
      : `Resumo da semana: nível ${profile.level}`;

  const body =
    profile.currentStreak >= SPIN_UNLOCK_STREAK
      ? `Você está há ${profile.currentStreak} dias consecutivos registrando transações! Já pode girar a Roleta Semanal e ganhar pontos bônus. Total acumulado: ${profile.points} pontos (nível ${profile.level}).`
      : `Você acumulou ${profile.points} pontos e está no nível ${profile.level}. Mantenha uma sequência de ${SPIN_UNLOCK_STREAK} dias consecutivos registrando transações pra desbloquear a Roleta Semanal.`;

  await db.aiInsight.create({
    data: {
      userId,
      type: "weekly_recap",
      title,
      body,
      severity: profile.currentStreak >= SPIN_UNLOCK_STREAK ? "success" : "info",
      data: { points: profile.points, level: profile.level, currentStreak: profile.currentStreak },
    },
  });
}
