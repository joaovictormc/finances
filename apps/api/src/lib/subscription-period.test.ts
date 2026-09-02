import { describe, expect, it } from "vitest";
import { MONTHLY, addRecurrence, nextPeriodEnd, parseRecurrence } from "./subscription-period";

describe("addRecurrence", () => {
  it("soma meses", () => {
    expect(addRecurrence(new Date(2026, 0, 15), { frequency: 1, unit: "months" })).toEqual(
      new Date(2026, 1, 15),
    );
    expect(addRecurrence(new Date(2026, 0, 15), { frequency: 6, unit: "months" })).toEqual(
      new Date(2026, 6, 15),
    );
    expect(addRecurrence(new Date(2026, 0, 15), { frequency: 12, unit: "months" })).toEqual(
      new Date(2027, 0, 15),
    );
  });

  it("não transborda o mês quando o dia não existe no destino", () => {
    // setMonth cru devolveria 03/mar aqui, adiantando o vencimento.
    expect(addRecurrence(new Date(2026, 0, 31), { frequency: 1, unit: "months" })).toEqual(
      new Date(2026, 1, 28),
    );
  });

  it("respeita ano bissexto", () => {
    expect(addRecurrence(new Date(2028, 0, 31), { frequency: 1, unit: "months" })).toEqual(
      new Date(2028, 1, 29),
    );
  });

  it("soma dias", () => {
    expect(addRecurrence(new Date(2026, 0, 15), { frequency: 30, unit: "days" })).toEqual(
      new Date(2026, 1, 14),
    );
  });
});

describe("parseRecurrence", () => {
  it("lê o auto_recurring do Mercado Pago", () => {
    expect(parseRecurrence({ frequency: 6, frequency_type: "months" })).toEqual({
      frequency: 6,
      unit: "months",
    });
    expect(parseRecurrence({ frequency: 30, frequency_type: "days" })).toEqual({
      frequency: 30,
      unit: "days",
    });
  });

  it("cai no mensal quando vem ausente ou inválido", () => {
    expect(parseRecurrence(undefined)).toEqual(MONTHLY);
    expect(parseRecurrence(null)).toEqual(MONTHLY);
    expect(parseRecurrence({})).toEqual(MONTHLY);
    expect(parseRecurrence({ frequency: 0, frequency_type: "months" })).toEqual(MONTHLY);
    expect(parseRecurrence({ frequency: -3, frequency_type: "months" })).toEqual(MONTHLY);
    expect(parseRecurrence({ frequency: 1, frequency_type: "weeks" })).toEqual(MONTHLY);
  });
});

describe("nextPeriodEnd", () => {
  const now = new Date(2026, 5, 10);

  it("soma em cima do que ainda resta quando a cobrança vem antes do vencimento", () => {
    const result = nextPeriodEnd({
      currentPeriodEnd: new Date(2026, 5, 13),
      now,
      recurrence: MONTHLY,
    });
    expect(result).toEqual(new Date(2026, 6, 13));
  });

  it("parte de agora quando o período já venceu, sem cobrar dias que passaram", () => {
    const result = nextPeriodEnd({
      currentPeriodEnd: new Date(2026, 3, 1),
      now,
      recurrence: MONTHLY,
    });
    expect(result).toEqual(new Date(2026, 6, 10));
  });

  it("parte de agora quando não havia período", () => {
    expect(nextPeriodEnd({ currentPeriodEnd: null, now, recurrence: MONTHLY })).toEqual(
      new Date(2026, 6, 10),
    );
  });

  it("usa a recorrência do plano, não um mês fixo", () => {
    expect(
      nextPeriodEnd({ currentPeriodEnd: null, now, recurrence: { frequency: 12, unit: "months" } }),
    ).toEqual(new Date(2027, 5, 10));
  });
});
