import { db } from "@finances/db";
import type { Prisma } from "@finances/db";

const SINGLETON_ID = "singleton";

/**
 * O que o prêmio entrega de fato.
 *
 * Existe porque o rótulo é texto livre: sem um tipo, um prêmio chamado "30 dias
 * de Pro" com `points: 0` daria confete e nada mais. Os dois tipos são aplicados
 * na hora, sem fila de resgate — o que o rótulo promete, o sistema entrega.
 */
export type SpinPrizeType = "points" | "plan_days";

// `weight` é o peso relativo do prêmio no sorteio (não precisa somar 100 — a
// probabilidade de cada um é weight / soma de todos os weights).
export type SpinPrize = {
  label: string;
  type: SpinPrizeType;
  /** Pontos somados no perfil quando `type === "points"`. */
  points: number;
  /** Dias de assinatura somados quando `type === "plan_days"`. */
  days: number;
  /** Plano concedido junto com os dias — nunca rebaixa quem já tem um melhor. */
  plan: "pro" | "familia";
  weight: number;
};

/** Prêmios padrão usados se a linha singleton ainda não existir (mesmo default do schema). */
export const DEFAULT_SPIN_PRIZES: SpinPrize[] = [
  { label: "10 pontos", type: "points", points: 10, days: 0, plan: "pro", weight: 1 },
  { label: "20 pontos", type: "points", points: 20, days: 0, plan: "pro", weight: 1 },
  { label: "30 pontos", type: "points", points: 30, days: 0, plan: "pro", weight: 1 },
  { label: "50 pontos", type: "points", points: 50, days: 0, plan: "pro", weight: 1 },
  { label: "100 pontos", type: "points", points: 100, days: 0, plan: "pro", weight: 1 },
];

/**
 * Normaliza entradas gravadas antes de campos novos existirem.
 *
 * `weight` veio depois (default 1 = peso igual); `type`/`days`/`plan` vieram
 * depois ainda. Prêmio antigo sem tipo é de pontos, que é o que ele sempre foi.
 */
function normalizePrizes(raw: unknown): SpinPrize[] {
  if (!Array.isArray(raw)) return DEFAULT_SPIN_PRIZES;
  return raw.map((p) => {
    const entry = p as Partial<SpinPrize>;
    const type: SpinPrizeType = entry.type === "plan_days" ? "plan_days" : "points";
    return {
      label: entry.label ?? "",
      type,
      points: type === "points" ? (entry.points ?? 0) : 0,
      days: type === "plan_days" ? (entry.days ?? 0) : 0,
      plan: entry.plan === "familia" ? "familia" : "pro",
      weight: typeof entry.weight === "number" && entry.weight > 0 ? entry.weight : 1,
    };
  });
}

export async function getGamificationSettings(): Promise<{ spinPrizes: SpinPrize[]; updatedAt: Date }> {
  const settings = await db.gamificationSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  return { spinPrizes: normalizePrizes(settings.spinPrizes), updatedAt: settings.updatedAt };
}

export async function updateGamificationSettings(data: {
  spinPrizes?: SpinPrize[];
}): Promise<{ spinPrizes: SpinPrize[]; updatedAt: Date }> {
  const payload: Prisma.GamificationSettingsUpsertArgs["create"] = {
    id: SINGLETON_ID,
    ...(data.spinPrizes ? { spinPrizes: data.spinPrizes as unknown as Prisma.InputJsonValue } : {}),
  };
  const settings = await db.gamificationSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data.spinPrizes ? { spinPrizes: data.spinPrizes as unknown as Prisma.InputJsonValue } : {},
    create: payload,
  });
  return { spinPrizes: normalizePrizes(settings.spinPrizes), updatedAt: settings.updatedAt };
}
