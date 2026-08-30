/**
 * Preço dos modelos da Groq, em USD por 1 milhão de tokens.
 *
 * Tabela mantida à mão de propósito: a Groq não expõe preço por API, só na
 * página pública (groq.com/pricing). Ao trocar de modelo em /admin/ai, confira
 * lá e atualize aqui — catálogo e preço mudam com frequência.
 *
 * Modelo ausente desta tabela NÃO é tratado como gratuito: o custo vira `null`
 * e a tela mostra "não estimado". Contar como zero subestimaria a fatura, que
 * é justamente o oposto do que um medidor de gasto serve pra fazer.
 */
type TokenPrice = { inputPerMillion: number; outputPerMillion: number };

const TOKEN_PRICES: Record<string, TokenPrice> = {
  "openai/gpt-oss-120b": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "openai/gpt-oss-20b": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "openai/gpt-oss-safeguard-20b": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "qwen/qwen3.8-27b": { inputPerMillion: 0.8, outputPerMillion: 4 },
};

/**
 * Modelos de áudio são cobrados por hora transcrita, não por token. O
 * `AiUsageLog` guarda tokens, então não há como derivar o custo deles daqui.
 */
const AUDIO_MODELS = new Set(["whisper-large-v3", "whisper-large-v3-turbo"]);

/** Custo estimado em USD, ou `null` quando não é possível estimar. */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number | null {
  if (AUDIO_MODELS.has(model)) return null;

  const price = TOKEN_PRICES[model];
  if (!price) return null;

  return (
    (promptTokens / 1_000_000) * price.inputPerMillion +
    (completionTokens / 1_000_000) * price.outputPerMillion
  );
}

/** Legenda mostrada na tela quando `estimateCostUsd` devolve `null`. */
export function costUnavailableReason(model: string): string {
  if (AUDIO_MODELS.has(model)) return "cobrado por hora de áudio";
  return "preço não cadastrado";
}
