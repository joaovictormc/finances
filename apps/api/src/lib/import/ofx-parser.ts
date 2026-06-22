import type { ParsedTransaction } from "./types";

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? match[1]!.trim() : null;
}

function parseOfxDate(raw: string): string | null {
  // OFX usa YYYYMMDD ou YYYYMMDDHHMMSS[.sss][timezone]
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

function splitTransactionBlocks(text: string): string[] {
  // OFX 2.x (XML) tem tags de fechamento; OFX 1.x (SGML) costuma não ter —
  // nesse caso, parte o texto em cada <STMTTRN> e usa o próximo <STMTTRN>/</BANKTRANLIST> como limite.
  const closed = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi);
  if (closed) return closed;

  const parts = text.split(/<STMTTRN>/i).slice(1);
  return parts.map((part) => part.split(/<\/BANKTRANLIST>|<STMTTRN>/i)[0]!);
}

export function parseOfxTransactions(text: string): ParsedTransaction[] {
  const blocks = splitTransactionBlocks(text);
  if (blocks.length === 0) return [];

  const rows: ParsedTransaction[] = [];

  for (const block of blocks) {
    const dtPosted = extractTag(block, "DTPOSTED");
    const trnAmt = extractTag(block, "TRNAMT");
    const fitId = extractTag(block, "FITID");
    const memo = extractTag(block, "MEMO") ?? extractTag(block, "NAME");

    if (!dtPosted || !trnAmt || !memo) continue;

    const date = parseOfxDate(dtPosted);
    const amount = parseFloat(trnAmt);
    if (!date || Number.isNaN(amount) || amount === 0) continue;

    rows.push({
      date,
      description: memo,
      amount: Math.abs(amount),
      type: amount < 0 ? "expense" : "income",
      externalId: fitId ?? undefined,
    });
  }

  return rows;
}
