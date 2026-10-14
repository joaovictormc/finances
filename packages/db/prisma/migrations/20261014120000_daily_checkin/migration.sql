-- Check-in diario: sequencia propria no perfil e recompensa configuravel pelo admin.

-- AlterTable
ALTER TABLE "gamification_profiles" ADD COLUMN     "checkinStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastCheckinDate" DATE;

-- AlterTable
ALTER TABLE "gamification_settings" ADD COLUMN     "checkinEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "checkinRewardDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "checkinRewardPoints" INTEGER NOT NULL DEFAULT 50;

