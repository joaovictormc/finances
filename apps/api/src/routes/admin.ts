import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, EncryptionKeyMissingError } from "@finances/db";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { getAiSettings, updateAiSettings } from "../lib/ai/ai-settings";
import { estimateCostUsd, costUnavailableReason } from "../lib/ai/pricing";
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
import { isPixCheckoutExpired, pixCheckoutExpiresAt, pixCheckoutStage } from "../lib/pix-checkout";
import {
  BILLING_INTERVALS,
  INTERVAL_LABELS,
  INTERVAL_MONTHS,
  intervalRecurrence,
  isBillingInterval,
} from "../lib/billing-interval";
import { addRecurrence } from "../lib/subscription-period";
import { PAID_PLANS, listPlanPrices, updatePlanPrices } from "../lib/plan-prices";

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

  // Concessão manual não tem prazo: zerar `currentPeriodEnd` deixa isso
  // explícito pro gate de acesso, que trata nulo como "não expira". Sem isso um
  // valor antigo sobreviveria ao upsert e a liberação do admin morreria na hora.
  const subscription = await db.subscription.upsert({
    where: { userId },
    update: { plan, status: status ?? "active", currentPeriodEnd: null, canceledAt: null },
    create: { userId, plan, status: status ?? "active", currentPeriodEnd: null },
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

  // O estágio vem calculado no servidor pra tela não reimplementar a janela:
  // se as duas contas divergirem, o admin vê "no prazo" e leva 409 ao confirmar.
  return c.json({
    events: events.map((event) =>
      event.type === "pix_checkout_created"
        ? {
            ...event,
            pixStage: pixCheckoutStage(event.processedAt),
            pixExpiresAt: pixCheckoutExpiresAt(event.processedAt),
          }
        : event
    ),
    total,
    page,
    pageSize,
  });
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

  if (isPixCheckoutExpired(event.processedAt)) {
    const expiresAt = pixCheckoutExpiresAt(event.processedAt);
    return c.json(
      { error: `Checkout Pix vencido em ${expiresAt.toLocaleDateString("pt-BR")}. Peça um novo ao usuário.` },
      409
    );
  }

  const payload = event.rawPayload as {
    userId?: string;
    plan?: string;
    interval?: string;
    txid?: string;
    amount?: number;
  };
  if (!payload.userId || !payload.plan || !["pro", "familia"].includes(payload.plan)) {
    return c.json({ error: "Evento de checkout Pix inválido" }, 400);
  }

  const existing = await db.subscription.findUnique({ where: { userId: payload.userId } });
  if (existing?.mpPreapprovalId === `pix:${payload.txid}` && existing.status === "active") {
    return c.json(existing);
  }

  // Quanto liberar sai do período que o usuário escolheu no checkout. Checkout
  // gerado antes dos períodos existirem não tem o campo, e era mensal.
  const interval =
    payload.interval && isBillingInterval(payload.interval) ? payload.interval : "monthly";
  const currentPeriodEnd = addRecurrence(new Date(), intervalRecurrence(interval));

  const subscription = await db.subscription.upsert({
    where: { userId: payload.userId },
    update: {
      plan: payload.plan,
      interval,
      status: "active",
      currentPeriodEnd,
      mpPreapprovalId: `pix:${payload.txid}`,
    },
    create: {
      userId: payload.userId,
      plan: payload.plan,
      interval,
      status: "active",
      currentPeriodEnd,
      mpPreapprovalId: `pix:${payload.txid}`,
    },
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

  try {
    const updated = await updatePaymentMethodConfig(id, data);
    return c.json(toPaymentMethodResponse(id, updated.enabled, (updated.config as Record<string, string>) ?? {}));
  } catch (error) {
    // Segredo só é gravado criptografado. Sem a chave, recusar é melhor que
    // salvar em texto puro — e a mensagem diz ao operador o que configurar.
    if (error instanceof EncryptionKeyMissingError) return c.json({ error: error.message }, 503);
    throw error;
  }
});

// ── IA (configuração e observabilidade) ──────────────────────────────────────

app.get("/ai/settings", async (c) => {
  const settings = await getAiSettings();
  return c.json(settings);
});

// Todo campo editável em /admin/ai precisa estar aqui: o zValidator descarta
// chave desconhecida em silêncio, então o que faltar nesta lista simplesmente
// não salva — sem erro visível na tela.
const AiSettingsSchema = z.object({
  textModel: z.string().min(1).optional(),
  visionModel: z.string().min(1).optional(),
  assistantModel: z.string().min(1).optional(),
  assistantEnabled: z.boolean().optional(),
  monthlyInsightsEnabled: z.boolean().optional(),
  nlQueryEnabled: z.boolean().optional(),
  categorySuggestionEnabled: z.boolean().optional(),
  receiptScanEnabled: z.boolean().optional(),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
  monthlyBudgetUsd: z.number().positive().nullable().optional(),
});

app.patch("/ai/settings", zValidator("json", AiSettingsSchema), async (c) => {
  const data = c.req.valid("json");
  const settings = await updateAiSettings(data);
  return c.json(settings);
});

type UsageRow = {
  model: string;
  _count: number;
  _sum: { promptTokens: number | null; completionTokens: number | null };
};

/** Soma chamadas, tokens e custo de um conjunto de linhas agrupadas por modelo. */
function summarizeUsage(rows: UsageRow[]) {
  let calls = 0;
  let tokens = 0;
  let costUsd = 0;
  let hasUnpricedUsage = false;

  for (const row of rows) {
    const promptTokens = row._sum.promptTokens ?? 0;
    const completionTokens = row._sum.completionTokens ?? 0;
    calls += row._count;
    tokens += promptTokens + completionTokens;

    const cost = estimateCostUsd(row.model, promptTokens, completionTokens);
    // `null` = modelo sem preço conhecido. Some zero, mas sinaliza — assim a
    // tela deixa claro que o total é um piso, não o valor fechado.
    if (cost === null) hasUnpricedUsage = true;
    else costUsd += cost;
  }

  return { calls, tokens, costUsd, hasUnpricedUsage };
}

app.get("/ai/usage", async (c) => {
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const byModel = (gte?: Date) =>
    db.aiUsageLog.groupBy({
      by: ["model"],
      where: gte ? { createdAt: { gte } } : undefined,
      _count: true,
      _sum: { promptTokens: true, completionTokens: true },
    });

  const [settings, monthDetail, day, week, month30, allTime] = await Promise.all([
    getAiSettings(),
    // Agrupado por feature E modelo: dá pra montar os dois recortes da tela a
    // partir da mesma consulta, e o custo depende do modelo, não da feature.
    db.aiUsageLog.groupBy({
      by: ["feature", "model"],
      where: { createdAt: { gte: startOfMonth } },
      _count: true,
      _sum: { promptTokens: true, completionTokens: true },
    }),
    byModel(since(1)),
    byModel(since(7)),
    byModel(since(30)),
    byModel(),
  ]);

  const foldBy = <K extends "feature" | "model">(key: K) => {
    const groups = new Map<string, UsageRow[]>();
    for (const row of monthDetail) {
      const id = row[key];
      const bucket = groups.get(id) ?? [];
      bucket.push(row);
      groups.set(id, bucket);
    }
    return [...groups.entries()]
      .map(([id, rows]) => ({ id, ...summarizeUsage(rows) }))
      .sort((a, b) => b.tokens - a.tokens);
  };

  // Fração do mês já decorrida — base da projeção e do contexto do medidor.
  const elapsedRatio =
    (now.getTime() - startOfMonth.getTime()) / (startOfNextMonth.getTime() - startOfMonth.getTime());
  const monthTotals = summarizeUsage(monthDetail);

  return c.json({
    month: {
      ...monthTotals,
      elapsedRatio,
      // Ritmo atual extrapolado até o fim do mês.
      projectedCostUsd: elapsedRatio > 0 ? monthTotals.costUsd / elapsedRatio : 0,
      projectedTokens: elapsedRatio > 0 ? Math.round(monthTotals.tokens / elapsedRatio) : 0,
      byFeature: foldBy("feature"),
      byModel: foldBy("model").map((entry) => ({
        ...entry,
        costNote: entry.hasUnpricedUsage ? costUnavailableReason(entry.id) : null,
      })),
    },
    windows: {
      last1d: summarizeUsage(day),
      last7d: summarizeUsage(week),
      last30d: summarizeUsage(month30),
    },
    allTime: summarizeUsage(allTime),
    monthlyTokenLimit: settings.monthlyTokenLimit,
    monthlyBudgetUsd: settings.monthlyBudgetUsd,
  });
});

// ── Gamificação (prêmios da Roleta Semanal) ──────────────────────────────────

app.get("/gamification/settings", async (c) => {
  const settings = await getGamificationSettings();
  return c.json(settings);
});

const GamificationSettingsSchema = z.object({
  spinPrizes: z
    .array(
      z
        .object({
          label: z.string().trim().min(1).max(60),
          type: z.enum(["points", "plan_days"]).default("points"),
          // Zero é válido no campo que o tipo escolhido não usa; o refine
          // abaixo é que cobra um valor útil no campo que importa.
          points: z.number().int().min(0).default(0),
          // Teto de um ano: prêmio de roleta que dá mais que isso quase sempre
          // é erro de digitação, e sai caro de descobrir depois.
          days: z.number().int().min(0).max(365).default(0),
          plan: z.enum(["pro", "familia"]).default("pro"),
          weight: z.number().int().positive(),
        })
        .superRefine((prize, ctx) => {
          if (prize.type === "points" && prize.points <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["points"],
              message: "Prêmio de pontos precisa de pontos maiores que zero",
            });
          }
          if (prize.type === "plan_days" && prize.days <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["days"],
              message: "Prêmio de dias de plano precisa de pelo menos 1 dia",
            });
          }
        }),
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

// ── Precificação ──────────────────────────────────────────────────────────────

/**
 * Preço de cada plano × período.
 *
 * A resposta traz rótulo e meses junto pra tela não recriar essa tabela, e o
 * equivalente mensal pra o admin enxergar o desconto que está dando sem calcular.
 */
/**
 * Forma única da resposta de preço.
 *
 * Compartilhada pelo GET e pelo PATCH de propósito: quando só o GET
 * acrescentava `months`, a tela ficava sem esse campo depois de salvar e
 * exibia o valor por mês como R$ 0,00 e o desconto como NaN.
 */
function toPlanPriceResponse(price: {
  plan: string;
  interval: keyof typeof INTERVAL_MONTHS;
  priceCents: number;
  active: boolean;
}) {
  return {
    ...price,
    label: INTERVAL_LABELS[price.interval],
    months: INTERVAL_MONTHS[price.interval],
    monthlyEquivalentCents: Math.round(price.priceCents / INTERVAL_MONTHS[price.interval]),
  };
}

app.get("/plan-prices", async (c) => {
  const prices = await listPlanPrices();
  return c.json(prices.map(toPlanPriceResponse));
});

const PlanPricesSchema = z.object({
  prices: z
    .array(
      z.object({
        plan: z.enum(PAID_PLANS),
        interval: z.enum(BILLING_INTERVALS),
        // Teto alto e não-negativo: erro de digitação em centavos vira cobrança
        // real, então vale barrar aqui em vez de descobrir no extrato.
        priceCents: z.number().int().min(0).max(10_000_00),
        active: z.boolean(),
      }),
    )
    .min(1),
});

/**
 * Grava os preços editados.
 *
 * Não mexe em quem já assina: o valor de um preapproval do Mercado Pago é
 * fixado na criação, então assinatura em andamento continua no preço que
 * contratou. O preço novo vale para checkouts a partir daqui.
 */
app.patch("/plan-prices", zValidator("json", PlanPricesSchema), async (c) => {
  const { prices } = c.req.valid("json");
  const updated = await updatePlanPrices(prices);
  return c.json(updated.map(toPlanPriceResponse));
});

export default app;
