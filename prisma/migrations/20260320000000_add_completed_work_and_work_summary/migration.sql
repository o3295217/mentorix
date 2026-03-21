-- CreateTable
CREATE TABLE "completed_work" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "goalLink" TEXT,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completed_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_summaries" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "keyAchievements" TEXT NOT NULL DEFAULT '[]',
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "goalsCompleted" INTEGER NOT NULL DEFAULT 0,
    "topCategoriesJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "completed_work_userId_date_idx" ON "completed_work"("userId", "date");

-- CreateIndex
CREATE INDEX "completed_work_userId_type_idx" ON "completed_work"("userId", "type");

-- CreateIndex
CREATE INDEX "completed_work_userId_goalLink_idx" ON "completed_work"("userId", "goalLink");

-- CreateIndex
CREATE UNIQUE INDEX "work_summaries_userId_periodType_periodKey_key" ON "work_summaries"("userId", "periodType", "periodKey");

-- CreateIndex
CREATE INDEX "work_summaries_userId_periodType_idx" ON "work_summaries"("userId", "periodType");

-- AddForeignKey
ALTER TABLE "completed_work" ADD CONSTRAINT "completed_work_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_summaries" ADD CONSTRAINT "work_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
