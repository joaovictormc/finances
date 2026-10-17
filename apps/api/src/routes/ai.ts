import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import { chat, type ChatMessage } from "../lib/ai/chat";
import { getAiSettings, isWithinUsageLimit, logAiUsage, slotModel } from "../lib/ai/ai-settings";
import { TOOLS, executeTool, buildDateContext } from "../lib/ai/finance-tools";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { isAiInsightsAllowed } from "../lib/plan-limits";
import { checkRateLimit } from "../lib/rate-limit";

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", requireAuth);

app.get("/insights", async (c) => {
  const userId = c.get("userId");
  const insights = await db.aiInsight.findMany({
    where: { userId, isDismissed: false },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });
  return c.json(insights);
});

app.patch("/insights/:id/dismiss", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.aiInsight.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Insight não encontrado" }, 404);

  await db.aiInsight.update({ where: { id }, data: { isDismissed: true, isRead: true } });
  return c.json({ success: true });
});

// ── Consultas em linguagem natural via tool-calling ─────────────────────────
//
// Pergunta avulsa, sem histórico — usada pela caixa de perguntas da Visão Geral.
// As ferramentas de consulta vivem em `lib/ai/finance-tools.ts`, compartilhadas
// com o assistente (`/api/assistant`), que é a versão com conversa contínua.

function buildQuerySystemPrompt() {
  return `Você é um consultor financeiro pessoal que responde perguntas sobre as finanças do usuário em português brasileiro, de forma direta e com números formatados em R$ (vírgula decimal).

Use as ferramentas disponíveis para buscar os dados necessários antes de responder. Se a pergunta não tiver relação com finanças pessoais, responda educadamente que só pode ajudar com isso.

${buildDateContext()}`;
}

const QuerySchema = z.object({ question: z.string().min(1).max(500) });

app.post("/query", zValidator("json", QuerySchema), async (c) => {
  const userId = c.get("userId");
  if (!(await isAiInsightsAllowed(userId))) {
    return c.json(
      { error: "Consultas com IA fazem parte dos planos Pro e Família. Faça upgrade para usar essa função." },
      403
    );
  }
  // Cada pergunta vira uma ou mais chamadas à IA (o laço de ferramentas roda
  // até 4 rodadas), então o custo não é limitado pelo tamanho do pedido.
  if (!(await checkRateLimit({ key: "ai-query", userId, max: 20, windowSeconds: 15 * 60 }))) {
    return c.json({ error: "Muitas consultas seguidas. Tente novamente em alguns minutos." }, 429);
  }

  const settings = await getAiSettings();
  if (!settings.nlQueryEnabled) {
    return c.json({ error: "Consultas de IA temporariamente desativadas" }, 503);
  }
  if (!(await isWithinUsageLimit(settings))) {
    return c.json({ error: "Limite mensal de uso de IA atingido. Tente novamente no próximo mês." }, 503);
  }

  const { question } = c.req.valid("json");

  const messages: ChatMessage[] = [
    { role: "system", content: buildQuerySystemPrompt() },
    { role: "user", content: question },
  ];
  const { provider, model } = slotModel(settings, "text");

  for (let i = 0; i < 4; i++) {
    const response = await chat({ provider, model, messages, tools: TOOLS, temperature: 0.2 });
    await logAiUsage({ userId, feature: "nl_query", provider, model, usage: response.usage });

    if (response.toolCalls.length === 0) {
      return c.json({ answer: response.content ?? "Não consegui gerar uma resposta." });
    }

    messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments);
      } catch {
        // mantém args vazio se o modelo enviar argumentos inválidos
      }
      const result = await executeTool(userId, call.name, args);
      messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(result) });
    }
  }

  return c.json({ answer: "Não consegui concluir a análise. Tente reformular a pergunta." });
});

export default app;
