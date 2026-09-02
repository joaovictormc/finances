-- O que cada giro entregou. Sem isso um prêmio de dias de plano fica no
-- histórico como 0 pontos, sem registro do que foi concedido.
ALTER TABLE "gamification_spin_logs" ADD COLUMN "prizeType" TEXT NOT NULL DEFAULT 'points';
ALTER TABLE "gamification_spin_logs" ADD COLUMN "prizeDays" INTEGER NOT NULL DEFAULT 0;
