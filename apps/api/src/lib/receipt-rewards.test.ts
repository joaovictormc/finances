import { beforeEach, describe, expect, it, vi } from "vitest";
import { RECEIPT_REWARD_TERMS_VERSION } from "@finances/validations";

const dbMock = vi.hoisted(() => ({
  receiptRewardConsent: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  rewardReceipt: { count: vi.fn(), create: vi.fn() },
  gamificationProfile: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
const settings = vi.hoisted(() => ({
  receiptReward: { enabled: true, points: 10, dailyLimit: 2, weeklyLimit: 6, maxAgeDays: 30 },
}));

vi.mock("@finances/db", () => ({ db: dbMock }));
vi.mock("./gamification-settings", () => ({ getGamificationSettings: vi.fn(async () => settings) }));

import { acceptReceiptRewardTerms, submitRewardReceipt } from "./receipt-rewards";

const NOW = new Date("2026-08-20T15:00:00Z");
const KEY = "35260861233151003442650160000267191000330645"; // SP, 08/2026
const LINK = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|3|1`;
const consent = (version = RECEIPT_REWARD_TERMS_VERSION) => ({ termsVersion: version, acceptedAt: NOW, revokedAt: null });

beforeEach(() => {
  vi.clearAllMocks();
  settings.receiptReward.enabled = true;
  dbMock.receiptRewardConsent.findFirst.mockResolvedValue(consent());
  dbMock.rewardReceipt.count.mockResolvedValue(0);
  dbMock.$transaction.mockResolvedValue([]);
});

describe("submitRewardReceipt", () => {
  it("cupom válido: grava e soma os pontos na mesma transação", async () => {
    const result = await submitRewardReceipt("u1", LINK, NOW);
    expect(result).toEqual({ ok: true, points: 10, uf: "SP", issuedMonth: "2026-08" });
    expect(dbMock.rewardReceipt.create.mock.calls[0]![0].data).toMatchObject({
      userId: "u1",
      accessKey: KEY,
      uf: "SP",
      model: "65",
      issuerCnpj: "61233151003442",
      points: 10,
    });
    expect(dbMock.gamificationProfile.upsert.mock.calls[0]![0].update).toEqual({ points: { increment: 10 } });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("programa desligado ou sem aceite: não envia", async () => {
    settings.receiptReward.enabled = false;
    expect(await submitRewardReceipt("u1", LINK, NOW)).toMatchObject({ ok: false, status: 403 });
    settings.receiptReward.enabled = true;
    dbMock.receiptRewardConsent.findFirst.mockResolvedValue(null);
    expect(await submitRewardReceipt("u1", LINK, NOW)).toMatchObject({ ok: false, status: 403 });
    // Aceite de versão antiga do termo também não vale.
    dbMock.receiptRewardConsent.findFirst.mockResolvedValue(consent("2020-01-01"));
    expect(await submitRewardReceipt("u1", LINK, NOW)).toMatchObject({ ok: false, status: 403 });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("chave inválida e cupom antigo demais", async () => {
    expect(await submitRewardReceipt("u1", LINK.replace(KEY, KEY.slice(0, 43) + "9"), NOW)).toMatchObject({ ok: false, status: 400 });
    const old = await submitRewardReceipt("u1", LINK, new Date("2026-11-20T15:00:00Z"));
    expect(old).toMatchObject({ ok: false, status: 400 });
    expect((old as { error: string }).error).toContain("30 dias");
  });

  it("limites por dia e por semana", async () => {
    dbMock.rewardReceipt.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    expect(await submitRewardReceipt("u1", LINK, NOW)).toMatchObject({ ok: false, status: 429 });
    dbMock.rewardReceipt.count.mockResolvedValueOnce(1).mockResolvedValueOnce(6);
    expect(await submitRewardReceipt("u1", LINK, NOW)).toMatchObject({ ok: false, status: 429 });
  });

  it("cupom já enviado (por qualquer pessoa)", async () => {
    dbMock.$transaction.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    expect(await submitRewardReceipt("u1", LINK, NOW)).toEqual({ ok: false, status: 409, error: "Este cupom já foi enviado." });
  });
});

describe("acceptReceiptRewardTerms", () => {
  it("só aceita a versão atual e registra IP e navegador", async () => {
    dbMock.receiptRewardConsent.findFirst.mockResolvedValue(null);
    expect(await acceptReceiptRewardTerms("u1", "2020-01-01", {})).toMatchObject({ ok: false });
    expect(await acceptReceiptRewardTerms("u1", RECEIPT_REWARD_TERMS_VERSION, { ipAddress: "1.2.3.4", userAgent: "app" })).toEqual({ ok: true });
    expect(dbMock.receiptRewardConsent.create.mock.calls[0]![0].data).toMatchObject({
      userId: "u1",
      termsVersion: RECEIPT_REWARD_TERMS_VERSION,
      ipAddress: "1.2.3.4",
      userAgent: "app",
    });
  });
});
