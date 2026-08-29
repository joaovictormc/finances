ALTER TABLE "gamification_profiles"
  ADD COLUMN "unlockedBadges" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "activeBadge" TEXT;
