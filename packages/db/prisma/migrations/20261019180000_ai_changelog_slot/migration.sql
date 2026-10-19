-- Provedor e modelo próprios para o rascunho de Novidades a partir dos commits.

-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "changelogModel" TEXT NOT NULL DEFAULT 'openai/gpt-oss-120b',
ADD COLUMN     "changelogProvider" TEXT NOT NULL DEFAULT 'groq';

-- Começa igual à função de texto, que era a usada até aqui: nada muda até o
-- admin escolher outro modelo em /admin/ai.
UPDATE "ai_settings" SET "changelogProvider" = "textProvider", "changelogModel" = "textModel";
