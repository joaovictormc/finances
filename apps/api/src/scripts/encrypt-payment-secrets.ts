// Backfill: criptografa em repouso os segredos de PaymentMethodConfig que
// ficaram gravados em texto puro antes de a criptografia entrar.
//
// Rodar uma vez por ambiente, com APP_ENCRYPTION_KEY já definida:
//   pnpm --filter @finances/api secrets:encrypt
//
// É idempotente: campo já criptografado é ignorado, então rodar de novo não
// faz mal. Salvar o método de novo em /admin/payment-methods tem o mesmo
// efeito — este script só evita ter que passar na tela.
import "../env";

import { db, isEncryptedField, isEncryptionKeyConfigured } from "@finances/db";
import { encryptConfig, PAYMENT_METHODS } from "../lib/payment-methods";

async function main() {
  if (!isEncryptionKeyConfigured()) {
    console.error(
      "APP_ENCRYPTION_KEY não configurada — nada foi alterado. Gere com: openssl rand -base64 32"
    );
    process.exit(1);
  }

  for (const def of PAYMENT_METHODS) {
    const secretKeys = def.fields.filter((field) => field.secret).map((field) => field.key);
    if (secretKeys.length === 0) continue;

    const row = await db.paymentMethodConfig.findUnique({ where: { id: def.id } });
    if (!row) {
      console.log(`${def.id}: sem registro no banco, nada a fazer.`);
      continue;
    }

    const config = (row.config as Record<string, string>) ?? {};
    const pending = secretKeys.filter((key) => {
      const value = config[key];
      return !!value && !isEncryptedField(value);
    });

    if (pending.length === 0) {
      console.log(`${def.id}: nenhum segredo em texto puro.`);
      continue;
    }

    await db.paymentMethodConfig.update({
      where: { id: def.id },
      data: { config: encryptConfig(def.id, config) },
    });
    console.log(`${def.id}: criptografado(s) ${pending.join(", ")}`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
