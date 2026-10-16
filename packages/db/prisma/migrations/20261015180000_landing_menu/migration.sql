-- Menu editável da landing (configuração de linha única).

-- CreateTable
CREATE TABLE "landing_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "menu" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_settings_pkey" PRIMARY KEY ("id")
);

