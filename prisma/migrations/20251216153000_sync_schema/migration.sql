-- AlterTable
ALTER TABLE "user_profile" ADD COLUMN "customInterests" TEXT;

-- CreateTable
CREATE TABLE "year_goals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "goalsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "goals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "deadline" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "blockedByJson" TEXT NOT NULL DEFAULT '[]',
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "goal_tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "profile_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "blockId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profile_categories_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "profile_blocks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "period_evaluations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dreamProgressScore" REAL NOT NULL,
    "overallScore" REAL NOT NULL,
    "professionalBlock" TEXT NOT NULL,
    "personalBlock" TEXT NOT NULL,
    "socialBlock" TEXT NOT NULL,
    "balanceBlock" TEXT NOT NULL,
    "patterns" TEXT NOT NULL,
    "trends" TEXT NOT NULL,
    "goalsCompletion" TEXT NOT NULL,
    "alignment" TEXT NOT NULL,
    "blockers" TEXT,
    "feedbackText" TEXT NOT NULL,
    "recommendationsText" TEXT NOT NULL,
    "insights" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "world_context" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "marketEvents" TEXT,
    "personalEvents" TEXT,
    "constraints" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "habits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskText" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "daysOfWeek" TEXT,
    "interval" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalDone" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_insights" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patterns" TEXT,
    "strengths" TEXT,
    "challenges" TEXT,
    "preferences" TEXT,
    "recommendations" TEXT,
    "motivators" TEXT,
    "weeklySummary" TEXT,
    "evaluationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "planText" TEXT,
    "factText" TEXT,
    "planSnapshotJson" TEXT,
    "extraTasksJson" TEXT NOT NULL DEFAULT '[]',
    "emotionalState" TEXT,
    "physicalState" TEXT,
    "lifeEvents" TEXT,
    "externalFactors" TEXT,
    "energyLevel" INTEGER,
    "sleepQuality" INTEGER,
    "familyTime" INTEGER,
    "exerciseTime" INTEGER,
    "selectedTasksJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_daily_entries" ("createdAt", "date", "factText", "id", "planText", "updatedAt") SELECT "createdAt", "date", "factText", "id", "planText", "updatedAt" FROM "daily_entries";
DROP TABLE "daily_entries";
ALTER TABLE "new_daily_entries" RENAME TO "daily_entries";
CREATE UNIQUE INDEX "daily_entries_date_key" ON "daily_entries"("date");
CREATE TABLE "new_dream_goal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "goalText" TEXT NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_dream_goal" ("createdAt", "goalText", "id", "updatedAt") SELECT "createdAt", "goalText", "id", "updatedAt" FROM "dream_goal";
DROP TABLE "dream_goal";
ALTER TABLE "new_dream_goal" RENAME TO "dream_goal";
CREATE TABLE "new_evaluations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dailyEntryId" INTEGER NOT NULL,
    "dreamProgressScore" INTEGER NOT NULL DEFAULT 5,
    "strategyScore" INTEGER NOT NULL,
    "operationsScore" INTEGER NOT NULL,
    "teamScore" INTEGER NOT NULL,
    "efficiencyScore" INTEGER NOT NULL,
    "overallScore" REAL NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "planVsFactText" TEXT NOT NULL,
    "alignmentDayWeek" TEXT NOT NULL,
    "alignmentWeekMonth" TEXT NOT NULL,
    "alignmentMonthQuarter" TEXT NOT NULL,
    "alignmentQuarterHalf" TEXT NOT NULL,
    "alignmentHalfYear" TEXT NOT NULL,
    "alignmentYearDream" TEXT NOT NULL,
    "healthFlag" TEXT,
    "familyFlag" TEXT,
    "energyFlag" TEXT,
    "workHealthAlignment" TEXT,
    "workFamilyAlignment" TEXT,
    "workValuesAlignment" TEXT,
    "recommendationsText" TEXT NOT NULL,
    "suggestedTasksJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluations_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "daily_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_evaluations" ("alignmentDayWeek", "alignmentHalfYear", "alignmentMonthQuarter", "alignmentQuarterHalf", "alignmentWeekMonth", "alignmentYearDream", "createdAt", "dailyEntryId", "efficiencyScore", "feedbackText", "id", "operationsScore", "overallScore", "planVsFactText", "recommendationsText", "strategyScore", "teamScore") SELECT "alignmentDayWeek", "alignmentHalfYear", "alignmentMonthQuarter", "alignmentQuarterHalf", "alignmentWeekMonth", "alignmentYearDream", "createdAt", "dailyEntryId", "efficiencyScore", "feedbackText", "id", "operationsScore", "overallScore", "planVsFactText", "recommendationsText", "strategyScore", "teamScore" FROM "evaluations";
DROP TABLE "evaluations";
ALTER TABLE "new_evaluations" RENAME TO "evaluations";
CREATE UNIQUE INDEX "evaluations_dailyEntryId_key" ON "evaluations"("dailyEntryId");
CREATE TABLE "new_profile_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "blockId" INTEGER,
    "categoryId" INTEGER,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profile_items_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "profile_blocks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "profile_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "profile_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_profile_items" ("blockId", "content", "createdAt", "id", "order", "updatedAt") SELECT "blockId", "content", "createdAt", "id", "order", "updatedAt" FROM "profile_items";
DROP TABLE "profile_items";
ALTER TABLE "new_profile_items" RENAME TO "profile_items";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "year_goals_year_key" ON "year_goals"("year");

-- CreateIndex
CREATE INDEX "goals_periodType_periodKey_idx" ON "goals"("periodType", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "goal_tags_name_key" ON "goal_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "world_context_date_key" ON "world_context"("date");

