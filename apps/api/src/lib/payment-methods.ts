import { db } from "@finances/db";

export type PaymentMethodId = "mercadopago" | "pix";

export type PaymentMethodFieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  secret?: boolean; // nunca é devolvido em texto puro pelo GET
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

function isFullyConfigured(id: PaymentMethodId, config: Record<string, string>): boolean {
  const def = getPaymentMethodDef(id);
  const requiredKeys = def.fields.filter((f) => f.required).map((f) => f.key);
  return requiredKeys.length > 0 && requiredKeys.every((key) => !!config[key]);
}

/**
 * Atualiza enabled/config; chaves com valor "" são ignoradas (mantém o valor atual — usado para não
 * sobrescrever secrets mascarados). Sem campos obrigatórios preenchidos, o método nunca fica ativo —
 * assim que ficam completos, é liberado automaticamente (a menos que o admin desative explicitamente).
 */
export async function updatePaymentMethodConfig(
  id: PaymentMethodId,
  data: { enabled?: boolean; config?: Record<string, string> }
) {
  const current = await getPaymentMethodConfig(id);
  const currentConfig = (current.config as Record<string, string>) ?? {};

  const mergedConfig = { ...currentConfig };
  for (const [key, value] of Object.entries(data.config ?? {})) {
    if (value !== "") mergedConfig[key] = value;
  }

  const complete = isFullyConfigured(id, mergedConfig);
  const enabled = complete ? data.enabled !== false : false;

  return db.paymentMethodConfig.update({
    where: { id },
    data: { enabled, config: mergedConfig },
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

/** Valor configurado de um campo (não-secret), com fallback opcional. */
export async function getPaymentMethodConfigValue(
  id: PaymentMethodId,
  key: string
): Promise<string | undefined> {
  const stored = await getPaymentMethodConfig(id);
  const config = (stored.config as Record<string, string>) ?? {};
  return config[key] || undefined;
}
