import { db } from "@finances/db";
import type { Prisma } from "@finances/db";

const SINGLETON_ID = "singleton";

// `weight` é o peso relativo do prêmio no sorteio (não precisa somar 100 — a
// probabilidade de cada um é weight / soma de todos os weights).
export type SpinPrize = { label: string; points: number; weight: number };

/** Prêmios padrão usados se a linha singleton ainda não existir (mesmo default do schema). */
export const DEFAULT_SPIN_PRIZES: SpinPrize[] = [
  { label: "10 pontos", points: 10, weight: 1 },
  { label: "20 pontos", points: 20, weight: 1 },
  { label: "30 pontos", points: 30, weight: 1 },
  { label: "50 pontos", points: 50, weight: 1 },
  { label: "100 pontos", points: 100, weight: 1 },
];

/** Normaliza entradas salvas antes do campo `weight` existir (default 1 = peso igual). */
function normalizePrizes(raw: unknown): SpinPrize[] {
  if (!Array.isArray(raw)) return DEFAULT_SPIN_PRIZES;
  return raw.map((p) => {
    const entry = p as Partial<SpinPrize>;
    return {
      label: entry.label ?? "",
      points: entry.points ?? 0,
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
