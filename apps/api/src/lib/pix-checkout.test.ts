import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` porque o factory do `vi.mock` roda antes das declarações do módulo.
const dbMock = vi.hoisted(() => ({ paymentEvent: { findMany: vi.fn() } }));
vi.mock("@finances/db", () => ({ db: dbMock }));

import {
  PIX_CHECKOUT_MAX_AGE_DAYS,
  isPixCheckoutExpired,
  listPendingPixCheckouts,
  pixCheckoutExpiresAt,
  pixCheckoutStage,
} from "./pix-checkout";

const DAY = 86_400_000;
const NOW = new Date("2026-09-01T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

describe("pixCheckoutExpiresAt", () => {
  it("soma a janela de confirmação à data de criação", () => {
    const created = new Date("2026-09-01T12:00:00Z");
    const expected = new Date(created.getTime() + PIX_CHECKOUT_MAX_AGE_DAYS * DAY);
    expect(pixCheckoutExpiresAt(created).toISOString()).toBe(expected.toISOString());
  });
});

describe("pixCheckoutStage", () => {
  it("não sinaliza nada enquanto há folga", () => {
    expect(pixCheckoutStage(daysAgo(0), NOW)).toBeNull();
    expect(pixCheckoutStage(daysAgo(4), NOW)).toBeNull();
  });

  it("avisa na reta final", () => {
    expect(pixCheckoutStage(daysAgo(5), NOW)).toBe("expiring");
    expect(pixCheckoutStage(daysAgo(6), NOW)).toBe("expiring");
  });

  it("marca como vencido depois da janela", () => {
    expect(pixCheckoutStage(daysAgo(8), NOW)).toBe("expired");
    expect(pixCheckoutStage(daysAgo(40), NOW)).toBe("expired");
  });

  it("no instante exato do vencimento ainda aceita confirmação", () => {
    // O selo diz "vence em breve" e a rota aceita: nenhum dos dois pode virar
    // antes do outro, senão o admin vê um prazo e leva 409 ao confirmar.
    expect(pixCheckoutStage(daysAgo(PIX_CHECKOUT_MAX_AGE_DAYS), NOW)).toBe("expiring");
    expect(isPixCheckoutExpired(daysAgo(PIX_CHECKOUT_MAX_AGE_DAYS), NOW)).toBe(false);
  });
});

describe("isPixCheckoutExpired anda junto com o estágio", () => {
  it("recusa exatamente quando o estágio é expired", () => {
    // Trava do acoplamento entre o selo na lista do admin e a recusa da rota
    // de confirmação: as duas leem o mesmo cálculo, e este teste prova isso
    // pra qualquer idade dentro do intervalo interessante.
    for (let days = 0; days <= 15; days++) {
      const createdAt = daysAgo(days);
      expect(isPixCheckoutExpired(createdAt, NOW)).toBe(pixCheckoutStage(createdAt, NOW) === "expired");
    }
  });
});

// ── Varredura de pendentes ───────────────────────────────────────────────────

type FakeEvent = { id: string; processedAt: Date; rawPayload: Record<string, unknown> };

function createdEvent(txid: string, days: number, payload: Record<string, unknown> = {}): FakeEvent {
  return {
    id: `evt_${txid}`,
    processedAt: daysAgo(days),
    rawPayload: { userId: "u1", plan: "pro", txid, amount: 19.9, ...payload },
  };
}

/** O findMany é o mesmo pros dois tipos; o que separa é o `where.type`. */
function givenEvents(created: FakeEvent[], confirmed: { rawPayload: Record<string, unknown> }[]) {
  dbMock.paymentEvent.findMany.mockImplementation(
    async ({ where }: { where: { type: string } }) =>
      where.type === "pix_checkout_created" ? created : confirmed
  );
}

describe("listPendingPixCheckouts", () => {
  beforeEach(() => {
    // Corpo em bloco de propósito: `mockReset()` devolve o próprio mock, e o
    // Vitest trata função retornada do `beforeEach` como callback de limpeza —
    // com corpo de expressão ele chamaria o mock sem argumentos ao fim do teste.
    dbMock.paymentEvent.findMany.mockReset();
  });

  it("devolve o checkout sem confirmação, já com o estágio calculado", async () => {
    givenEvents([createdEvent("AAA", 6)], []);

    const pending = await listPendingPixCheckouts(NOW);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.txid).toBe("AAA");
    expect(pending[0]?.plan).toBe("pro");
    expect(pending[0]?.amount).toBe(19.9);
    expect(pending[0]?.stage).toBe("expiring");
  });

  it("descarta o que já foi confirmado, casando pelo txid", async () => {
    // O mpEventId da confirmação carrega um timestamp no fim, então casar por
    // igualdade de id não funciona — é o txid do payload que liga os dois.
    givenEvents(
      [createdEvent("AAA", 6), createdEvent("BBB", 1)],
      [{ rawPayload: { txid: "AAA" } }]
    );

    const pending = await listPendingPixCheckouts(NOW);

    expect(pending.map((checkout) => checkout.txid)).toEqual(["BBB"]);
    expect(pending[0]?.stage).toBeNull(); // recém-criado, ainda com folga
  });

  it("ignora evento sem os campos que a confirmação precisa", async () => {
    givenEvents(
      [createdEvent("AAA", 2, { txid: undefined }), createdEvent("BBB", 2, { userId: undefined })],
      []
    );

    expect(await listPendingPixCheckouts(NOW)).toEqual([]);
  });
});
