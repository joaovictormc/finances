import { db, decryptTaggedField, encryptTaggedField } from "@finances/db";

export type PaymentMethodId = "mercadopago" | "pix";

export type PaymentMethodFieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  secret?: boolean; // nunca é devolvido em texto puro pelo GET, e vai criptografado pro banco
  required?: boolean; // precisa estar preenchido para o método ser liberado automaticamente
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type PaymentMethodDef = {
  id: PaymentMethodId;
  name: string;
  description: string;
  fields: PaymentMethodFieldDef[];
};

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: "mercadopago",
    name: "Mercado Pago",
    description: "Assinatura recorrente via checkout do Mercado Pago",
    fields: [
      { key: "accessToken", label: "Access Token", type: "password", secret: true, required: true },
      { key: "publicKey", label: "Public Key", type: "text" },
      { key: "webhookSecret", label: "Webhook Secret", type: "password", secret: true },
    ],
  },
  {
    id: "pix",
    name: "Pix direto",
    description: "Pix copia-e-cola com QR code; o pagamento é confirmado manualmente pelo admin",
    fields: [
      {
        key: "key",
        label: "Chave Pix",
        type: "text",
        placeholder: "CPF, CNPJ, e-mail, celular ou chave aleatória",
        required: true,
      },
      {
        key: "keyType",
        label: "Tipo da chave",
        type: "select",
        options: [
          { value: "cpf", label: "CPF" },
          { value: "cnpj", label: "CNPJ" },
          { value: "email", label: "E-mail" },
          { value: "celular", label: "Celular" },
          { value: "aleatoria", label: "Aleatória" },
        ],
      },
      {
        key: "receiverName",
        label: "Nome do recebedor",
        type: "text",
        placeholder: "Como aparece para o pagador",
        required: true,
      },
      { key: "receiverCity", label: "Cidade do recebedor", type: "text", required: true },
    ],
  },
];

export function getPaymentMethodDef(id: PaymentMethodId): PaymentMethodDef {
  const def = PAYMENT_METHODS.find((m) => m.id === id);
  if (!def) throw new Error(`Método de pagamento desconhecido: ${id}`);
  return def;
}

function secretKeys(id: PaymentMethodId): string[] {
  return getPaymentMethodDef(id)
    .fields.filter((field) => field.secret)
    .map((field) => field.key);
}

/**
 * Config com os campos secret em texto claro. Campo gravado antes desta
 * mudança está em texto puro e passa direto — ver decryptTaggedField.
 */
export function decryptConfig(
  id: PaymentMethodId,
  config: Record<string, string>
): Record<string, string> {
  const plain = { ...config };
  for (const key of secretKeys(id)) {
    const value = plain[key];
    if (value) plain[key] = decryptTaggedField(value);
  }
  return plain;
}

/**
 * Config pronto pra gravar: todo campo marcado como secret sai criptografado.
 * Campo não-secret fica legível de propósito — o admin precisa conferir
 * chave Pix e public key na tela, e nada aqui é credencial.
 */
export function encryptConfig(
  id: PaymentMethodId,
  config: Record<string, string>
): Record<string, string> {
  const stored = { ...config };
  for (const key of secretKeys(id)) {
    const value = stored[key];
    if (value) stored[key] = encryptTaggedField(value);
  }
  return stored;
}

/**
 * Linha crua do banco — o config vem como está gravado, com os secrets
 * criptografados. Use readPaymentMethodConfig quando precisar do valor real.
 */
export async function getPaymentMethodConfig(id: PaymentMethodId) {
  return db.paymentMethodConfig.upsert({
    where: { id },
    update: {},
    create: { id, enabled: false, config: {} },
  });
}

export async function listPaymentMethodConfigs() {
  return Promise.all(PAYMENT_METHODS.map((def) => getPaymentMethodConfig(def.id)));
}

/** Estado de ativação + config com os secrets já em texto claro, pronto pra uso. */
export async function readPaymentMethodConfig(
  id: PaymentMethodId
): Promise<{ enabled: boolean; config: Record<string, string> }> {
  const stored = await getPaymentMethodConfig(id);
  return {
    enabled: stored.enabled,
    config: decryptConfig(id, (stored.config as Record<string, string>) ?? {}),
  };
}

function isFullyConfigured(id: PaymentMethodId, config: Record<string, string>): boolean {
  const def = getPaymentMethodDef(id);
  const requiredKeys = def.fields.filter((f) => f.required).map((f) => f.key);
  return requiredKeys.length > 0 && requiredKeys.every((key) => !!config[key]);
}

/**
 * Atualiza enabled/config; chaves com valor "" são ignoradas (mantém o valor atual — usado para não
 * sobrescrever secrets mascarados). Sem campos obrigatórios preenchidos, o método nunca fica ativo —
 * assim que ficam completos, é liberado automaticamente (a menos que o admin desative explicitamente).
 *
 * A mesclagem acontece em texto claro: o que chega do admin vem em texto puro e o que está no banco
 * está criptografado, então misturar os dois formatos no mesmo objeto daria merge errado. Como o
 * resultado é recriptografado inteiro, salvar de novo já converte um registro legado.
 *
 * Lança EncryptionKeyMissingError se houver segredo a gravar sem APP_ENCRYPTION_KEY: sem a chave o
 * certo é recusar, não cair pra texto puro em silêncio.
 */
export async function updatePaymentMethodConfig(
  id: PaymentMethodId,
  data: { enabled?: boolean; config?: Record<string, string> }
) {
  const current = await getPaymentMethodConfig(id);
  const mergedConfig = decryptConfig(id, (current.config as Record<string, string>) ?? {});

  for (const [key, value] of Object.entries(data.config ?? {})) {
    if (value !== "") mergedConfig[key] = value;
  }

  const complete = isFullyConfigured(id, mergedConfig);
  const enabled = complete ? data.enabled !== false : false;

  return db.paymentMethodConfig.update({
    where: { id },
    data: { enabled, config: encryptConfig(id, mergedConfig) },
  });
}

/** Retorna o config com campos secret zerados + a lista dos que estão de fato preenchidos. */
export function maskSecrets(id: PaymentMethodId, config: Record<string, string>) {
  const def = getPaymentMethodDef(id);
  const masked: Record<string, string> = { ...config };
  const secretsSet: string[] = [];

  for (const field of def.fields) {
    if (field.secret) {
      if (masked[field.key]) secretsSet.push(field.key);
      masked[field.key] = "";
    }
  }

  return { config: masked, secretsSet };
}

/** Valor configurado de um campo, já descriptografado, com fallback opcional. */
export async function getPaymentMethodConfigValue(
  id: PaymentMethodId,
  key: string
): Promise<string | undefined> {
  const { config } = await readPaymentMethodConfig(id);
  return config[key] || undefined;
}
