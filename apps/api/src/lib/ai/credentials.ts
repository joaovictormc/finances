import { db, decryptTaggedField, encryptTaggedField, Prisma } from "@finances/db";
import { AI_PROVIDERS, AI_PROVIDER_IDS, listProviderModels, type AiProviderId, type ModelInfo } from "./providers";

/**
 * Chaves de API dos provedores de IA. A cadastrada em /admin/ai vale primeiro
 * (gravada criptografada); sem ela, vale a do .env. A chave em texto claro
 * nunca sai da API: a tela recebe só o final mascarado.
 */

export type KeySource = "admin" | "env" | null;

async function getRow(provider: AiProviderId) {
  return db.aiProviderCredential.findUnique({ where: { provider } });
}

function envKey(provider: AiProviderId): string | null {
  return process.env[AI_PROVIDERS[provider].envKey]?.trim() || null;
}

export async function getProviderApiKey(provider: AiProviderId): Promise<string | null> {
  const row = await getRow(provider);
  if (row?.apiKey) return decryptTaggedField(row.apiKey);
  return envKey(provider);
}

/** "gsk_…a3f9": o bastante para reconhecer a chave, sem expor. */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export type ProviderStatus = {
  id: AiProviderId;
  name: string;
  keyUrl: string;
  pricingNote: string;
  source: KeySource;
  maskedKey: string | null;
  verifiedAt: Date | null;
  lastError: string | null;
  models: ModelInfo[];
};

export async function getProviderStatus(provider: AiProviderId): Promise<ProviderStatus> {
  const row = await getRow(provider);
  const stored = row?.apiKey ? decryptTaggedField(row.apiKey) : null;
  const fromEnv = envKey(provider);
  const key = stored ?? fromEnv;
  const def = AI_PROVIDERS[provider];
  return {
    id: provider,
    name: def.name,
    keyUrl: def.keyUrl,
    pricingNote: def.pricingNote,
    source: stored ? "admin" : fromEnv ? "env" : null,
    maskedKey: key ? maskKey(key) : null,
    verifiedAt: row?.verifiedAt ?? null,
    lastError: row?.lastError ?? null,
    models: (row?.models as ModelInfo[] | null) ?? [],
  };
}

export async function listProviderStatuses(): Promise<ProviderStatus[]> {
  return Promise.all(AI_PROVIDER_IDS.map(getProviderStatus));
}

async function recordCheck(provider: AiProviderId, data: { apiKey?: string | null; models?: ModelInfo[]; error?: string }) {
  const fields = {
    ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
    ...(data.models && { models: data.models as unknown as Prisma.InputJsonValue, verifiedAt: new Date() }),
    lastError: data.error ?? null,
  };
  await db.aiProviderCredential.upsert({
    where: { provider },
    update: fields,
    create: { provider, ...fields },
  });
}

/**
 * Valida a chave listando os modelos e só então grava (criptografada). Chave
 * inválida não é salva: o erro do provedor volta para a tela.
 */
export async function saveProviderKey(provider: AiProviderId, apiKey: string): Promise<ProviderStatus> {
  const models = await listProviderModels(provider, apiKey.trim());
  await recordCheck(provider, { apiKey: encryptTaggedField(apiKey.trim()), models });
  return getProviderStatus(provider);
}

/** Busca de novo os modelos com a chave em uso (do admin ou do .env). */
export async function refreshProviderModels(provider: AiProviderId): Promise<ProviderStatus> {
  const key = await getProviderApiKey(provider);
  if (!key) throw new Error(`Sem chave de API para ${AI_PROVIDERS[provider].name}.`);
  try {
    await recordCheck(provider, { models: await listProviderModels(provider, key) });
  } catch (error) {
    await recordCheck(provider, { error: (error as Error).message });
    throw error;
  }
  return getProviderStatus(provider);
}

/** Apaga a chave do painel. A do .env, se houver, volta a valer. */
export async function removeProviderKey(provider: AiProviderId): Promise<ProviderStatus> {
  await db.aiProviderCredential.upsert({
    where: { provider },
    update: { apiKey: null, models: [], verifiedAt: null, lastError: null },
    create: { provider },
  });
  // A do .env passa a valer: a lista de modelos precisa ser a que ela enxerga.
  if (envKey(provider)) {
    try {
      return await refreshProviderModels(provider);
    } catch {
      // Falha fica registrada em lastError e aparece na tela.
    }
  }
  return getProviderStatus(provider);
}
