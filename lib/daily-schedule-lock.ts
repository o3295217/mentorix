import { Prisma } from '@prisma/client'

/**
 * Serializes all schedule mutations for one DailyEntry.
 *
 * DailySchedule may not exist yet, so locking the schedule row is not stable.
 * DailyEntry is the stable ownership/date parent; both manual PUT autosave and
 * proposal apply must take this row lock before reading/writing scheduleJson.
 */
export async function lockDailyEntryForScheduleMutation(
  tx: Prisma.TransactionClient,
  dailyEntryId: number,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "DailyEntry" WHERE id = ${dailyEntryId} FOR UPDATE`
}
