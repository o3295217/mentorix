import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ApiErrors } from '@/lib/api-utils'
import { DailyScheduleSchema, hashDailySchedule } from '@/lib/daily-schedule'
import { proposalToDailyScheduleV2, safeParseProposalMetadata, validateProposalAgainstCurrentPlan } from '@/lib/daily-schedule-proposal'
import { isValidDateOnly, parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const ApplyProposalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'Invalid calendar date'),
  messageId: z.coerce.number().int().positive(),
  confirmed: z.literal(true),
  replaceExisting: z.boolean().default(false),
  expectedCurrentScheduleHash: z.string().length(64).nullable().optional(),
})

function splitPlanTasks(planText: string | null): string[] {
  return (planText ?? '').split('\n').map(line => line.trim()).filter(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const validation = ApplyProposalSchema.safeParse(body)
    if (!validation.success) return ApiErrors.validationFailed(validation.error.format())

    const { date, messageId, replaceExisting, expectedCurrentScheduleHash } = validation.data
    const result = await prisma.$transaction(async tx => {
      const message = await tx.chatMessage.findFirst({ where: { id: messageId, userId, date, role: 'assistant' }, select: { id: true, metadataJson: true } })
      if (!message) return { status: 404 as const }

      const metadata = safeParseProposalMetadata(message.metadataJson)
      if (!metadata || metadata.date !== date) return { status: 400 as const, error: 'Valid schedule proposal metadata not found' }

      const entry = await tx.dailyEntry.findFirst({ where: { userId, date: parseDateParam(date) }, select: { id: true, planText: true, schedule: { select: { scheduleJson: true, updatedAt: true } } } })
      if (!entry) return { status: 404 as const }

      const proposalSchedule = proposalToDailyScheduleV2(metadata.proposal)
      const proposalHash = hashDailySchedule(proposalSchedule)
      const storedScheduleValidation = entry.schedule ? DailyScheduleSchema.safeParse(entry.schedule.scheduleJson) : null
      if (entry.schedule && !storedScheduleValidation?.success) {
        return { status: 409 as const, currentHash: null, error: 'Stored schedule is invalid' }
      }
      const currentHash = storedScheduleValidation?.success ? hashDailySchedule(storedScheduleValidation.data) : null

      if (metadata.appliedAt) {
        if (currentHash === proposalHash) {
          return { status: 200 as const, schedule: proposalSchedule, updatedAt: entry.schedule?.updatedAt ?? new Date(), applyStatus: 'already_applied' as const }
        }
        return { status: 409 as const, currentHash, error: 'Schedule changed after proposal was applied' }
      }
      if (expectedCurrentScheduleHash !== undefined && expectedCurrentScheduleHash !== currentHash) return { status: 409 as const, currentHash }
      if (!replaceExisting && entry.schedule) return { status: 409 as const, currentHash }

      const planTasks = splitPlanTasks(entry.planText)
      const proposalValidation = validateProposalAgainstCurrentPlan(metadata.proposal, { date, timezone: metadata.proposal.timezone, planTasks })
      if (!proposalValidation.success) return { status: 400 as const, error: proposalValidation.error }

      const stored = await tx.dailySchedule.upsert({
        where: { dailyEntryId: entry.id },
        create: { dailyEntryId: entry.id, scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
        update: { scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
        select: { scheduleJson: true, updatedAt: true },
      })
      await tx.chatMessage.update({ where: { id: message.id }, data: { metadataJson: { ...metadata, appliedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue } })
      return { status: 200 as const, schedule: stored.scheduleJson, updatedAt: stored.updatedAt, applyStatus: entry.schedule ? 'replaced' as const : 'created' as const }
    })

    if (result.status === 404) return ApiErrors.notFound('Schedule proposal')
    if (result.status === 400) return ApiErrors.badRequest(result.error)
    if (result.status === 409) return NextResponse.json({ error: result.error ?? 'Schedule conflict', currentHash: result.currentHash }, { status: 409 })

    return NextResponse.json({ schedule: result.schedule, updatedAt: result.updatedAt.toISOString(), status: result.applyStatus })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') return NextResponse.json({ error: (error as Error).message || 'Unauthorized' }, { status: statusCode })
    return ApiErrors.serverError('Failed to apply schedule proposal', error)
  }
}
