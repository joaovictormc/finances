import { AI_PROVIDERS, AiProviderError, readProviderError, type AiProviderId } from "./providers";
import { getProviderApiKey } from "./credentials";

/**
 * Camada única de chamada aos modelos de IA. As features falam este formato
 * (parecido com o da OpenAI, que Groq e Ollama já aceitam) e cada provedor
 * traduz para a própria API: Groq e Ollama Cloud pelo endpoint compatível com
 * OpenAI, Claude pela Messages API da Anthropic.
 */

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; base64: string };

export type ToolCall = { id: string; name: string; arguments: string };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatContentPart[] }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

export type ChatRequest = {
  provider: AiProviderId;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  /** Pede a resposta como um objeto JSON. */
  json?: boolean;
  /** Groq e Ollama; ignorada no Claude, que não aceita mais o parâmetro. */
  temperature?: number;
  maxTokens?: number;
  /** Chave usada no lugar da cadastrada (teste de conexão no admin). */
  apiKey?: string;
};

export type ChatUsage = { promptTokens: number; completionTokens: number };

export type ChatResponse = { content: string | null; toolCalls: ToolCall[]; usage: ChatUsage | null };

export { AiProviderError };

const DEFAULT_MAX_TOKENS = 2048;

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const apiKey = request.apiKey ?? (await getProviderApiKey(request.provider));
  if (!apiKey) {
    throw new AiProviderError(request.provider, 401, `Sem chave de API para ${AI_PROVIDERS[request.provider].name}.`);
  }
  return request.provider === "anthropic" ? chatAnthropic(request, apiKey) : chatOpenAiCompatible(request, apiKey);
}

// ── Groq e Ollama Cloud (compatível com OpenAI) ──────────────────────────────

export function toOpenAiBody(request: ChatRequest) {
  return {
    model: request.model,
    messages: request.messages.map((message) => {
      switch (message.role) {
        case "system":
          return { role: "system", content: message.content };
        case "user":
          return {
            role: "user",
            content:
              typeof message.content === "string"
                ? message.content
                : message.content.map((part) =>
                    part.type === "text"
                      ? { type: "text", text: part.text }
                      : { type: "image_url", image_url: { url: `data:${part.mimeType};base64,${part.base64}` } }
                  ),
          };
        case "assistant":
          return {
            role: "assistant",
            content: message.content,
            ...(message.toolCalls?.length && {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: call.arguments },
              })),
            }),
          };
        case "tool":
          return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
      }
    }),
    ...(request.tools?.length && {
      tools: request.tools.map((tool) => ({ type: "function", function: tool })),
      tool_choice: "auto",
    }),
    ...(request.json && { response_format: { type: "json_object" } }),
    ...(request.temperature !== undefined && { temperature: request.temperature }),
    ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
  };
}

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function fromOpenAiResponse(body: OpenAiResponse): ChatResponse {
  const message = body.choices?.[0]?.message;
  return {
    content: message?.content ?? null,
    toolCalls: (message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    })),
    usage: body.usage
      ? { promptTokens: body.usage.prompt_tokens ?? 0, completionTokens: body.usage.completion_tokens ?? 0 }
      : null,
  };
}

async function chatOpenAiCompatible(request: ChatRequest, apiKey: string): Promise<ChatResponse> {
  const res = await fetch(`${AI_PROVIDERS[request.provider].baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(toOpenAiBody(request)),
  });
  if (!res.ok) throw await readProviderError(request.provider, res);
  return fromOpenAiResponse((await res.json()) as OpenAiResponse);
}

// ── Claude (Anthropic Messages API) ──────────────────────────────────────────

const ANTHROPIC_VERSION = "2023-06-01";

const JSON_INSTRUCTION =
  "Responda somente com um objeto JSON válido, sem texto antes ou depois e sem bloco de código.";

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicBlock[] };

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * A Messages API não tem papel "system" nem "tool": o system vai à parte, o
 * resultado de ferramenta vira bloco `tool_result` numa mensagem do usuário, e
 * mensagens seguidas do mesmo papel precisam ser uma só.
 */
export function toAnthropicBody(request: ChatRequest) {
  const system = request.messages
    .filter((m): m is Extract<ChatMessage, { role: "system" }> => m.role === "system")
    .map((m) => m.content);
  if (request.json) system.push(JSON_INSTRUCTION);

  const messages: AnthropicMessage[] = [];
  const push = (role: AnthropicMessage["role"], blocks: AnthropicBlock[]) => {
    if (blocks.length === 0) return;
    const last = messages.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  for (const message of request.messages) {
    if (message.role === "user") {
      push(
        "user",
        typeof message.content === "string"
          ? [{ type: "text", text: message.content }]
          : message.content.map((part) =>
              part.type === "text"
                ? { type: "text" as const, text: part.text }
                : { type: "image" as const, source: { type: "base64" as const, media_type: part.mimeType, data: part.base64 } }
            )
      );
    } else if (message.role === "assistant") {
      push("assistant", [
        ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
        ...(message.toolCalls ?? []).map((call) => ({
          type: "tool_use" as const,
          id: call.id,
          name: call.name,
          input: parseArguments(call.arguments),
        })),
      ]);
    } else if (message.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }]);
    }
  }

  return {
    model: request.model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(system.length && { system: system.join("\n\n") }),
    messages,
    ...(request.tools?.length && {
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      })),
    }),
    // Sem temperature: os modelos Claude atuais recusam o parâmetro ("temperature
    // is deprecated for this model") e a chamada inteira falhava com 400.
  };
}

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Tira a cerca de código (```json … ```) que o modelo às vezes põe mesmo pedindo só JSON. */
function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1]! : text;
}

export function fromAnthropicResponse(body: AnthropicResponse, json = false): ChatResponse {
  const blocks = body.content ?? [];
  const text = blocks
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("");
  return {
    content: text ? (json ? stripCodeFence(text) : text) : null,
    toolCalls: blocks
      .filter((block) => block.type === "tool_use")
      .map((block) => ({ id: block.id!, name: block.name!, arguments: JSON.stringify(block.input ?? {}) })),
    usage: body.usage
      ? { promptTokens: body.usage.input_tokens ?? 0, completionTokens: body.usage.output_tokens ?? 0 }
      : null,
  };
}

async function chatAnthropic(request: ChatRequest, apiKey: string): Promise<ChatResponse> {
  const res = await fetch(`${AI_PROVIDERS.anthropic.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(toAnthropicBody(request)),
  });
  if (!res.ok) throw await readProviderError("anthropic", res);
  return fromAnthropicResponse((await res.json()) as AnthropicResponse, request.json);
}
