CREATE TABLE "gamification_spin_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prizeLabel" TEXT NOT NULL,
    "prizePoints" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gamification_spin_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gamification_spin_logs_userId_idx" ON "gamification_spin_logs"("userId");

CREATE INDEX "gamification_spin_logs_createdAt_idx" ON "gamification_spin_logs"("createdAt");

ALTER TABLE "gamification_spin_logs" ADD CONSTRAINT "gamification_spin_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
