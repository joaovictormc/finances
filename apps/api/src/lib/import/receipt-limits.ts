const MAX_FILE_BYTES = 8 * 1024 * 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Marcas de HEIC/HEIF que aparecem logo depois do box "ftyp".
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevm", "hevs", "mif1", "msf1"]);

/**
 * Descobre o formato real da imagem pelos magic bytes.
 *
 * Não dá pra confiar no MIME declarado pelo cliente: o app manda `image/jpeg`
 * por padrão e o que chega pode ser outra coisa — inclusive texto, quando o
 * upload se corrompe no caminho (já aconteceu com o multipart do React Native).
 * A Groq também ignora o MIME e olha os bytes, então validamos igual a ela.
 */
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return "image/png";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "GIF8") {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("latin1") === "ftyp" &&
    HEIF_BRANDS.has(buffer.subarray(8, 12).toString("latin1"))
  ) {
    return "image/heic";
  }
  return null;
}

/** true se os bytes são texto base64 — sintoma de upload codificado duas vezes. */
function looksLikeBase64Text(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 64)).toString("latin1");
  return sample.length > 0 && /^[A-Za-z0-9+/=\r\n]+$/.test(sample);
}

/**
 * Resumo dos primeiros bytes pra log — o suficiente pra identificar o formato
 * (ou a falta dele) sem despejar a imagem inteira no terminal.
 */
export function describeBytes(buffer: Buffer): string {
  const hex = buffer.subarray(0, 12).toString("hex").match(/../g)?.join(" ") ?? "";
  const ascii = buffer.subarray(0, 24).toString("latin1").replace(/[^\x20-\x7e]/g, ".");
  return `${buffer.length} bytes | hex: ${hex} | ascii: ${ascii}`;
}

/**
 * Valida a imagem pelo conteúdo e devolve o MIME real, que é o que deve ser
 * mandado pra Groq. Lança `Error` com mensagem pronta pro usuário final.
 */
export function validateReceiptImage(buffer: Buffer): string {
  if (buffer.length === 0) {
    throw new Error("A imagem chegou vazia — tente tirar a foto de novo.");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("A imagem excede 8 MB");
  }

  const mimeType = sniffImageMime(buffer);
  if (!mimeType) {
    if (looksLikeBase64Text(buffer)) {
      throw new Error("A imagem chegou codificada em texto em vez de binária — falha no envio, tente de novo.");
    }
    throw new Error("O arquivo enviado não é uma imagem reconhecível — envie JPEG, PNG, WEBP ou HEIC.");
  }

  return mimeType;
}
