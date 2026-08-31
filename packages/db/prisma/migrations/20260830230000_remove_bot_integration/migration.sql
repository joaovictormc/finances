-- Remove a integração de bot (Telegram/WhatsApp), substituída pelo assistente de
-- IA interno. Migração destrutiva e intencional: o histórico de conversas do bot
-- não tem uso no produto novo.
--
-- Preservados de propósito:
--   * transactions.source — linhas antigas com 'telegram' continuam válidas;
--     é só a origem histórica do lançamento.
--   * notifications.channel — mesma lógica para notificações já enviadas.
--   * ai_usage_logs.feature — mantém 'expense_parsing' e 'voice_transcription'
--     para o medidor de consumo em /admin/ai continuar somando o histórico.

DROP TABLE IF EXISTS "bot_messages";
DROP TABLE IF EXISTS "bot_conversations";

ALTER TABLE "user_profiles"
  DROP COLUMN IF EXISTS "telegramChatId",
  DROP COLUMN IF EXISTS "whatsappPhone",
  DROP COLUMN IF EXISTS "notifyTelegram",
  DROP COLUMN IF EXISTS "notifyWhatsapp";

ALTER TABLE "ai_settings"
  DROP COLUMN IF EXISTS "audioModel",
  DROP COLUMN IF EXISTS "expenseParsingEnabled";
