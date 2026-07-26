import { describe, expect, it } from "vitest";
import { getMonthlyReportPeriod, parseMonthlyReportPeriod } from "./report-period";

describe("getMonthlyReportPeriod", () => {
  it("uses São Paulo month boundaries independently of the server timezone", () => {
    const period = getMonthlyReportPeriod(2026, 7);

    expect(period.start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("rolls December into January of the following year", () => {
    const period = getMonthlyReportPeriod(2026, 12);

    expect(period.start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("parseMonthlyReportPeriod", () => {
  it("rejects invalid year and month values", () => {
    expect(() => parseMonthlyReportPeriod("invalid", "7")).toThrow("Ano inválido");
    expect(() => parseMonthlyReportPeriod("2026", "13")).toThrow("Mês inválido");
    expect(() => parseMonthlyReportPeriod("2026", "7.5")).toThrow("Mês inválido");
  });

  it("uses the supplied current date when values are absent", () => {
    const result = parseMonthlyReportPeriod(undefined, undefined, new Date("2026-07-25T12:00:00-03:00"));

    expect(result.year).toBe(2026);
    expect(result.month).toBe(7);
  });
});
