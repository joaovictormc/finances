import { db } from "@finances/db";
import type { Prisma } from "@finances/db";

const SINGLETON_ID = "singleton";

export type SpinPrize = { label: string; points: number };

/** Prêmios padrão usados se a linha singleton ainda não existir (mesmo default do schema). */
export const DEFAULT_SPIN_PRIZES: SpinPrize[] = [
  { label: "10 pontos", points: 10 },
  { label: "20 pontos", points: 20 },
  { label: "30 pontos", points: 30 },
  { label: "50 pontos", points: 50 },
  { label: "100 pontos", points: 100 },
];

export async function getGamificationSettings(): Promise<{ spinPrizes: SpinPrize[]; updatedAt: Date }> {
  const settings = await db.gamificationSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  return { spinPrizes: settings.spinPrizes as unknown as SpinPrize[], updatedAt: settings.updatedAt };
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
  return { spinPrizes: settings.spinPrizes as unknown as SpinPrize[], updatedAt: settings.updatedAt };
}
