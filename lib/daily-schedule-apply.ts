import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DailyScheduleSchema, hashDailySchedule } from '@/lib/daily-schedule'
import { proposalToDailyScheduleV2, safeParseProposalMetadata, validateProposalAgainstCurrentPlan } from '@/lib/daily-schedule-proposal'
import { lockDailyEntryForScheduleMutation } from '@/lib/daily-schedule-lock'
import { parseDateParam } from '@/lib/dates'

export type ApplyScheduleProposalResult =
  | { status: 200; schedule: unknown; updatedAt: Date; applyStatus: 'created' | 'replaced' | 'already_applied'; proposalMessageId: number }
  | { status: 400; error: string }
  | { status: 404 }
  | { status: 409; currentHash: string | null; error?: string }

function splitPlanTasks(planText: string | null): string[] {
  return (planText ?? '').split('\n').map(line => line.trim()).filter(Boolean)
}

export async function applyDailyScheduleProposal(input: {
  userId: string
  date: string
  messageId: number
  replaceExisting: boolean
  expectedCurrentScheduleHash?: string | null
}): Promise<ApplyScheduleProposalResult> {
  return prisma.$transaction(async tx => {
    const entryIdentity = await tx.dailyEntry.findFirst({ where: { userId: input.userId, date: parseDateParam(input.date) }, select: { id: true } })
    if (!entryIdentity) return { status: 404 as const }
    await lockDailyEntryForScheduleMutation(tx, entryIdentity.id)

    const message = await tx.chatMessage.findFirst({ where: { id: input.messageId, userId: input.userId, date: input.date, role: 'assistant' }, select: { id: true, metadataJson: true } })
    if (!message) return { status: 404 as const }

    const metadata = safeParseProposalMetadata(message.metadataJson)
    if (!metadata || metadata.date !== input.date) return { status: 400 as const, error: 'Valid schedule proposal metadata not found' }

    const entry = await tx.dailyEntry.findFirst({ where: { id: entryIdentity.id, userId: input.userId, date: parseDateParam(input.date) }, select: { id: true, planText: true, schedule: { select: { scheduleJson: true, updatedAt: true } } } })
    if (!entry) return { status: 404 as const }

    const proposalSchedule = proposalToDailyScheduleV2(metadata.proposal)
    const proposalHash = hashDailySchedule(proposalSchedule)
    const storedScheduleValidation = entry.schedule ? DailyScheduleSchema.safeParse(entry.schedule.scheduleJson) : null
    if (entry.schedule && !storedScheduleValidation?.success) return { status: 409 as const, currentHash: null, error: 'Stored schedule is invalid' }
    const currentHash = storedScheduleValidation?.success ? hashDailySchedule(storedScheduleValidation.data) : null

    if (metadata.appliedAt) {
      if (currentHash === proposalHash) return { status: 200 as const, schedule: proposalSchedule, updatedAt: entry.schedule?.updatedAt ?? new Date(), applyStatus: 'already_applied' as const, proposalMessageId: message.id }
      return { status: 409 as const, currentHash, error: 'Schedule changed after proposal was applied' }
    }
    if (input.expectedCurrentScheduleHash !== undefined && input.expectedCurrentScheduleHash !== currentHash) return { status: 409 as const, currentHash }
    if (!input.replaceExisting && entry.schedule) return { status: 409 as const, currentHash }

    const proposalValidation = validateProposalAgainstCurrentPlan(metadata.proposal, { date: input.date, timezone: metadata.proposal.timezone, planTasks: splitPlanTasks(entry.planText) })
    if (!proposalValidation.success) return { status: 400 as const, error: proposalValidation.error }

    const stored = await tx.dailySchedule.upsert({
      where: { dailyEntryId: entry.id },
      create: { dailyEntryId: entry.id, scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
      update: { scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
      select: { scheduleJson: true, updatedAt: true },
    })
    await tx.chatMessage.update({ where: { id: message.id }, data: { metadataJson: { ...metadata, appliedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue } })
    return { status: 200 as const, schedule: stored.scheduleJson, updatedAt: stored.updatedAt, applyStatus: entry.schedule ? 'replaced' as const : 'created' as const, proposalMessageId: message.id }
  })
}
