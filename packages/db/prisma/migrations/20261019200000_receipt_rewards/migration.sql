-- Área de recompensa por cupom fiscal: termo próprio com aceite registrado e cupons enviados.

-- AlterTable
ALTER TABLE "gamification_settings" ADD COLUMN     "receiptDailyLimit" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "receiptMaxAgeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "receiptRewardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiptRewardPoints" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "receiptWeeklyLimit" INTEGER NOT NULL DEFAULT 6;

-- CreateTable
CREATE TABLE "receipt_reward_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "receipt_reward_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_receipts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "issuerCnpj" TEXT NOT NULL,
    "issuedMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_reward_consents_userId_idx" ON "receipt_reward_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_receipts_accessKey_key" ON "reward_receipts"("accessKey");

-- CreateIndex
CREATE INDEX "reward_receipts_userId_createdAt_idx" ON "reward_receipts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "receipt_reward_consents" ADD CONSTRAINT "receipt_reward_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_receipts" ADD CONSTRAINT "reward_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

