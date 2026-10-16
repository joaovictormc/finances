import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, Prisma } from "@finances/db";
import { CouponInputSchema, ReferralRuleInputSchema, type CouponInput, type ReferralRuleInput } from "@finances/validations";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { currentRule, ensureDefaultRule } from "../lib/referral-rules";

/** Promoções no painel admin: cupons e recompensa de indicação. Só admin. */
const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth, requireAdmin);

// ── Datas: o admin pensa em dias de calendário de Brasília ───────────────────
// "Vale de 01/10 a 31/10" = de 01/10 00h até o fim do dia 31/10 (fim exclusivo
// às 00h de 01/11). O Brasil não tem horário de verão desde 2019: -03:00 fixo.

const startOfDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00-03:00`);
const endOfDayExclusive = (d: string) => new Date(startOfDay(d).getTime() + 24 * 60 * 60 * 1000);
const toDay = (date: Date | null, exclusiveEnd = false) => {
  if (!date) return null;
  const shifted = new Date(date.getTime() - (exclusiveEnd ? 1 : 0) - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
};

// ── Cupons ───────────────────────────────────────────────────────────────────

function couponData(input: CouponInput) {
  return {
    code: input.code,
    description: input.description,
    percentOff: input.discountType === "percent" ? input.percentOff! : null,
    amountOffCents: input.discountType === "fixed" ? input.amountOffCents! : null,
    plans: input.plans,
    startsAt: input.startsAt ? startOfDay(input.startsAt) : null,
    expiresAt: input.expiresAt ? endOfDayExclusive(input.expiresAt) : null,
    maxRedemptions: input.maxRedemptions ?? null,
    active: input.active,
  };
}

app.get("/coupons", async (c) => {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await db.couponRedemption.groupBy({ by: ["couponId", "status"], _count: { _all: true } });
  const countOf = (couponId: string, status: string) =>
    counts.find((r) => r.couponId === couponId && r.status === status)?._count._all ?? 0;

  return c.json(
    coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.percentOff ? "percent" : "fixed",
      percentOff: coupon.percentOff,
      amountOffCents: coupon.amountOffCents,
      plans: coupon.plans,
      startsAt: toDay(coupon.startsAt),
      expiresAt: toDay(coupon.expiresAt, true),
      maxRedemptions: coupon.maxRedemptions,
      active: coupon.active,
      confirmedUses: countOf(coupon.id, "confirmed"),
      pendingUses: countOf(coupon.id, "pending"),
    }))
  );
});

const isDuplicate = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

app.post("/coupons", zValidator("json", CouponInputSchema), async (c) => {
  try {
    const coupon = await db.coupon.create({ data: couponData(c.req.valid("json")) });
    return c.json({ id: coupon.id }, 201);
  } catch (err) {
    if (isDuplicate(err)) return c.json({ error: "Já existe um cupom com esse código." }, 409);
    throw err;
  }
});

app.patch("/coupons/:id", zValidator("json", CouponInputSchema), async (c) => {
  const id = c.req.param("id");
  if (!(await db.coupon.findUnique({ where: { id }, select: { id: true } }))) {
    return c.json({ error: "Cupom não encontrado." }, 404);
  }
  try {
    // Assinaturas já criadas mantêm o preço com que foram contratadas: mudar o
    // desconto aqui só vale para checkouts novos.
    await db.coupon.update({ where: { id }, data: couponData(c.req.valid("json")) });
    return c.json({ success: true });
  } catch (err) {
    if (isDuplicate(err)) return c.json({ error: "Já existe um cupom com esse código." }, 409);
    throw err;
  }
});

app.delete("/coupons/:id", async (c) => {
  const id = c.req.param("id");
  const used = await db.couponRedemption.count({ where: { couponId: id, status: "confirmed" } });
  if (used > 0) {
    return c.json({ error: "Este cupom já foi usado e fica no histórico. Desative-o em vez de excluir." }, 409);
  }
  await db.coupon.delete({ where: { id } }).catch(() => null);
  return c.json({ success: true });
});

// ── Recompensa de indicação ──────────────────────────────────────────────────

function ruleData(input: ReferralRuleInput, isDefault: boolean) {
  return {
    name: input.name,
    // A regra padrão não tem período nem desliga: é o que vale sem campanha.
    startsAt: isDefault || !input.startsAt ? null : startOfDay(input.startsAt),
    endsAt: isDefault || !input.endsAt ? null : endOfDayExclusive(input.endsAt),
    active: isDefault ? true : input.active,
    paidReferrerDays: input.paidReferrerDays,
    freeRewardType: input.freeRewardType,
    freeRewardPlan: input.freeRewardPlan,
    freeRewardDays: input.freeRewardType === "plan_days" ? input.freeRewardDays : 0,
    freeRewardPoints: input.freeRewardType === "points" ? input.freeRewardPoints : 0,
  };
}

app.get("/referral-rules", async (c) => {
  await ensureDefaultRule();
  const [rules, current, counts] = await Promise.all([
    db.referralRewardRule.findMany({ orderBy: [{ isDefault: "desc" }, { startsAt: "desc" }] }),
    currentRule(),
    db.referral.groupBy({ by: ["rewardRuleId"], _count: { _all: true } }),
  ]);
  return c.json(
    rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      isDefault: rule.isDefault,
      startsAt: toDay(rule.startsAt),
      endsAt: toDay(rule.endsAt, true),
      active: rule.active,
      paidReferrerDays: rule.paidReferrerDays,
      freeRewardType: rule.freeRewardType,
      freeRewardPlan: rule.freeRewardPlan,
      freeRewardDays: rule.freeRewardDays,
      freeRewardPoints: rule.freeRewardPoints,
      isCurrent: rule.id === current.id,
      referrals: counts.find((r) => r.rewardRuleId === rule.id)?._count._all ?? 0,
    }))
  );
});

app.post("/referral-rules", zValidator("json", ReferralRuleInputSchema), async (c) => {
  const input = c.req.valid("json");
  if (!input.startsAt || !input.endsAt) {
    return c.json({ error: "Campanha precisa de início e fim." }, 400);
  }
  const rule = await db.referralRewardRule.create({ data: ruleData(input, false) });
  return c.json({ id: rule.id }, 201);
});

app.patch("/referral-rules/:id", zValidator("json", ReferralRuleInputSchema), async (c) => {
  const id = c.req.param("id");
  const rule = await db.referralRewardRule.findUnique({ where: { id } });
  if (!rule) return c.json({ error: "Regra não encontrada." }, 404);
  const input = c.req.valid("json");
  if (!rule.isDefault && (!input.startsAt || !input.endsAt)) {
    return c.json({ error: "Campanha precisa de início e fim." }, 400);
  }
  // Indicações já feitas guardam esta regra: editar muda a recompensa delas
  // também (o admin é avisado na tela).
  await db.referralRewardRule.update({ where: { id }, data: ruleData(input, rule.isDefault) });
  return c.json({ success: true });
});

app.delete("/referral-rules/:id", async (c) => {
  const id = c.req.param("id");
  const rule = await db.referralRewardRule.findUnique({ where: { id } });
  if (!rule) return c.json({ success: true });
  if (rule.isDefault) return c.json({ error: "A regra padrão não pode ser excluída." }, 400);
  const linked = await db.referral.count({ where: { rewardRuleId: id, rewardGranted: false } });
  if (linked > 0) {
    // Excluir trocaria a recompensa prometida a quem foi indicado na campanha.
    return c.json(
      { error: `${linked} indicação(ões) desta campanha ainda aguardam recompensa. Desative-a em vez de excluir.` },
      409
    );
  }
  await db.referralRewardRule.delete({ where: { id } });
  return c.json({ success: true });
});

export default app;
