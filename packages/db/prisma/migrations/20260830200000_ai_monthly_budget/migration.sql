-- Teto de gasto mensal em USD, usado como denominador do medidor de consumo
-- de IA em /admin/ai. NULL = sem orçamento definido (medidor mostra só o valor
-- gasto e a projeção). Não bloqueia chamadas: quem corta é o monthlyTokenLimit.
ALTER TABLE "ai_settings" ADD COLUMN "monthlyBudgetUsd" DOUBLE PRECISION;
