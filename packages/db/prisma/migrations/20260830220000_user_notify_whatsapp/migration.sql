-- Preferência de notificação por WhatsApp, espelhando notifyTelegram.
-- Default true: quem vincular o número já passa a receber, igual ao Telegram.
ALTER TABLE "user_profiles" ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true;
