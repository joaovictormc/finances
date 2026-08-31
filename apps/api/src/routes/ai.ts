import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import type Groq from "groq-sdk";
import { groq } from "../lib/ai/groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "../lib/ai/ai-settings";
import { TOOLS, executeTool, buildDateContext } from "../lib/ai/finance-tools";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { isAiInsightsAllowed } from "../lib/plan-limits";

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

// ── Consultas em linguagem natural via tool-calling (Groq) ───────────────────
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
  const settings = await getAiSettings();
  if (!settings.nlQueryEnabled) {
    return c.json({ error: "Consultas de IA temporariamente desativadas" }, 503);
  }
  if (!(await isWithinUsageLimit(settings))) {
    return c.json({ error: "Limite mensal de uso de IA atingido. Tente novamente no próximo mês." }, 503);
  }

  const { question } = c.req.valid("json");

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildQuerySystemPrompt() },
    { role: "user", content: question },
  ];

  for (let i = 0; i < 4; i++) {
    const response = await groq.chat.completions.create({
      model: settings.textModel,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    });
    await logAiUsage({ userId, feature: "nl_query", model: settings.textModel, usage: response.usage });

    const message = response.choices[0]?.message;
    if (!message) break;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return c.json({ answer: message.content ?? "Não consegui gerar uma resposta." });
    }

    messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

    for (const call of message.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        // mantém args vazio se o modelo enviar argumentos inválidos
      }
      const result = await executeTool(userId, call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return c.json({ answer: "Não consegui concluir a análise. Tente reformular a pergunta." });
});

export default app;
