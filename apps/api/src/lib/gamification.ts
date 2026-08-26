import { db } from "@finances/db";

// Pontos ganhos por transação registrada; bônus na primeira do dia (incentiva
// o registro diário sem exigir múltiplos lançamentos).
const POINTS_PER_TRANSACTION = 5;
const FIRST_TRANSACTION_OF_DAY_BONUS = 10;

// Streak só desbloqueia a Roleta Semanal a partir de 7 dias consecutivos.
export const SPIN_UNLOCK_STREAK = 7;

// Prêmios da Roleta Semanal — sorteio sempre no servidor, nunca confia em RNG do cliente.
const SPIN_PRIZES = [10, 20, 30, 50, 100] as const;

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

type SpinResult =
  | { ok: true; prize: number; points: number; level: number }
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

  const prize = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)]!;
  const points = profile.points + prize;

  const updated = await db.gamificationProfile.update({
    where: { userId },
    data: { points, level: getLevelForPoints(points), lastSpinAt: now },
  });

  return { ok: true, prize, points: updated.points, level: updated.level };
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
