-- Replace index with unique constraint on period_goals
DROP INDEX IF EXISTS "period_goals_userId_periodType_periodStart_idx";
CREATE UNIQUE INDEX "period_goals_userId_periodType_periodStart_key" ON "period_goals"("userId", "periodType", "periodStart");
