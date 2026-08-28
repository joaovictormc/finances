-- Troca spinPrizes de Int[] pra Json ({ label, points }[]) — dados de teste, sem
-- necessidade de preservar os valores antigos (só pontos, sem rótulo).
ALTER TABLE "gamification_settings" DROP COLUMN "spinPrizes";
ALTER TABLE "gamification_settings" ADD COLUMN "spinPrizes" JSONB NOT NULL DEFAULT '[{"label":"10 pontos","points":10},{"label":"20 pontos","points":20},{"label":"30 pontos","points":30},{"label":"50 pontos","points":50},{"label":"100 pontos","points":100}]';
