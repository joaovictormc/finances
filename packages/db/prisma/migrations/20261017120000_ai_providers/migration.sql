-- Provedores de IA: Groq, Claude (Anthropic) e Ollama Cloud, escolhidos por função em /admin/ai.

-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "textProvider" TEXT NOT NULL DEFAULT 'groq',
ADD COLUMN     "visionProvider" TEXT NOT NULL DEFAULT 'groq',
ADD COLUMN     "assistantProvider" TEXT NOT NULL DEFAULT 'groq';

-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'groq';

-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "provider" TEXT NOT NULL,
    "apiKey" TEXT,
    "models" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("provider")
);
