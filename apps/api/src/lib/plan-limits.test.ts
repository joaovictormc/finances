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
  isSubscriptionExpired,
} from "./plan-limits";

beforeEach(() => {
  dbMock.user.findUnique.mockReset();
  dbMock.subscription.findUnique.mockReset();
});

type FakeSubscription = { plan: string; status: string; currentPeriodEnd?: Date | null };

function asUser(role: string | null, subscription: FakeSubscription | null) {
  dbMock.user.findUnique.mockResolvedValue(role ? { role } : null);
  dbMock.subscription.findUnique.mockResolvedValue(subscription);
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
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

  it("derruba pro free quando o período pago acabou", async () => {
    // Sem isso, um Pix pago uma única vez valia pra sempre: Pix não tem
    // recorrência e nada mais rebaixava a assinatura.
    asUser("user", { plan: "pro", status: "active", currentPeriodEnd: daysFromNow(-32) });
    expect((await getEffectivePlan("u1")).id).toBe("free");
  });

  it("mantém o plano dentro da carência depois do vencimento", async () => {
    asUser("user", { plan: "pro", status: "active", currentPeriodEnd: daysFromNow(-2) });
    expect((await getEffectivePlan("u1")).id).toBe("pro");
  });

  it("não expira concessão manual sem prazo", async () => {
    asUser("user", { plan: "familia", status: "active", currentPeriodEnd: null });
    expect((await getEffectivePlan("u1")).id).toBe("familia");
  });
});

describe("isSubscriptionExpired", () => {
  it("considera vencida a ativa cujo período acabou faz mais que a carência", () => {
    expect(isSubscriptionExpired({ status: "active", currentPeriodEnd: daysFromNow(-10) })).toBe(true);
  });

  it("não considera vencida dentro da carência", () => {
    expect(isSubscriptionExpired({ status: "active", currentPeriodEnd: daysFromNow(-1) })).toBe(false);
  });

  it("não considera vencida a que ainda está no prazo", () => {
    expect(isSubscriptionExpired({ status: "active", currentPeriodEnd: daysFromNow(10) })).toBe(false);
  });

  it("trata período nulo como concessão sem prazo", () => {
    expect(isSubscriptionExpired({ status: "active", currentPeriodEnd: null })).toBe(false);
  });

  it("não se aplica a quem já não está ativo", () => {
    // Cancelada já não dá acesso por outro caminho; marcar como "vencida"
    // aqui só confundiria o status mostrado na tela de cobrança.
    expect(isSubscriptionExpired({ status: "canceled", currentPeriodEnd: daysFromNow(-99) })).toBe(false);
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
