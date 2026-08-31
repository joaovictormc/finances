import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/notifications", async (c) => {
  const userId = c.get("userId");
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { notifyEmail: true, aiInsightsEnabled: true },
  });

  return c.json({
    notifyEmail: profile?.notifyEmail ?? true,
    aiInsightsEnabled: profile?.aiInsightsEnabled ?? true,
  });
});

const NotificationPreferencesSchema = z.object({
  notifyEmail: z.boolean().optional(),
  aiInsightsEnabled: z.boolean().optional(),
});

app.patch("/notifications", zValidator("json", NotificationPreferencesSchema), async (c) => {
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const profile = await db.userProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { notifyEmail: true, aiInsightsEnabled: true },
  });

  return c.json(profile);
});

export default app;
