import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ReceiptConsentSchema, ReceiptSubmitSchema } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { checkRateLimit } from "../lib/rate-limit";
import {
  acceptReceiptRewardTerms,
  getReceiptRewardStatus,
  revokeReceiptRewardTerms,
  submitRewardReceipt,
} from "../lib/receipt-rewards";

/** Área de recompensa por cupom fiscal: termo próprio, aceite e envio. */
const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/", async (c) => c.json(await getReceiptRewardStatus(c.get("userId"))));

app.post("/consent", zValidator("json", ReceiptConsentSchema), async (c) => {
  const result = await acceptReceiptRewardTerms(c.get("userId"), c.req.valid("json").version, {
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null,
    userAgent: c.req.header("user-agent") ?? null,
  });
  if (!result.ok) return c.json({ error: result.error }, 409);
  return c.json(await getReceiptRewardStatus(c.get("userId")));
});

app.delete("/consent", async (c) => {
  await revokeReceiptRewardTerms(c.get("userId"));
  return c.json(await getReceiptRewardStatus(c.get("userId")));
});

app.post("/receipts", zValidator("json", ReceiptSubmitSchema), async (c) => {
  const userId = c.get("userId");
  // Os limites do programa já valem por dia; isto só corta tentativa em massa
  // de chaves inventadas.
  if (!(await checkRateLimit({ key: "receipt-reward", userId, max: 20, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas tentativas seguidas. Tente de novo em alguns minutos." }, 429);
  }
  const result = await submitRewardReceipt(userId, c.req.valid("json").code);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ...result, status: await getReceiptRewardStatus(userId) }, 201);
});

export default app;
