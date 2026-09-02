import { describe, expect, it } from "vitest";
import { decidePlanGrant } from "./plan-grant";

const now = new Date(2026, 8, 2);
const daysFromNow = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
};

describe("decidePlanGrant", () => {
  it("dá o plano do prêmio a quem está no free", () => {
    const result = decidePlanGrant({ days: 30, plan: "pro", now, subscription: null });
    expect(result).toEqual({ action: "grant", plan: "pro", currentPeriodEnd: daysFromNow(30) });
  });

  it("soma em cima do período que ainda resta", () => {
    const result = decidePlanGrant({
      days: 30,
      plan: "pro",
      now,
      subscription: { plan: "pro", status: "active", currentPeriodEnd: daysFromNow(10) },
    });
    expect(result).toEqual({ action: "grant", plan: "pro", currentPeriodEnd: daysFromNow(40) });
  });

  it("recomeça de hoje quando o período já venceu, sem dar dias que já passaram", () => {
    const result = decidePlanGrant({
      days: 30,
      plan: "pro",
      now,
      subscription: { plan: "pro", status: "active", currentPeriodEnd: daysFromNow(-45) },
    });
    expect(result).toEqual({ action: "grant", plan: "pro", currentPeriodEnd: daysFromNow(30) });
  });

  it("não rebaixa quem já tem plano melhor", () => {
    const result = decidePlanGrant({
      days: 30,
      plan: "pro",
      now,
      subscription: { plan: "familia", status: "active", currentPeriodEnd: daysFromNow(10) },
    });
    expect(result).toEqual({ action: "grant", plan: "familia", currentPeriodEnd: daysFromNow(40) });
  });

  it("promove quem tem plano menor que o do prêmio", () => {
    const result = decidePlanGrant({
      days: 15,
      plan: "familia",
      now,
      subscription: { plan: "pro", status: "active", currentPeriodEnd: daysFromNow(5) },
    });
    expect(result).toEqual({ action: "grant", plan: "familia", currentPeriodEnd: daysFromNow(20) });
  });

  it("reativa quem cancelou, contando a partir de hoje", () => {
    const result = decidePlanGrant({
      days: 7,
      plan: "pro",
      now,
      subscription: { plan: "pro", status: "canceled", currentPeriodEnd: daysFromNow(3) },
    });
    expect(result).toEqual({ action: "grant", plan: "pro", currentPeriodEnd: daysFromNow(7) });
  });

  it("não toca em acesso sem prazo — datar tiraria acesso em vez de dar", () => {
    const result = decidePlanGrant({
      days: 30,
      plan: "pro",
      now,
      subscription: { plan: "familia", status: "active", currentPeriodEnd: null },
    });
    expect(result).toEqual({ action: "skip", reason: "acesso_sem_prazo" });
  });

  it("ignora prêmio sem dias", () => {
    expect(decidePlanGrant({ days: 0, plan: "pro", now, subscription: null })).toEqual({
      action: "skip",
      reason: "sem_dias",
    });
  });

  it("trata plano desconhecido no banco como free", () => {
    const result = decidePlanGrant({
      days: 10,
      plan: "pro",
      now,
      subscription: { plan: "legado", status: "active", currentPeriodEnd: daysFromNow(5) },
    });
    expect(result).toEqual({ action: "grant", plan: "pro", currentPeriodEnd: daysFromNow(15) });
  });
});
