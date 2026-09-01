import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Criptografia de campo em nível de aplicação (AES-256-GCM) para dados
// sensíveis que precisam ser lidos de volta em texto claro (CPF, tokens de
// integração, segredos de meio de pagamento) — diferente de senha/hash, que
// nunca precisa ser revertido.
// Usa node:crypto nativo, sem dependência nova. Ver docs/deploy.md e
// .env.selfhosted.example (APP_ENCRYPTION_KEY).
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado pro GCM

// Marca o formato de armazenamento. Existe para que um valor gravado antes da
// criptografia entrar (texto puro) possa conviver no mesmo campo com um valor
// já criptografado, sem depender de heurística sobre o conteúdo.
const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Erro dedicado para a chave ausente, para que a rota consiga devolver uma
 * mensagem acionável em vez de um 500 opaco.
 */
export class EncryptionKeyMissingError extends Error {
  constructor() {
    super(
      "APP_ENCRYPTION_KEY não configurada — necessária pra criptografar campos sensíveis (CPF, tokens de integração, segredos de pagamento). Gere com: openssl rand -base64 32"
    );
    this.name = "EncryptionKeyMissingError";
  }
}

/** Permite checar a configuração antes de tentar cifrar (scripts, diagnóstico). */
export function isEncryptionKeyConfigured(): boolean {
  return !!process.env.APP_ENCRYPTION_KEY;
}

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new EncryptionKeyMissingError();
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

/** Diz se o valor guardado está no formato criptografado desta aplicação. */
export function isEncryptedField(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Criptografa marcando o resultado com o prefixo de formato. É idempotente:
 * um valor já marcado volta como está, então rodar o backfill duas vezes não
 * gera cifra sobre cifra.
 */
export function encryptTaggedField(plain: string): string {
  if (isEncryptedField(plain)) return plain;
  return ENCRYPTED_PREFIX + encryptField(plain);
}

/**
 * Descriptografa um valor marcado. Valor sem a marca volta como veio — é dado
 * gravado antes desta mudança, e falhar aqui derrubaria a leitura de quem
 * ainda não rodou o backfill.
 */
export function decryptTaggedField(value: string): string {
  if (!isEncryptedField(value)) return value;
  try {
    return decryptField(value.slice(ENCRYPTED_PREFIX.length));
  } catch (error) {
    if (error instanceof EncryptionKeyMissingError) throw error;
    // O erro cru do node:crypto ("unable to authenticate data") não diz nada
    // ao operador. Na prática só há uma causa: a chave atual não é a que
    // gravou o valor.
    throw new Error(
      "Não foi possível descriptografar o campo — APP_ENCRYPTION_KEY é diferente da que gravou o valor.",
      { cause: error }
    );
  }
}
