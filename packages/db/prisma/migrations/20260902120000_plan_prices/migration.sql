-- Preço por plano e período, editável no admin. Antes ficava fixo em código
-- (apps/api/src/lib/plans.ts) e qualquer reajuste exigia deploy.
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_prices_plan_interval_key" ON "plan_prices"("plan", "interval");

-- Período de cobrança da assinatura. 'monthly' é o que todo checkout criava até
-- aqui, então o default mantém as assinaturas existentes corretas.
ALTER TABLE "subscriptions" ADD COLUMN "interval" TEXT NOT NULL DEFAULT 'monthly';
