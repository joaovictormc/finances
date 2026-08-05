import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Criptografia de campo em nível de aplicação (AES-256-GCM) para dados
// sensíveis que precisam ser lidos de volta em texto claro (CPF, tokens de
// integração) — diferente de senha/hash, que nunca precisa ser revertido.
// Usa node:crypto nativo, sem dependência nova. Ver docs/deploy.md e
// .env.selfhosted.example (APP_ENCRYPTION_KEY).
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado pro GCM

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "APP_ENCRYPTION_KEY não configurada — necessária pra criptografar/descriptografar campos sensíveis (CPF, tokens Open Finance)."
    );
  }
  // scrypt deriva uma chave de 32 bytes determinística a partir do secret,
  // independente do tamanho/formato que o operador colocou no env var.
  return scryptSync(secret, "finances-app-encryption", 32);
}

/** Criptografa uma string; formato de saída: "iv:tag:ciphertext" em base64. */
export function encryptField(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** Descriptografa uma string gerada por encryptField. */
export function decryptField(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de campo criptografado inválido");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
