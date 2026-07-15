-- CreateTable
CREATE TABLE "daily_schedules" (
    "id" SERIAL NOT NULL,
    "dailyEntryId" INTEGER NOT NULL,
    "scheduleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_schedules_dailyEntryId_key" ON "daily_schedules"("dailyEntryId");

-- AddForeignKey
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "daily_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
