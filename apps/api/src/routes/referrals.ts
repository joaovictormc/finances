import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { getOrCreateReferralCode, redeemReferralCode } from "../lib/referrals";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/code", async (c) => {
  const userId = c.get("userId");
  const referralCode = await getOrCreateReferralCode(userId);
  return c.json({ code: referralCode.code, link: `${APP_URL}/register?ref=${referralCode.code}` });
});

const RedeemSchema = z.object({ code: z.string().min(1) });

app.post("/redeem", zValidator("json", RedeemSchema), async (c) => {
  const userId = c.get("userId");
  const { code } = c.req.valid("json");

  try {
    await redeemReferralCode(userId, code);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Erro ao processar indicação" }, 400);
  }
});

app.get("/", async (c) => {
  const userId = c.get("userId");
  const referrals = await db.referral.findMany({
    where: { referrerId: userId },
    include: { referred: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    total: referrals.length,
    rewardsGranted: referrals.filter((r) => r.rewardGranted).length,
    referrals: referrals.map((r) => ({
      id: r.id,
      referredName: r.referred.name,
      rewardGranted: r.rewardGranted,
      createdAt: r.createdAt,
    })),
  });
});

export default app;
