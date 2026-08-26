import { Hono } from "hono";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { rollWeeklySpin, SPIN_UNLOCK_STREAK } from "../lib/gamification";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/profile", async (c) => {
  const userId = c.get("userId");

  const profile = await db.gamificationProfile.findUnique({ where: { userId } });

  if (!profile) {
    return c.json({
      points: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      lastSpinAt: null,
      spinUnlockStreak: SPIN_UNLOCK_STREAK,
      canSpin: false,
    });
  }

  const canSpin =
    profile.currentStreak >= SPIN_UNLOCK_STREAK &&
    (!profile.lastSpinAt || daysSince(profile.lastSpinAt) >= 7);

  return c.json({ ...profile, spinUnlockStreak: SPIN_UNLOCK_STREAK, canSpin });
});

app.post("/spin", async (c) => {
  const userId = c.get("userId");
  const result = await rollWeeklySpin(userId);

  if (!result.ok) {
    const messages: Record<string, string> = {
      streak_insufficiente: `Você precisa de uma sequência de ${SPIN_UNLOCK_STREAK} dias consecutivos pra girar a roleta.`,
      ja_girou_essa_semana: "Você já girou a roleta essa semana. Volta semana que vem!",
      perfil_nao_encontrado: "Nenhum registro de gamificação encontrado ainda — registre uma transação primeiro.",
    };
    return c.json({ error: messages[result.reason] }, 400);
  }

  return c.json(result);
});

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export default app;
