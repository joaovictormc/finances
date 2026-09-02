import { describe, expect, it } from "vitest";
import { describePrize } from "./prize-description";

describe("describePrize", () => {
  it("descreve prêmio de pontos", () => {
    expect(describePrize({ type: "points", points: 50, days: 0 })).toBe("+50 pontos");
    expect(describePrize({ type: "points", points: 1, days: 0 })).toBe("+1 ponto");
  });

  it("descreve prêmio de dias com o nome do plano", () => {
    expect(describePrize({ type: "plan_days", points: 0, days: 30, plan: "pro" })).toBe(
      "+30 dias de Pro",
    );
    expect(describePrize({ type: "plan_days", points: 0, days: 1, plan: "familia" })).toBe(
      "+1 dia de Família",
    );
  });

  it("cai em 'plano' quando o plano não é conhecido — o histórico não o guarda", () => {
    expect(describePrize({ type: "plan_days", points: 0, days: 7 })).toBe("+7 dias de plano");
  });

  it("prêmio antigo, sem tipo gravado, conta como pontos", () => {
    expect(describePrize({ type: "", points: 20, days: 0 })).toBe("+20 pontos");
  });
});
