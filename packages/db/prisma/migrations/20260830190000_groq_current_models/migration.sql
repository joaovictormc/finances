-- Os modelos llama-3.x saíram do catálogo da Groq e passaram a responder
-- 404 / model_decommissioned, derrubando todas as chamadas de IA (texto e visão).
-- Além de trocar o DEFAULT, é preciso migrar a linha singleton já existente:
-- ela guarda os ids antigos e não é afetada por mudança de default.

ALTER TABLE "ai_settings" ALTER COLUMN "textModel" SET DEFAULT 'openai/gpt-oss-120b';
ALTER TABLE "ai_settings" ALTER COLUMN "visionModel" SET DEFAULT 'qwen/qwen3.8-27b';

UPDATE "ai_settings"
  SET "textModel" = 'openai/gpt-oss-120b'
  WHERE "textModel" = 'llama-3.3-70b-versatile';

UPDATE "ai_settings"
  SET "visionModel" = 'qwen/qwen3.8-27b'
  WHERE "visionModel" = 'llama-3.2-90b-vision-preview';
