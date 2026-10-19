-- Rascunhos de Novidades gerados a partir dos commits.

-- AlterTable
ALTER TABLE "changelog_releases" ADD COLUMN     "commits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "changelog_automation" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCommitSha" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelog_automation_pkey" PRIMARY KEY ("id")
);
