-- Переименование категорий оценок: 4 старых → 4 новых
-- strategyScore → strategicFocusScore
-- operationsScore → productivityScore
-- teamScore → lifeBalanceScore
-- efficiencyScore → disciplineScore

ALTER TABLE "evaluations" RENAME COLUMN "strategyScore" TO "strategicFocusScore";
ALTER TABLE "evaluations" RENAME COLUMN "operationsScore" TO "productivityScore";
ALTER TABLE "evaluations" RENAME COLUMN "teamScore" TO "lifeBalanceScore";
ALTER TABLE "evaluations" RENAME COLUMN "efficiencyScore" TO "disciplineScore";
