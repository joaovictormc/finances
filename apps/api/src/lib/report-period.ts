const REPORT_TIME_ZONE = "America/Sao_Paulo";

function getTimeZoneOffsetMinutes(date: Date): number {
  const timeZoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: REPORT_TIME_ZONE,
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";

  if (timeZoneName === "GMT") return 0;

  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(timeZoneName);
  if (!match) throw new Error(`Fuso horário não suportado: ${timeZoneName}`);

  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function startOfDayInReportTimeZone(year: number, month: number): Date {
  const localTimeAsUtc = Date.UTC(year, month - 1, 1);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(localTimeAsUtc));
  return new Date(localTimeAsUtc - offsetMinutes * 60_000);
}

function getYearAndMonthInReportTimeZone(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function parseInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${label} inválido`);
  return Number(value);
}

export function getMonthlyReportPeriod(year: number, month: number) {
  const start = startOfDayInReportTimeZone(year, month);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start,
    endExclusive: startOfDayInReportTimeZone(nextYear, nextMonth),
  };
}

export function parseMonthlyReportPeriod(
  yearValue: string | undefined,
  monthValue: string | undefined,
  now = new Date()
) {
  const current = getYearAndMonthInReportTimeZone(now);
  const year = parseInteger(yearValue, current.year, "Ano");
  const month = parseInteger(monthValue, current.month, "Mês");

  if (year < 1900 || year > 2200) throw new Error("Ano inválido");
  if (month < 1 || month > 12) throw new Error("Mês inválido");

  return { year, month, ...getMonthlyReportPeriod(year, month) };
}
