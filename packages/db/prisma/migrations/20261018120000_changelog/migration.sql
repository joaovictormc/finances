-- Novidades do app (changelog) e controle da janela "O que há de novo".

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "changelogSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "changelog_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelog_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changelog_releases_publishedAt_idx" ON "changelog_releases"("publishedAt");
