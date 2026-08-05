import { createHash } from "node:crypto";
import type { ParsedTransaction } from "./types";
import { isCreditCardBillPayment } from "./credit-card-payment";

const DATE_HEADERS = ["data", "date"];
const DESCRIPTION_HEADERS = ["descricao", "descrição", "historico", "histórico", "description", "memo", "lancamento", "lançamento"];
const AMOUNT_HEADERS = ["valor", "amount", "value"];

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

function detectDelimiter(headerLine: string): string {
  return headerLine.split(";").length > headerLine.split(",").length ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function parseAmount(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  return parseFloat(normalized);
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // DD/MM/YYYY ou DD-MM-YYYY
  const match = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function parseCsvTransactions(text: string): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitCsvLine(lines[0]!, delimiter).map(normalizeHeader);

  const dateIdx = headers.findIndex((h) => DATE_HEADERS.includes(h));
  const descIdx = headers.findIndex((h) => DESCRIPTION_HEADERS.includes(h));
  const amountIdx = headers.findIndex((h) => AMOUNT_HEADERS.includes(h));

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error(
      "CSV precisa ter colunas de data, descrição e valor (ex: Data, Descrição, Valor)"
    );
  }

  const rows: ParsedTransaction[] = [];

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter);
    const date = parseDate(cells[dateIdx] ?? "");
    const description = cells[descIdx]?.trim();
    const amount = parseAmount(cells[amountIdx] ?? "");

    if (!date || !description || Number.isNaN(amount) || amount === 0) continue;

    const externalId = createHash("sha1").update(`${date}|${description}|${amount}`).digest("hex");

    rows.push({
      date,
      description,
      amount: Math.abs(amount),
      type:
        amount < 0 && isCreditCardBillPayment(description)
          ? "transfer"
          : amount < 0
            ? "expense"
            : "income",
      externalId,
    });
  }

  return rows;
}
