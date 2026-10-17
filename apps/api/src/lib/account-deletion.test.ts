import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ subscription: { findUnique: vi.fn() } }));
const cancelMock = vi.hoisted(() => vi.fn());

vi.mock("@finances/db", () => ({ db: dbMock }));
vi.mock("./mercadopago", () => ({ cancelSubscriptionAtMercadoPago: cancelMock }));

import { stopRecurringBilling } from "./account-deletion";

beforeEach(() => vi.clearAllMocks());

describe("stopRecurringBilling", () => {
  it("cancela o débito no cartão de quem ainda está assinando", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({ status: "active", mpPreapprovalId: "2c938084" });
    await stopRecurringBilling("u1");
    expect(cancelMock).toHaveBeenCalledWith("2c938084");
  });

  it("não chama o Mercado Pago para Pix, cancelada ou sem assinatura", async () => {
    for (const sub of [
      { status: "active", mpPreapprovalId: "pix:abc" },
      { status: "canceled", mpPreapprovalId: "2c938084" },
      { status: "active", mpPreapprovalId: null },
      null,
    ]) {
      dbMock.subscription.findUnique.mockResolvedValue(sub);
      await stopRecurringBilling("u1");
    }
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("propaga a falha do Mercado Pago para bloquear a exclusão", async () => {
    dbMock.subscription.findUnique.mockResolvedValue({ status: "active", mpPreapprovalId: "2c938084" });
    cancelMock.mockRejectedValue(new Error("timeout"));
    await expect(stopRecurringBilling("u1")).rejects.toThrow("timeout");
  });
});
