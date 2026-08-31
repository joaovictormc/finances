import { describe, expect, it } from "vitest";
import { buildPixPayload, pixTxidFromId } from "./pix";

// CRC-16/CCITT-FALSE por tabela — implementação separada da versão bitwise de
// pix.ts, para o teste não repetir o código que deveria estar checando. Fica
// ancorada no vetor publicado do algoritmo ("123456789" → 0x29B1), verificado
// no primeiro caso abaixo.
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index << 8;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 0x8000) !== 0 ? ((value << 1) ^ 0x1021) & 0xffff : (value << 1) & 0xffff;
  }
  return value;
});

function tableAt(index: number): number {
  const value = CRC_TABLE[index & 0xff];
  if (value === undefined) throw new Error("índice fora da tabela CRC");
  return value;
}

function crcRef(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc = (((crc << 8) & 0xffff) ^ tableAt((crc >> 8) ^ input.charCodeAt(i))) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Lê um campo obrigatório, falhando com nome em vez de comparar undefined. */
function field(fields: Record<string, string>, id: string): string {
  const value = fields[id];
  if (value === undefined) throw new Error(`campo ${id} ausente no payload`);
  return value;
}

/** Lê o payload EMV de volta em pares id → valor, validando os tamanhos. */
function parseTlv(payload: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let cursor = 0;
  while (cursor < payload.length) {
    const id = payload.slice(cursor, cursor + 2);
    const length = Number(payload.slice(cursor + 2, cursor + 4));
    expect(Number.isNaN(length)).toBe(false);
    fields[id] = payload.slice(cursor + 4, cursor + 4 + length);
    cursor += 4 + length;
  }
  return fields;
}

const base = {
  key: "chave@exemplo.com",
  receiverName: "João Vitório",
  receiverCity: "São Paulo",
  amount: 12.3,
  txid: "assinatura-001",
};

describe("buildPixPayload", () => {
  it("fecha o payload com o CRC do padrão EMV", () => {
    // Se este vetor falhar, o problema é o CRC de referência do teste, não o pix.ts.
    expect(crcRef("123456789")).toBe("29B1");

    const payload = buildPixPayload(base);
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(payload.slice(-4)).toBe(crcRef(payload.slice(0, -4)));
  });

  it("monta os campos obrigatórios do BR Code", () => {
    const fields = parseTlv(buildPixPayload(base));

    expect(fields["00"]).toBe("01"); // Payload Format Indicator
    expect(fields["52"]).toBe("0000"); // Merchant Category Code
    expect(fields["53"]).toBe("986"); // moeda: BRL
    expect(fields["58"]).toBe("BR");
    expect(fields["54"]).toBe("12.30"); // sempre com 2 casas, mesmo em 12.3
    expect(parseTlv(field(fields, "26"))).toEqual({ "00": "br.gov.bcb.pix", "01": base.key });
    expect(parseTlv(field(fields, "62"))).toEqual({ "05": "ASSINATURA001" });
  });

  it("normaliza nome e cidade dentro dos limites do padrão", () => {
    const fields = parseTlv(buildPixPayload(base));

    expect(fields["59"]).toBe("JOAO VITORIO"); // sem acento, em caixa alta
    expect(fields["60"]).toBe("SAO PAULO");

    const longos = parseTlv(
      buildPixPayload({
        ...base,
        receiverName: "A".repeat(40),
        receiverCity: "B".repeat(40),
      })
    );
    expect(longos["59"]).toHaveLength(25);
    expect(longos["60"]).toHaveLength(15);
  });

  it("usa os valores padrão quando a limpeza esvazia os campos", () => {
    const fields = parseTlv(
      buildPixPayload({ ...base, receiverName: "!!!", receiverCity: "***", txid: "###" })
    );

    expect(fields["59"]).toBe("RECEBEDOR");
    expect(fields["60"]).toBe("BRASIL");
    expect(parseTlv(field(fields, "62"))).toEqual({ "05": "***" });
  });
});

describe("pixTxidFromId", () => {
  it("mantém só alfanuméricos e corta em 25 caracteres", () => {
    expect(pixTxidFromId("ckt_abc-123")).toBe("cktabc123");
    expect(pixTxidFromId("x".repeat(40))).toHaveLength(25);
  });

  it("cai no padrão quando não sobra nada do id", () => {
    expect(pixTxidFromId("---")).toBe("PIXPAYMENT");
  });
});
