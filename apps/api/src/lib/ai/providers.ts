/**
 * Provedores de IA que o sistema sabe chamar e como cada um lista os modelos.
 *
 * Nenhum dos três diz pela API se um modelo é gratuito. A classificação abaixo
 * vem das páginas de preço (conferidas em 10/2026) e precisa de revisão quando
 * os planos mudarem:
 * - Groq: o plano Free libera todos os modelos, com limite de uso.
 * - Ollama Cloud: o plano Free dá créditos iniciais para "um conjunto menor de
 *   modelos" que a Ollama não lista. Só conta como gratuito o que estiver em
 *   OLLAMA_FREE_MODELS; o resto consome créditos.
 * - Claude: todos pagos por uso.
 */

export const AI_PROVIDER_IDS = ["groq", "anthropic", "ollama"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export function isAiProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export const AI_PROVIDERS: Record<
  AiProviderId,
  { name: string; baseUrl: string; envKey: string; keyUrl: string; pricingNote: string }
> = {
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    pricingNote: "Todos os modelos têm uso gratuito com limite no plano Free da Groq.",
  },
  anthropic: {
    name: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    keyUrl: "https://console.anthropic.com/settings/keys",
    pricingNote: "Todos os modelos são pagos por uso.",
  },
  ollama: {
    name: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    envKey: "OLLAMA_API_KEY",
    keyUrl: "https://ollama.com/settings/keys",
    pricingNote: "O plano Free dá créditos iniciais; os demais modelos consomem créditos.",
  },
};

/** Modelos da Ollama Cloud que o plano Free cobre. A Ollama não publica a lista: preencha ao confirmar. */
const OLLAMA_FREE_MODELS = new Set<string>();

/** Modelos da Groq que não conversam (áudio, voz, classificadores de segurança). */
const GROQ_NON_CHAT = /whisper|orpheus|tts|guard/i;

export type ModelTier = "free" | "paid";
export type ModelInfo = { id: string; label: string; tier: ModelTier };

/** Falha do provedor com o status HTTP e a mensagem que ele devolveu. */
export class AiProviderError extends Error {
  constructor(
    readonly provider: AiProviderId,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export async function readProviderError(provider: AiProviderId, res: Response): Promise<AiProviderError> {
  const text = await res.text().catch(() => "");
  let message = text;
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    message = (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? text;
  } catch {
    // corpo não é JSON: fica o texto cru
  }
  return new AiProviderError(provider, res.status, message || `HTTP ${res.status}`);
}

type ModelsPayload = {
  data?: Array<{ id: string; display_name?: string; active?: boolean }>;
};

/**
 * Normaliza e ordena a lista crua: gratuitos primeiro, depois pagos. Dentro de
 * cada grupo, Claude mantém a ordem da API (mais novos primeiro) e os outros
 * vão em ordem alfabética.
 */
export function normalizeModels(provider: AiProviderId, payload: ModelsPayload): ModelInfo[] {
  const models = (payload.data ?? [])
    .filter((model) => model.active !== false)
    .filter((model) => provider !== "groq" || !GROQ_NON_CHAT.test(model.id))
    .map((model): ModelInfo => ({
      id: model.id,
      label: model.display_name ?? model.id,
      tier:
        provider === "groq" || (provider === "ollama" && OLLAMA_FREE_MODELS.has(model.id)) ? "free" : "paid",
    }));
  if (provider !== "anthropic") models.sort((a, b) => a.id.localeCompare(b.id));
  return [...models.filter((m) => m.tier === "free"), ...models.filter((m) => m.tier === "paid")];
}

/**
 * Modelos que esta chave enxerga. É também a validação da chave: chave
 * inválida responde 401 e vira AiProviderError.
 */
export async function listProviderModels(provider: AiProviderId, apiKey: string): Promise<ModelInfo[]> {
  const def = AI_PROVIDERS[provider];
  const headers: Record<string, string> =
    provider === "anthropic"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { Authorization: `Bearer ${apiKey}` };
  const url = provider === "anthropic" ? `${def.baseUrl}/models?limit=1000` : `${def.baseUrl}/models`;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AiProviderError(provider, 0, `Não foi possível conectar à ${def.name}.`);
  }
  if (!res.ok) throw await readProviderError(provider, res);
  return normalizeModels(provider, (await res.json()) as ModelsPayload);
}
