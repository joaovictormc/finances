-- Assistente de IA interno: conversas com histórico sobre os dados do usuário e
-- agentes personalizados (persona + subconjunto das ferramentas de consulta).

CREATE TABLE "assistant_agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "instructions" TEXT NOT NULL,
    "enabledTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_agents_userId_idx" ON "assistant_agents"("userId");
CREATE INDEX "assistant_conversations_userId_lastMessageAt_idx" ON "assistant_conversations"("userId", "lastMessageAt");
CREATE INDEX "assistant_messages_conversationId_createdAt_idx" ON "assistant_messages"("conversationId", "createdAt");

ALTER TABLE "assistant_agents"
  ADD CONSTRAINT "assistant_agents_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_conversations"
  ADD CONSTRAINT "assistant_conversations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL: apagar um agente não pode levar junto o histórico de conversas dele.
ALTER TABLE "assistant_conversations"
  ADD CONSTRAINT "assistant_conversations_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "assistant_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_messages"
  ADD CONSTRAINT "assistant_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_settings"
  ADD COLUMN "assistantModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-120b',
  ADD COLUMN "assistantEnabled" BOOLEAN NOT NULL DEFAULT true;
