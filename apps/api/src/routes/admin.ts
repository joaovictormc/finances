import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { getAiSettings, updateAiSettings, getMonthlyTokenUsage } from "../lib/ai/ai-settings";
import { getGamificationSettings, updateGamificationSettings } from "../lib/gamification-settings";
import { simulateSpins, getGamificationStats } from "../lib/gamification";
import { cancelSubscriptionAtMercadoPago } from "../lib/mercadopago";
import {
  PAYMENT_METHODS,
  getPaymentMethodDef,
  listPaymentMethodConfigs,
  updatePaymentMethodConfig,
  maskSecrets,
  type PaymentMethodId,
} from "../lib/payment-methods";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth, requireAdmin);

// ── Usuários ──────────────────────────────────────────────────────────────────

app.get("/users", async (c) => {
  const q = c.req.query("q")?.trim();
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const pageSize = 20;

  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);

  return c.json({ users, total, page, pageSize });
});

const RoleSchema = z.object({ role: z.enum(["user", "support", "admin"]) });

app.patch("/users/:id/role", zValidator("json", RoleSchema), async (c) => {
  const id = c.req.param("id");
  const { role } = c.req.valid("json");

  const user = await db.user.update({ where: { id }, data: { role } });
  return c.json({ id: user.id, role: user.role });
});

const PlanSchema = z.object({
  plan: z.enum(["free", "pro", "familia"]),
  status: z.enum(["active", "past_due", "canceled"]).optional(),
});

app.patch("/users/:id/plan", zValidator("json", PlanSchema), async (c) => {
  const userId = c.req.param("id");
  const adminId = c.get("userId");
  const { plan, status } = c.req.valid("json");

  const subscription = await db.subscription.upsert({
    where: { userId },
    update: { plan, status: status ?? "active" },
    create: { userId, plan, status: status ?? "active" },
  });

  await db.paymentEvent.create({
    data: {
      mpEventId: `admin_plan_override:${userId}:${Date.now()}`,
      type: "admin_plan_override",
      rawPayload: { userId, adminId, plan, status: status ?? "active" },
    },
  });

  return c.json(subscription);
});

app.post("/users/:id/subscription/cancel", async (c) => {
  const userId = c.req.param("id");
  const adminId = c.get("userId");

  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (!subscription) return c.json({ error: "Assinatura não encontrada" }, 404);

  if (subscription.mpPreapprovalId && !subscription.mpPreapprovalId.startsWith("pix:")) {
    try {
      await cancelSubscriptionAtMercadoPago(subscription.mpPreapprovalId);
    } catch (err) {
      console.warn("[admin] Falha ao cancelar assinatura no Mercado Pago:", err);
    }
  }

  const updated = await db.subscription.update({
    where: { userId },
    data: { status: "canceled", canceledAt: new Date() },
  });

  await db.paymentEvent.create({
    data: {
      mpEventId: `admin_subscription_cancel:${userId}:${Date.now()}`,
      type: "admin_subscription_cancel",
      rawPayload: { userId, adminId },
    },
  });

  return c.json(updated);
});

// ── Checkouts (histórico de eventos do Mercado Pago) ─────────────────────────

app.get("/payment-events", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const type = c.req.query("type")?.trim();
  const pageSize = 20;
  const where = type ? { type } : {};

  const [events, total] = await Promise.all([
    db.paymentEvent.findMany({
      where,
      orderBy: { processedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.paymentEvent.count({ where }),
  ]);

  return c.json({ events, total, page, pageSize });
});

app.get("/payment-events/types", async (c) => {
  const rows = await db.paymentEvent.findMany({
    distinct: ["type"],
    select: { type: true },
    orderBy: { type: "asc" },
  });
  return c.json(rows.map((r) => r.type));
});

/** Confirma manualmente um pagamento Pix pendente e ativa o plano do usuário. */
app.post("/payment-events/:id/confirm-pix", async (c) => {
  const id = c.req.param("id");
  const adminId = c.get("userId");

  const event = await db.paymentEvent.findUnique({ where: { id } });
  if (!event || event.type !== "pix_checkout_created") {
    return c.json({ error: "Evento de checkout Pix não encontrado" }, 404);
  }

  const payload = event.rawPayload as { userId?: string; plan?: string; txid?: string };
  if (!payload.userId || !payload.plan || !["pro", "familia"].includes(payload.plan)) {
    return c.json({ error: "Evento de checkout Pix inválido" }, 400);
  }

  const existing = await db.subscription.findUnique({ where: { userId: payload.userId } });
  if (existing?.mpPreapprovalId === `pix:${payload.txid}` && existing.status === "active") {
    return c.json(existing);
  }

  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  const subscription = await db.subscription.upsert({
    where: { userId: payload.userId },
    update: { plan: payload.plan, status: "active", currentPeriodEnd, mpPreapprovalId: `pix:${payload.txid}` },
    create: { userId: payload.userId, plan: payload.plan, status: "active", currentPeriodEnd, mpPreapprovalId: `pix:${payload.txid}` },
  });

  await db.paymentEvent.create({
    data: {
      mpEventId: `pix_payment_confirmed:${payload.txid}:${Date.now()}`,
      type: "pix_payment_confirmed",
      rawPayload: { ...payload, adminId },
    },
  });

  return c.json(subscription);
});

// ── Métodos de pagamento ──────────────────────────────────────────────────────

function toPaymentMethodResponse(id: PaymentMethodId, enabled: boolean, config: Record<string, string>) {
  const def = getPaymentMethodDef(id);
  const { config: maskedConfig, secretsSet } = maskSecrets(id, config);
  return { id, name: def.name, description: def.description, fields: def.fields, enabled, config: maskedConfig, secretsSet };
}

app.get("/payment-methods", async (c) => {
  const configs = await listPaymentMethodConfigs();
  return c.json(
    configs.map((cfg) =>
      toPaymentMethodResponse(cfg.id as PaymentMethodId, cfg.enabled, (cfg.config as Record<string, string>) ?? {})
    )
  );
});

const PaymentMethodUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.string()).optional(),
});

app.patch("/payment-methods/:id", zValidator("json", PaymentMethodUpdateSchema), async (c) => {
  const id = c.req.param("id") as PaymentMethodId;
  if (!PAYMENT_METHODS.some((m) => m.id === id)) return c.json({ error: "Método desconhecido" }, 404);

  const data = c.req.valid("json");
  const updated = await updatePaymentMethodConfig(id, data);
  return c.json(toPaymentMethodResponse(id, updated.enabled, (updated.config as Record<string, string>) ?? {}));
});

// ── IA (configuração e observabilidade) ──────────────────────────────────────

app.get("/ai/settings", async (c) => {
  const settings = await getAiSettings();
  return c.json(settings);
});

const AiSettingsSchema = z.object({
  textModel: z.string().min(1).optional(),
  audioModel: z.string().min(1).optional(),
  expenseParsingEnabled: z.boolean().optional(),
  monthlyInsightsEnabled: z.boolean().optional(),
  nlQueryEnabled: z.boolean().optional(),
  categorySuggestionEnabled: z.boolean().optional(),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
});

app.patch("/ai/settings", zValidator("json", AiSettingsSchema), async (c) => {
  const data = c.req.valid("json");
  const settings = await updateAiSettings(data);
  return c.json(settings);
});

app.get("/ai/usage", async (c) => {
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [byFeature, last1d, last7d, last30d] = await Promise.all([
    db.aiUsageLog.groupBy({
      by: ["feature"],
      _count: true,
      _sum: { promptTokens: true, completionTokens: true },
    }),
    db.aiUsageLog.count({ where: { createdAt: { gte: since(1) } } }),
    db.aiUsageLog.count({ where: { createdAt: { gte: since(7) } } }),
    db.aiUsageLog.count({ where: { createdAt: { gte: since(30) } } }),
  ]);
  const monthlyTokenUsage = await getMonthlyTokenUsage();

  return c.json({ byFeature, last1d, last7d, last30d, monthlyTokenUsage });
});

// ── Gamificação (prêmios da Roleta Semanal) ──────────────────────────────────

app.get("/gamification/settings", async (c) => {
  const settings = await getGamificationSettings();
  return c.json(settings);
});

const GamificationSettingsSchema = z.object({
  spinPrizes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        points: z.number().int().positive(),
        weight: z.number().int().positive(),
      })
    )
    .min(1)
    .max(10),
});

app.patch("/gamification/settings", zValidator("json", GamificationSettingsSchema), async (c) => {
  const data = c.req.valid("json");
  const settings = await updateGamificationSettings(data);
  return c.json(settings);
});

const GamificationSimulateSchema = z.object({
  spins: z.number().int().min(1).max(50000),
});

/** Simula N giros da Roleta Semanal em memória (nunca toca em GamificationProfile). */
app.post("/gamification/simulate", zValidator("json", GamificationSimulateSchema), async (c) => {
  const { spins } = c.req.valid("json");
  const settings = await getGamificationSettings();
  if (settings.spinPrizes.length === 0) {
    return c.json({ error: "Nenhum prêmio configurado" }, 400);
  }
  const results = simulateSpins(settings.spinPrizes, spins);
  return c.json({ spins, results });
});

app.get("/gamification/stats", async (c) => {
  const stats = await getGamificationStats();
  return c.json(stats);
});

export default app;
