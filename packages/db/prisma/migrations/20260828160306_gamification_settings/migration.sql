-- CreateTable
CREATE TABLE "gamification_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "spinPrizes" INTEGER[] DEFAULT ARRAY[10, 20, 30, 50, 100]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamification_settings_pkey" PRIMARY KEY ("id")
);
