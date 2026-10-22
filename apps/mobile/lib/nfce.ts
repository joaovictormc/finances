import {
  ACCESS_KEY_MESSAGES,
  extractAccessKey,
  validateAccessKey,
  type AccessKeyInfo,
  type PaymentMethod,
} from "@finances/validations";
import { formatBRL } from "@/lib/format";
import type { Category } from "@/lib/types";

/** O que o script da página da SEFAZ manda de volta (ver nfce-page-script.ts). */
export type NfceItem = {
  name: string;
  code: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
};

export type NfceNote = {
  merchant: string;
  cnpj: string | null;
  /** AAAA-MM-DD */
  issuedAt: string | null;
  number: string | null;
  accessKey: string | null;
  items: NfceItem[];
  itemCount: number | null;
  gross: number | null;
  discount: number | null;
  total: number | null;
  payments: { method: string; amount: number | null }[];
};

export type NfcePageMessage =
  | { type: "note"; note: NfceNote }
  | { type: "challenge"; kind: string }
  | { type: "unknown"; title: string; url: string; structure: string[] };

/** Como foi a consulta, para avaliar se a verificação da SEFAZ passa sozinha. */
export type NfceDiagnostics = {
  challenge: string | null;
  touched: boolean;
  seconds: number;
};

export type NfceScan = { uf: string; note: NfceNote; diagnostics: NfceDiagnostics };

export type ReceiptQr = { ok: true; url: string; info: AccessKeyInfo } | { ok: false; message: string };

/**
 * Confere o QR lido: precisa ter uma chave de cupom válida e apontar para um
 * portal de governo. O WebView só abre `.gov.br`, porque o script da página
 * roda ali e não deve rodar em site qualquer.
 */
export function readReceiptQr(data: string): ReceiptQr {
  const key = extractAccessKey(data);
  if (!key) return { ok: false, message: "Este QR Code não é de cupom fiscal." };
  const checked = validateAccessKey(key);
  if (!checked.ok) return { ok: false, message: ACCESS_KEY_MESSAGES[checked.reason] };
  if (!isGovUrl(data.trim())) {
    return { ok: false, message: "Este QR Code não leva ao portal da SEFAZ. Use a foto do cupom." };
  }
  return { ok: true, url: data.trim(), info: checked.info };
}

export function isGovUrl(url: string): boolean {
  const match = /^https?:\/\/([^/?#:]+)/i.exec(url);
  return !!match && /(^|\.)gov\.br$/i.test(match[1]!);
}

export function paymentMethodFromNote(note: NfceNote): PaymentMethod | null {
  const method = note.payments[0]?.method.toLowerCase() ?? "";
  if (/cr[ée]dito/.test(method)) return "credit";
  if (/d[ée]bito/.test(method)) return "debit";
  if (/pix/.test(method)) return "pix";
  if (/dinheiro/.test(method)) return "cash";
  if (/boleto/.test(method)) return "boleto";
  return null;
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Tipo de loja pelo nome → categorias padrão, da mais específica à mais geral. */
const MERCHANT_HINTS: [RegExp, string[]][] = [
  [/supermerc|hipermerc|mercado|atacad|mercearia|hortifruti|sacolao|assai|carrefour/, ["Supermercado", "Alimentação"]],
  [/farma|droga|pharma/, ["Farmácia", "Saúde"]],
  [/posto|combust|petro|auto ?posto/, ["Combustível", "Transporte"]],
  [/padaria|panific/, ["Padaria", "Alimentação"]],
  [/restaurante|churrasc|pizz|lanchonete|burger|lanches/, ["Restaurante", "Lanche", "Alimentação"]],
  [/\bpet\b|racao|veterin/, ["Ração e Petisco", "Pet"]],
  [/calcados|sapat/, ["Calçados", "Vestuário"]],
  [/moda|confec|roupa|vestu/, ["Roupas", "Vestuário"]],
  [/livrari|papelari/, ["Livros e Material", "Educação"]],
  [/construcao|home center|ferragen|tintas/, ["Reforma e Manutenção", "Moradia"]],
];

export function suggestCategory(note: NfceNote, categories: Category[]): Category | null {
  const merchant = normalize(note.merchant);
  const hint = MERCHANT_HINTS.find(([pattern]) => pattern.test(merchant));
  if (!hint) return null;
  for (const name of hint[1]) {
    const match = categories.find((c) => normalize(c.name) === normalize(name));
    if (match) return match;
  }
  return null;
}

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "COVABRA SUPERMERCADOS LTDA" → "Covabra Supermercados Ltda" */
export function merchantTitle(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function formatQuantity(quantity: number | null, unit: string | null) {
  if (quantity === null) return "";
  const value = String(quantity).replace(".", ",");
  return unit && unit.toUpperCase() !== "UN" ? `${value} ${unit.toLowerCase()} ` : `${value}x `;
}

/** Lista de itens para o campo de observações (até 1000 caracteres). */
export function notesFromItems(items: NfceItem[], limit = 1000): string {
  // Espaço guardado para a linha "… e mais N itens" quando não couber tudo.
  const reserve = 24;
  const lines = [`Itens do cupom (${items.length}):`];
  let length = lines[0]!.length;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const line = `${formatQuantity(item.quantity, item.unit)}${item.name}${item.total !== null ? ` — ${formatBRL(item.total)}` : ""}`;
    const isLast = i === items.length - 1;
    if (length + 1 + line.length > limit - (isLast ? 0 : reserve)) {
      lines.push(`… e mais ${items.length - i} itens`);
      break;
    }
    lines.push(line);
    length += 1 + line.length;
  }
  return lines.join("\n");
}

// A tela do QR devolve o resultado à Nova transação por aqui: as duas ficam na
// mesma pilha e passar a nota inteira por parâmetro de rota pesaria na URL.
let pending: NfceScan | null = null;

export function setPendingNfceScan(scan: NfceScan) {
  pending = scan;
}

export function takePendingNfceScan(): NfceScan | null {
  const scan = pending;
  pending = null;
  return scan;
}
