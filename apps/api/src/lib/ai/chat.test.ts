import { describe, expect, it, vi } from "vitest";

vi.mock("./credentials", () => ({ getProviderApiKey: vi.fn() }));

import { fromAnthropicResponse, fromOpenAiResponse, toAnthropicBody, toOpenAiBody, type ChatRequest } from "./chat";
import { normalizeModels } from "./providers";

const conversation: ChatRequest = {
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  messages: [
    { role: "system", content: "Você é um consultor." },
    { role: "user", content: "Quanto gastei?" },
    { role: "assistant", content: null, toolCalls: [{ id: "t1", name: "get_monthly_summary", arguments: '{"year":2026,"month":10}' }] },
    { role: "tool", toolCallId: "t1", content: '{"expense":100}' },
  ],
  tools: [{ name: "get_monthly_summary", description: "Resumo", parameters: { type: "object", properties: {} } }],
  temperature: 0.3,
};

describe("toAnthropicBody", () => {
  it("separa o system, vira ferramentas em tool_use/tool_result e define max_tokens", () => {
    const body = toAnthropicBody(conversation);
    expect(body.system).toBe("Você é um consultor.");
    expect(body.max_tokens).toBe(2048);
    expect(body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Quanto gastei?" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "get_monthly_summary", input: { year: 2026, month: 10 } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: '{"expense":100}' }] },
    ]);
    expect(body.tools).toEqual([{ name: "get_monthly_summary", description: "Resumo", input_schema: { type: "object", properties: {} } }]);
  });

  it("junta resultados de ferramentas seguidos numa só mensagem do usuário", () => {
    const body = toAnthropicBody({
      ...conversation,
      messages: [
        { role: "user", content: "Oi" },
        { role: "assistant", content: "Vou ver", toolCalls: [{ id: "a", name: "x", arguments: "{}" }, { id: "b", name: "y", arguments: "{}" }] },
        { role: "tool", toolCallId: "a", content: "1" },
        { role: "tool", toolCallId: "b", content: "2" },
      ],
    });
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2]!.content).toHaveLength(2);
    expect(body.messages[1]!.content[0]).toEqual({ type: "text", text: "Vou ver" });
  });

  it("imagem vai como base64 e o modo JSON vira instrução no system", () => {
    const body = toAnthropicBody({
      provider: "anthropic",
      model: "m",
      json: true,
      messages: [{ role: "user", content: [{ type: "image", mimeType: "image/jpeg", base64: "AAA" }] }],
    });
    expect(body.messages[0]!.content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAA" } });
    expect(body.system).toContain("objeto JSON");
  });
});

describe("fromAnthropicResponse", () => {
  it("junta o texto, devolve as ferramentas pedidas e o uso", () => {
    const r = fromAnthropicResponse({
      content: [
        { type: "text", text: "Consultando" },
        { type: "tool_use", id: "t9", name: "get_budget_status", input: { a: 1 } },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(r).toEqual({
      content: "Consultando",
      toolCalls: [{ id: "t9", name: "get_budget_status", arguments: '{"a":1}' }],
      usage: { promptTokens: 10, completionTokens: 5 },
    });
  });

  it("no modo JSON tira a cerca de código", () => {
    expect(fromAnthropicResponse({ content: [{ type: "text", text: '```json\n{"ok":true}\n```' }] }, true).content).toBe('{"ok":true}');
  });
});

describe("formato OpenAI (Groq e Ollama)", () => {
  it("converte imagem, ferramentas, histórico e JSON", () => {
    const body = toOpenAiBody({
      provider: "ollama",
      model: "gemma4:31b",
      json: true,
      messages: [
        { role: "user", content: [{ type: "text", text: "Leia" }, { type: "image", mimeType: "image/png", base64: "BBB" }] },
        { role: "assistant", content: null, toolCalls: [{ id: "c1", name: "f", arguments: "{}" }] },
        { role: "tool", toolCallId: "c1", content: "ok" },
      ],
      tools: conversation.tools,
    });
    expect(body.messages[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "Leia" }, { type: "image_url", image_url: { url: "data:image/png;base64,BBB" } }],
    });
    expect(body.messages[1]).toMatchObject({ tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }] });
    expect(body.messages[2]).toEqual({ role: "tool", tool_call_id: "c1", content: "ok" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.tool_choice).toBe("auto");
  });

  it("lê a resposta com ferramentas e uso", () => {
    expect(
      fromOpenAiResponse({
        choices: [{ message: { content: null, tool_calls: [{ id: "x", function: { name: "g", arguments: "{}" } }] } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      })
    ).toEqual({ content: null, toolCalls: [{ id: "x", name: "g", arguments: "{}" }], usage: { promptTokens: 3, completionTokens: 4 } });
  });
});

describe("normalizeModels", () => {
  it("Groq: todos gratuitos, sem modelos de áudio e segurança, em ordem alfabética", () => {
    const models = normalizeModels("groq", {
      data: [
        { id: "qwen/qwen3.8-27b" },
        { id: "whisper-large-v3" },
        { id: "openai/gpt-oss-120b" },
        { id: "meta-llama/llama-prompt-guard-2-22m" },
        { id: "canopylabs/orpheus-v1-english" },
        { id: "old-model", active: false },
      ],
    });
    expect(models.map((m) => m.id)).toEqual(["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
    expect(models.every((m) => m.tier === "free")).toBe(true);
  });

  it("Claude: pagos, na ordem da API e com o nome de exibição", () => {
    const models = normalizeModels("anthropic", {
      data: [
        { id: "claude-opus-5-5", display_name: "Claude Opus 5.5" },
        { id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5" },
      ],
    });
    expect(models).toEqual([
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", tier: "paid" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", tier: "paid" },
    ]);
  });
});
