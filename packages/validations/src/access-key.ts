/**
 * Chave de acesso de cupom fiscal (NFC-e modelo 65 e CF-e SAT modelo 59): os
 * 44 caracteres que o QR Code carrega. Sem consultar a SEFAZ dá para conferir
 * os dígitos verificadores e tirar estado, mês, CNPJ e número da nota.
 *
 * Layout: cUF(2) AAMM(4) CNPJ(14) modelo(2) ... dígito(1). Desde 2026 o CNPJ
 * pode ser alfanumérico nas 12 primeiras posições (letras maiúsculas); o
 * cálculo dos dígitos usa o código do caractere menos 48, que para algarismos
 * dá o próprio valor.
 */

export const UF_BY_CODE: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

const RECEIPT_MODELS = new Set(["65", "59"]);

/** cUF + AAMM numéricos, CNPJ com 12 alfanuméricos + 2 dígitos, o resto numérico. */
const KEY_PATTERN = /^\d{6}[0-9A-Z]{12}\d{26}$/;

const charValue = (c: string) => c.charCodeAt(0) - 48;

/** Dígito verificador da chave: módulo 11 com pesos 2..9 da direita para a esquerda. */
export function accessKeyCheckDigit(first43: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = first43.length - 1; i >= 0; i--) {
    sum += charValue(first43[i]!) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Dígitos do CNPJ (numérico ou alfanumérico). */
export function isValidCnpj(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base: string) => {
    let sum = 0;
    let weight = 2;
    for (let i = base.length - 1; i >= 0; i--) {
      sum += charValue(base[i]!) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(cnpj.slice(0, 12));
  const d2 = digit(cnpj.slice(0, 12) + d1);
  return cnpj.slice(12) === `${d1}${d2}`;
}

/**
 * Tira a chave do que a pessoa colou: o link do QR (parâmetro `p`, ou `chNFe`
 * no Amazonas) ou a chave digitada, com ou sem espaços.
 */
export function extractAccessKey(input: string): string | null {
  const text = input.trim();
  const param = /[?&](?:p|chNFe)=([^&#\s]+)/i.exec(text);
  let candidate = text;
  if (param) {
    try {
      candidate = decodeURIComponent(param[1]!);
    } catch {
      candidate = param[1]!;
    }
    candidate = candidate.split("|")[0]!;
  }
  const cleaned = candidate.replace(/[\s.\-/]/g, "").toUpperCase();
  return KEY_PATTERN.test(cleaned) ? cleaned : null;
}

export type AccessKeyInfo = {
  key: string;
  uf: string;
  /** AAAA-MM */
  issuedMonth: string;
  cnpj: string;
  model: string;
};

export type AccessKeyRejection =
  | "formato"
  | "estado"
  | "modelo"
  | "cnpj"
  | "digito"
  | "futuro"
  | "antigo";

export const ACCESS_KEY_MESSAGES: Record<AccessKeyRejection, string> = {
  formato: "Não encontramos a chave de 44 dígitos. Cole o link que abre ao ler o QR Code, ou digite a chave impressa no cupom.",
  estado: "A chave não corresponde a nenhum estado. Confira os números.",
  modelo: "Esta chave não é de cupom fiscal de loja (NFC-e ou SAT).",
  cnpj: "A chave tem um CNPJ inválido. Confira os números.",
  digito: "A chave não confere (dígito verificador). Confira se digitou todos os números.",
  futuro: "A data da chave está no futuro. Confira os números.",
  antigo: "Este cupom é antigo demais para o programa.",
};

/**
 * Confere a chave sem consultar a SEFAZ. `maxAgeDays` conta pelo mês de
 * emissão (a chave não traz o dia): vale se o fim do mês está dentro do prazo.
 */
export function validateAccessKey(
  key: string,
  options: { now?: Date; maxAgeDays?: number } = {}
): { ok: true; info: AccessKeyInfo } | { ok: false; reason: AccessKeyRejection } {
  const now = options.now ?? new Date();
  if (!KEY_PATTERN.test(key)) return { ok: false, reason: "formato" };

  const uf = UF_BY_CODE[key.slice(0, 2)];
  if (!uf) return { ok: false, reason: "estado" };

  const model = key.slice(20, 22);
  if (!RECEIPT_MODELS.has(model)) return { ok: false, reason: "modelo" };

  const cnpj = key.slice(6, 20);
  if (!isValidCnpj(cnpj)) return { ok: false, reason: "cnpj" };

  if (accessKeyCheckDigit(key.slice(0, 43)) !== Number(key[43])) return { ok: false, reason: "digito" };

  const year = 2000 + Number(key.slice(2, 4));
  const month = Number(key.slice(4, 6));
  if (month < 1 || month > 12) return { ok: false, reason: "formato" };
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1) - 1;
  if (monthStart > now.getTime()) return { ok: false, reason: "futuro" };
  if (options.maxAgeDays !== undefined && monthEnd < now.getTime() - options.maxAgeDays * 86_400_000) {
    return { ok: false, reason: "antigo" };
  }

  return { ok: true, info: { key, uf, issuedMonth: `${year}-${String(month).padStart(2, "0")}`, cnpj, model } };
}
