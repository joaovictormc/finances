/** Gera o payload "copia e cola" do Pix (BR Code / EMV QR Code estático). */

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

function sanitize(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    .replace(/[^A-Za-z0-9 ]/g, "") // descarta acentos (já separados pelo NFD) e símbolos
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(input: {
  key: string;
  receiverName: string;
  receiverCity: string;
  amount: number; // em reais
  txid: string; // alfanumérico, sem espaços/acentos
}): string {
  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", input.key);
  const txid = sanitize(input.txid, 25).replace(/\s/g, "") || "***";

  const fields = [
    tlv("00", "01"), // Payload Format Indicator
    tlv("26", merchantAccountInfo), // Merchant Account Information — Pix
    tlv("52", "0000"), // Merchant Category Code
    tlv("53", "986"), // Transaction Currency — BRL
    tlv("54", input.amount.toFixed(2)), // Transaction Amount
    tlv("58", "BR"), // Country Code
    tlv("59", sanitize(input.receiverName, 25) || "RECEBEDOR"), // Merchant Name
    tlv("60", sanitize(input.receiverCity, 15) || "BRASIL"), // Merchant City
    tlv("62", tlv("05", txid)), // Additional Data Field — txid
  ].join("");

  const withCrcPlaceholder = `${fields}6304`;
  return `${withCrcPlaceholder}${crc16(withCrcPlaceholder)}`;
}

/** Gera um txid curto e alfanumérico a partir de um id qualquer (ex: cuid). */
export function pixTxidFromId(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "PIXPAYMENT";
}
