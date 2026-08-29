-- Só atualiza o default da coluna (novas linhas), não toca em dados existentes.
-- O código já normaliza entradas sem "weight" pra weight:1 na leitura.
ALTER TABLE "gamification_settings"
  ALTER COLUMN "spinPrizes" SET DEFAULT '[{"label":"10 pontos","points":10,"weight":1},{"label":"20 pontos","points":20,"weight":1},{"label":"30 pontos","points":30,"weight":1},{"label":"50 pontos","points":50,"weight":1},{"label":"100 pontos","points":100,"weight":1}]';
