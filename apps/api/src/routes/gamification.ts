import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import {
  rollWeeklySpin,
  buyExtraSpin,
  redeemBadge,
  setActiveBadge,
  getSpinHistory,
  SPIN_UNLOCK_STREAK,
  EXTRA_SPIN_COST,
  BADGE_CATALOG,
} from "../lib/gamification";
import { getGamificationSettings } from "../lib/gamification-settings";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/profile", async (c) => {
  const userId = c.get("userId");

  // Rótulo/pontos (sem o peso, que é detalhe de config do admin) — o front usa
  // pra desenhar a roleta visual com os mesmos setores/textos do sorteio real.
  const settings = await getGamificationSettings();
  const prizes = settings.spinPrizes.map((p) => ({ label: p.label, points: p.points }));

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
      prizes,
      extraSpinCost: EXTRA_SPIN_COST,
      unlockedBadges: [],
      activeBadge: null,
    });
  }

  const canSpin =
    profile.currentStreak >= SPIN_UNLOCK_STREAK &&
    (!profile.lastSpinAt || daysSince(profile.lastSpinAt) >= 7);

  return c.json({
    ...profile,
    spinUnlockStreak: SPIN_UNLOCK_STREAK,
    canSpin,
    prizes,
    extraSpinCost: EXTRA_SPIN_COST,
  });
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

app.post("/buy-spin", async (c) => {
  const userId = c.get("userId");
  const result = await buyExtraSpin(userId);

  if (!result.ok) {
    const messages: Record<string, string> = {
      pontos_insuficientes: `Você precisa de pelo menos ${EXTRA_SPIN_COST} pontos pra comprar um giro avulso.`,
      perfil_nao_encontrado: "Nenhum registro de gamificação encontrado ainda — registre uma transação primeiro.",
    };
    return c.json({ error: messages[result.reason] }, 400);
  }

  return c.json(result);
});

// ── Loja de emblemas ──────────────────────────────────────────────────────────

app.get("/badges", async (c) => {
  const userId = c.get("userId");
  const profile = await db.gamificationProfile.findUnique({
    where: { userId },
    select: { unlockedBadges: true, activeBadge: true, points: true },
  });

  return c.json({
    catalog: BADGE_CATALOG,
    unlockedBadges: profile?.unlockedBadges ?? [],
    activeBadge: profile?.activeBadge ?? null,
    points: profile?.points ?? 0,
  });
});

const RedeemBadgeSchema = z.object({ slug: z.string().min(1) });

app.post("/badges/redeem", zValidator("json", RedeemBadgeSchema), async (c) => {
  const userId = c.get("userId");
  const { slug } = c.req.valid("json");
  const result = await redeemBadge(userId, slug);

  if (!result.ok) {
    const messages: Record<string, string> = {
      emblema_invalido: "Emblema não encontrado.",
      ja_desbloqueado: "Você já tem esse emblema.",
      pontos_insuficientes: "Pontos insuficientes pra resgatar esse emblema.",
      perfil_nao_encontrado: "Nenhum registro de gamificação encontrado ainda — registre uma transação primeiro.",
    };
    return c.json({ error: messages[result.reason] }, 400);
  }

  return c.json(result);
});

const SetActiveBadgeSchema = z.object({ slug: z.string().min(1).nullable() });

app.patch("/badges/active", zValidator("json", SetActiveBadgeSchema), async (c) => {
  const userId = c.get("userId");
  const { slug } = c.req.valid("json");
  const result = await setActiveBadge(userId, slug);

  if (!result.ok) {
    const messages: Record<string, string> = {
      emblema_nao_desbloqueado: "Você ainda não desbloqueou esse emblema.",
      perfil_nao_encontrado: "Nenhum registro de gamificação encontrado ainda — registre uma transação primeiro.",
    };
    return c.json({ error: messages[result.reason] }, 400);
  }

  return c.json(result);
});

app.get("/history", async (c) => {
  const userId = c.get("userId");
  const history = await getSpinHistory(userId);
  return c.json(history);
});

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export default app;
