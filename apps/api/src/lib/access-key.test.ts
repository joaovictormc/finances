import { describe, expect, it } from "vitest";
import { accessKeyCheckDigit, extractAccessKey, isValidCnpj, validateAccessKey } from "@finances/validations";

// Chaves reais de cupons públicos da SEFAZ-SP (2020, QR v2; 2026, QR v3).
const SP_2020 = "35200793015006003481651250003293021742482879";
const SP_2026 = "35260861233151003442650160000267191000330645";

/** Monta uma chave válida a partir dos 43 primeiros caracteres. */
const withDigit = (first43: string) => first43 + accessKeyCheckDigit(first43);

describe("extractAccessKey", () => {
  it("lê o link do QR nas versões 2 e 3 e a chave digitada com espaços", () => {
    expect(
      extractAccessKey(
        `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${SP_2020}%7C2%7C1%7C1%7CEEA0548D49681F1CAAC6105A7A79E444B4FC49F3`
      )
    ).toBe(SP_2020);
    expect(extractAccessKey(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${SP_2026}|3|1`)).toBe(SP_2026);
    expect(extractAccessKey("3526 0861 2331 5100 3442 6501 6000 0267 1910 0033 0645")).toBe(SP_2026);
    expect(extractAccessKey("sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?chNFe=" + SP_2026)).toBe(SP_2026);
  });

  it("recusa o que não tem uma chave", () => {
    expect(extractAccessKey("https://www.nfce.fazenda.sp.gov.br/qrcode")).toBeNull();
    expect(extractAccessKey("123")).toBeNull();
  });
});

describe("validateAccessKey", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("aceita chaves reais e tira estado, mês, CNPJ e modelo", () => {
    expect(validateAccessKey(SP_2026, { now, maxAgeDays: 30 })).toEqual({
      ok: true,
      info: { key: SP_2026, uf: "SP", issuedMonth: "2026-08", cnpj: "61233151003442", model: "65" },
    });
    expect(validateAccessKey(SP_2020, { now }).ok).toBe(true);
  });

  it("recusa dígito errado, modelo que não é de cupom, estado inexistente e CNPJ inválido", () => {
    expect(validateAccessKey(SP_2026.slice(0, 43) + "9", { now })).toEqual({ ok: false, reason: "digito" });
    expect(validateAccessKey(withDigit(SP_2026.slice(0, 20) + "55" + SP_2026.slice(22, 43)), { now })).toEqual({
      ok: false,
      reason: "modelo",
    });
    expect(validateAccessKey(withDigit("99" + SP_2026.slice(2, 43)), { now })).toEqual({ ok: false, reason: "estado" });
    expect(validateAccessKey(withDigit(SP_2026.slice(0, 6) + "11111111111111" + SP_2026.slice(20, 43)), { now })).toEqual({
      ok: false,
      reason: "cnpj",
    });
  });

  it("prazo pelo mês de emissão: antigo demais e no futuro", () => {
    expect(validateAccessKey(SP_2020, { now, maxAgeDays: 30 })).toEqual({ ok: false, reason: "antigo" });
    expect(validateAccessKey(SP_2026, { now: new Date("2026-07-15T12:00:00Z") })).toEqual({ ok: false, reason: "futuro" });
    // Agosto ainda vale no começo de setembro com prazo de 30 dias.
    expect(validateAccessKey(SP_2026, { now: new Date("2026-09-10T12:00:00Z"), maxAgeDays: 30 }).ok).toBe(true);
  });
});

describe("isValidCnpj", () => {
  it("numérico e alfanumérico (2026)", () => {
    expect(isValidCnpj("61233151003442")).toBe(true);
    expect(isValidCnpj("61233151003443")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    // Exemplo oficial da Receita para o CNPJ alfanumérico.
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
  });
});
