import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` porque o factory do `vi.mock` roda antes das declarações do módulo.
const dbMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
}));

vi.mock("@finances/db", () => ({ db: dbMock }));

import {
  getEffectivePlan,
  isAiInsightsAllowed,
  isAssistantAllowed,
  isReceiptScanAllowed,
} from "./plan-limits";

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.subscription.findUnique.mockReset();
});

function asUser(role: string | null, subscription: { plan: string; status: string } | null) {
  dbMock.user.findUnique.mockResolvedValue(role ? { role } : null);
  dbMock.subscription.findUnique.mockResolvedValue(subscription);
}

describe("getEffectivePlan", () => {
  it("dá plano completo para admin, sem olhar assinatura", async () => {
    asUser("admin", null);
    const plan = await getEffectivePlan("u1");

    expect(plan.assistant).toBe(true);
    expect(plan.maxBankConnections).toBeNull();
    expect(dbMock.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("cai no free sem assinatura", async () => {
    asUser("user", null);
    expect((await getEffectivePlan("u1")).id).toBe("free");
  });

  it("cai no free quando a assinatura não está ativa", async () => {
    asUser("user", { plan: "pro", status: "canceled" });
    expect((await getEffectivePlan("u1")).id).toBe("free");
  });

  it("usa o plano da assinatura ativa", async () => {
    asUser("user", { plan: "familia", status: "active" });
    expect((await getEffectivePlan("u1")).id).toBe("familia");
  });
});

describe("gates de plano das funções de IA", () => {
  it("bloqueia assistente, cupom e insights no free", async () => {
    asUser("user", null);

    expect(await isAssistantAllowed("u1")).toBe(false);
    expect(await isReceiptScanAllowed("u1")).toBe(false);
    expect(await isAiInsightsAllowed("u1")).toBe(false);
  });

  it("libera as três no pro", async () => {
    asUser("user", { plan: "pro", status: "active" });

    expect(await isAssistantAllowed("u1")).toBe(true);
    expect(await isReceiptScanAllowed("u1")).toBe(true);
    expect(await isAiInsightsAllowed("u1")).toBe(true);
  });
});
