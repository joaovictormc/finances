import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  coupon: { findUnique: vi.fn() },
  couponRedemption: { findFirst: vi.fn(), count: vi.fn() },
  referral: { findUnique: vi.fn(), updateMany: vi.fn() },
  referralRewardRule: { findFirst: vi.fn(), create: vi.fn() },
  subscription: { findUnique: vi.fn() },
  gamificationProfile: { upsert: vi.fn(), update: vi.fn() },
}));
const sendNotificationMock = vi.hoisted(() => vi.fn());
const grantPlanDaysMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock, Prisma: {} }));
vi.mock("./notifications", () => ({ sendNotification: sendNotificationMock }));
vi.mock("./plan-grant", () => ({ grantPlanDays: grantPlanDaysMock }));

import { MIN_CHARGE_CENTS, applyDiscount, checkCoupon, couponRuleRejection } from "./coupons";
import { describeReward, rewardFor } from "./referral-rules";
import { grantReferralReward } from "./referrals";

const NOW = new Date("2026-10-16T13:00:00.000Z");
const daysFrom = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

const baseCoupon = {
  id: "c1",
  code: "LANCAMENTO20",
  description: "",
  percentOff: 20,
  amountOffCents: null,
  plans: [] as string[],
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const rule = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  name: "Padrão",
  isDefault: true,
  startsAt: null,
  endsAt: null,
  active: true,
  paidReferrerDays: 30,
  freeRewardType: "plan_days",
  freeRewardPlan: "pro",
  freeRewardDays: 30,
  freeRewardPoints: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("applyDiscount", () => {
  it("aplica porcentagem e valor fixo", () => {
    expect(applyDiscount(2990, { percentOff: 20, amountOffCents: null })).toBe(2392);
    expect(applyDiscount(2990, { percentOff: null, amountOffCents: 1000 })).toBe(1990);
  });

  it("nunca cobra menos que o mínimo", () => {
    expect(applyDiscount(2990, { percentOff: 100, amountOffCents: null })).toBe(MIN_CHARGE_CENTS);
    expect(applyDiscount(1990, { percentOff: null, amountOffCents: 5000 })).toBe(MIN_CHARGE_CENTS);
  });
});

describe("couponRuleRejection", () => {
  it("recusa inativo, fora do período e plano não aceito", () => {
    expect(couponRuleRejection({ ...baseCoupon, active: false }, "pro", NOW)).toBe("inativo");
    expect(couponRuleRejection({ ...baseCoupon, startsAt: daysFrom(1) }, "pro", NOW)).toBe("ainda_nao_comecou");
    expect(couponRuleRejection({ ...baseCoupon, expiresAt: daysFrom(-1) }, "pro", NOW)).toBe("expirado");
    expect(couponRuleRejection({ ...baseCoupon, plans: ["familia"] }, "pro", NOW)).toBe("plano");
    expect(couponRuleRejection(baseCoupon, "pro", NOW)).toBeNull();
  });
});

describe("checkCoupon", () => {
  it("encontra pelo código sem diferenciar maiúsculas", async () => {
    dbMock.coupon.findUnique.mockResolvedValue(baseCoupon);
    dbMock.couponRedemption.findFirst.mockResolvedValue(null);
    expect((await checkCoupon(" lancamento20 ", "u1", "pro", NOW)).ok).toBe(true);
    expect(dbMock.coupon.findUnique.mock.calls[0]![0].where.code).toBe("LANCAMENTO20");
  });

  it("recusa quem já usou (uso confirmado)", async () => {
    dbMock.coupon.findUnique.mockResolvedValue(baseCoupon);
    dbMock.couponRedemption.findFirst.mockResolvedValue({ id: "x" });
    expect(await checkCoupon("LANCAMENTO20", "u1", "pro", NOW)).toEqual({ ok: false, reason: "ja_usado" });
  });

  it("recusa quando os usos confirmados atingem o limite", async () => {
    dbMock.coupon.findUnique.mockResolvedValue({ ...baseCoupon, maxRedemptions: 10 });
    dbMock.couponRedemption.findFirst.mockResolvedValue(null);
    dbMock.couponRedemption.count.mockResolvedValue(10);
    expect(await checkCoupon("LANCAMENTO20", "u1", "pro", NOW)).toEqual({ ok: false, reason: "esgotado" });
    expect(dbMock.couponRedemption.count.mock.calls[0]![0].where.status).toBe("confirmed");
  });
});

describe("regras de indicação", () => {
  it("quem paga ganha dias no próprio plano; quem está no Free segue a regra", () => {
    expect(rewardFor(rule(), true)).toEqual({ kind: "plan_days", days: 30, plan: "own" });
    expect(rewardFor(rule(), false)).toEqual({ kind: "plan_days", days: 30, plan: "pro" });
    expect(rewardFor(rule({ freeRewardType: "points", freeRewardPoints: 200 }), false)).toEqual({ kind: "points", points: 200 });
    expect(rewardFor(rule({ freeRewardType: "none" }), false)).toEqual({ kind: "none" });
  });

  it("descreve a recompensa em uma frase", () => {
    expect(describeReward({ kind: "plan_days", days: 30, plan: "own" })).toBe("30 dias grátis no seu plano");
    expect(describeReward({ kind: "plan_days", days: 15, plan: "familia" })).toBe("15 dias de Família");
    expect(describeReward({ kind: "points", points: 200 })).toBe("200 pontos");
    expect(describeReward({ kind: "none" })).toBeNull();
  });
});

describe("grantReferralReward", () => {
  const referral = (r: ReturnType<typeof rule> | null) => ({
    id: "ref1",
    referrerId: "indicador",
    referredId: "indicado",
    rewardGranted: false,
    rewardRule: r,
  });

  beforeEach(() => {
    dbMock.referral.updateMany.mockResolvedValue({ count: 1 });
    grantPlanDaysMock.mockResolvedValue({ action: "grant" });
  });

  it("indicador que paga: dias no próprio plano", async () => {
    dbMock.referral.findUnique.mockResolvedValue(referral(rule()));
    dbMock.subscription.findUnique.mockResolvedValue({ plan: "familia", status: "active", currentPeriodEnd: daysFrom(20) });

    await grantReferralReward("indicado");

    expect(grantPlanDaysMock).toHaveBeenCalledWith("indicador", { days: 30, plan: "familia" });
    expect(sendNotificationMock.mock.calls[0]![1].title).toBe("Você ganhou 30 dias grátis no seu plano! 🎉");
  });

  it("indicador no Free com campanha de pontos: soma pontos", async () => {
    dbMock.referral.findUnique.mockResolvedValue(referral(rule({ freeRewardType: "points", freeRewardPoints: 300 })));
    dbMock.subscription.findUnique.mockResolvedValue(null);
    dbMock.gamificationProfile.upsert.mockResolvedValue({ points: 350 });

    await grantReferralReward("indicado");

    expect(dbMock.gamificationProfile.upsert.mock.calls[0]![0].update).toEqual({ points: { increment: 300 } });
    expect(grantPlanDaysMock).not.toHaveBeenCalled();
    expect(sendNotificationMock.mock.calls[0]![1].body).toContain("300 pontos");
  });

  it("indicador no Free com dias de plano: ganha o plano da regra", async () => {
    dbMock.referral.findUnique.mockResolvedValue(referral(rule({ freeRewardPlan: "familia", freeRewardDays: 15 })));
    dbMock.subscription.findUnique.mockResolvedValue({ plan: "pro", status: "active", currentPeriodEnd: daysFrom(-10) }); // vencida

    await grantReferralReward("indicado");

    expect(grantPlanDaysMock).toHaveBeenCalledWith("indicador", { days: 15, plan: "familia" });
  });

  it("regra sem recompensa para Free: marca como paga e não avisa", async () => {
    dbMock.referral.findUnique.mockResolvedValue(referral(rule({ freeRewardType: "none" })));
    dbMock.subscription.findUnique.mockResolvedValue(null);

    await grantReferralReward("indicado");

    expect(dbMock.referral.updateMany).toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("não paga duas vezes quando outra chamada reivindicou antes", async () => {
    dbMock.referral.findUnique.mockResolvedValue(referral(rule()));
    dbMock.referral.updateMany.mockResolvedValue({ count: 0 });

    await grantReferralReward("indicado");

    expect(grantPlanDaysMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
