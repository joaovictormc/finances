import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@finances/db";
import type Groq from "groq-sdk";
import { groq } from "../lib/ai/groq-client";
import { getAiSettings, isWithinUsageLimit, logAiUsage } from "../lib/ai/ai-settings";
import {
  TOOL_NAMES,
  TOOL_LABELS,
  selectTools,
  executeTool,
  buildDateContext,
} from "../lib/ai/finance-tools";
import { AGENT_PRESETS } from "../lib/ai/agent-presets";
import { requireAuth, type AuthVariables } from "../middleware/auth";
import { isAssistantAllowed } from "../lib/plan-limits";

const app = new Hono<{ Variables: AuthVariables }>();

/** Quantas mensagens anteriores entram no contexto de cada nova pergunta. */
const HISTORY_LIMIT = 20;
/** Teto de idas e voltas de tool calling por pergunta. */
const MAX_TOOL_ROUNDS = 4;
const TITLE_MAX_LENGTH = 50;

app.use("*", requireAuth);

// Gate de plano aplicado a tudo: o assistente é exclusivo de Pro e Família.
app.use("*", async (c, next) => {
  if (!(await isAssistantAllowed(c.get("userId")))) {
    return c.json(
      { error: "O assistente de IA faz parte dos planos Pro e Família. Faça upgrade para usar." },
      403
    );
  }
  await next();
});

// ── Ferramentas disponíveis (para a tela de agentes montar os checkboxes) ─────

app.get("/tools", (c) =>
  c.json(TOOL_NAMES.map((name) => ({ name, label: TOOL_LABELS[name] ?? name })))
);

// ── Agentes personalizados ───────────────────────────────────────────────────

const AgentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(8).optional(),
  instructions: z.string().trim().min(1).max(2000),
  // Lista vazia = todas as ferramentas. Cada nome é validado contra o registro
  // real; sem isso um agente poderia guardar uma ferramenta inexistente e
  // acabar sem nenhuma habilitada na hora de conversar.
  enabledTools: z.array(z.enum(TOOL_NAMES as [string, ...string[]])).default([]),
});

/**
 * Modelos prontos. Só um catálogo — quem escolhe um cria um agente normal via
 * POST /agents, então nada aqui precisa de estado.
 */
app.get("/presets", (c) => c.json(AGENT_PRESETS));

app.get("/agents", async (c) => {
  const agents = await db.assistantAgent.findMany({
    where: { userId: c.get("userId") },
    orderBy: { createdAt: "asc" },
  });
  return c.json(agents);
});

app.post("/agents", zValidator("json", AgentSchema), async (c) => {
  const agent = await db.assistantAgent.create({
    data: { userId: c.get("userId"), ...c.req.valid("json") },
  });
  return c.json(agent, 201);
});

app.patch("/agents/:id", zValidator("json", AgentSchema.partial()), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.assistantAgent.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Agente não encontrado" }, 404);

  const agent = await db.assistantAgent.update({ where: { id }, data: c.req.valid("json") });
  return c.json(agent);
});

app.delete("/agents/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.assistantAgent.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Agente não encontrado" }, 404);

  await db.assistantAgent.delete({ where: { id } });
  return c.json({ success: true });
});

// ── Conversas ────────────────────────────────────────────────────────────────

const CreateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  agentId: z.string().optional(),
});

app.get("/conversations", async (c) => {
  const conversations = await db.assistantConversation.findMany({
    where: { userId: c.get("userId") },
    orderBy: { lastMessageAt: "desc" },
    include: { agent: { select: { id: true, name: true, icon: true } } },
    take: 50,
  });
  return c.json(conversations);
});

app.post("/conversations", zValidator("json", CreateConversationSchema), async (c) => {
  const userId = c.get("userId");
  const { title, agentId } = c.req.valid("json");

  if (agentId) {
    const agent = await db.assistantAgent.findFirst({ where: { id: agentId, userId } });
    if (!agent) return c.json({ error: "Agente não encontrado" }, 404);
  }

  const conversation = await db.assistantConversation.create({
    data: {
      userId,
      agentId,
      // Título derivado da primeira pergunta — evita gastar outra chamada de IA
      // só para nomear a conversa.
      title: title?.slice(0, TITLE_MAX_LENGTH) || "Nova conversa",
    },
  });

  return c.json(conversation, 201);
});

app.get("/conversations/:id", async (c) => {
  const conversation = await db.assistantConversation.findFirst({
    where: { id: c.req.param("id"), userId: c.get("userId") },
    include: {
      agent: { select: { id: true, name: true, icon: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) return c.json({ error: "Conversa não encontrada" }, 404);
  return c.json(conversation);
});

app.delete("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await db.assistantConversation.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Conversa não encontrada" }, 404);

  await db.assistantConversation.delete({ where: { id } });
  return c.json({ success: true });
});

// ── Envio de mensagem — o laço de tool calling ───────────────────────────────

const MessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

function buildSystemPrompt(agent?: { instructions: string; enabledTools: string[] }) {
  let prompt = `Você é um assistente financeiro pessoal dentro de um app de controle financeiro. Responde em português brasileiro, de forma direta, com números formatados em R$ (vírgula decimal).

Use as ferramentas disponíveis para buscar os dados reais do usuário antes de responder — nunca invente valores. Se a pergunta for sobre planejamento (orçamentos, metas, economia), use os dados para embasar a sugestão.

Se a pergunta não tiver relação com finanças pessoais, responda educadamente que só pode ajudar com isso.

${buildDateContext()}`;

  // Um agente com ferramentas restritas responde perguntas fora do seu escopo
  // improvisando com o dado errado — em teste, um agente que só via orçamentos
  // respondeu "saldo das contas" com o valor de um orçamento. Explicitar o
  // limite é o que impede isso.
  if (agent && agent.enabledTools.length > 0) {
    const available = agent.enabledTools.map((name) => TOOL_LABELS[name] ?? name).join(", ");
    prompt += `

LIMITE DE ACESSO DESTE AGENTE
Você só consegue consultar: ${available}.
Se a pergunta exigir qualquer outro dado, diga com franqueza que este agente não tem
acesso a essa informação e sugira usar o assistente geral. NUNCA responda com um dado
diferente do que foi perguntado, nem estime um valor a partir do que você tem.`;
  }

  if (agent?.instructions) {
    prompt += `

INSTRUÇÕES ESPECÍFICAS DESTE AGENTE (definidas pelo usuário):
${agent.instructions}`;
  }

  return prompt;
}

app.post("/conversations/:id/messages", zValidator("json", MessageSchema), async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");
  const { content } = c.req.valid("json");

  const settings = await getAiSettings();
  if (!settings.assistantEnabled) {
    return c.json({ error: "Assistente temporariamente desativado" }, 503);
  }
  if (!(await isWithinUsageLimit(settings))) {
    return c.json({ error: "Limite mensal de uso de IA atingido. Tente novamente no próximo mês." }, 503);
  }

  const conversation = await db.assistantConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      agent: true,
      messages: { orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT },
    },
  });
  if (!conversation) return c.json({ error: "Conversa não encontrada" }, 404);

  // `take` com ordem desc pega as N mais recentes; o modelo precisa delas em
  // ordem cronológica.
  const history = [...conversation.messages].reverse();

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(conversation.agent ?? undefined) },
    ...history.map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      content: message.content,
    })),
    { role: "user", content },
  ];

  const tools = selectTools(conversation.agent?.enabledTools ?? []);
  const calledTools: string[] = [];
  let answer: string | null = null;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await groq.chat.completions.create({
        model: settings.assistantModel,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
      });
      await logAiUsage({
        userId,
        feature: "assistant",
        model: settings.assistantModel,
        usage: response.usage,
      });

      const message = response.choices[0]?.message;
      if (!message) break;

      if (!message.tool_calls || message.tool_calls.length === 0) {
        answer = message.content ?? null;
        break;
      }

      messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

      for (const call of message.tool_calls) {
        calledTools.push(call.function.name);
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
  } catch (error) {
    console.error("[assistant] falha na chamada à Groq:", (error as Error).message);
    return c.json({ error: "A IA não respondeu agora. Tente de novo em instantes." }, 502);
  }

  if (!answer) {
    return c.json({ error: "Não consegui concluir a análise. Tente reformular a pergunta." }, 422);
  }

  // Só persiste depois de ter a resposta: uma pergunta gravada sem resposta
  // deixaria a conversa com uma ponta solta na tela.
  const [, assistantMessage] = await db.$transaction([
    db.assistantMessage.create({ data: { conversationId, role: "user", content } }),
    db.assistantMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: answer,
        toolCalls: calledTools.length > 0 ? calledTools : undefined,
      },
    }),
    db.assistantConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return c.json(assistantMessage, 201);
});

export default app;
