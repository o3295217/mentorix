import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiErrors } from '@/lib/api-utils'
import { applyDailyScheduleProposal } from '@/lib/daily-schedule-apply'
import { DailyScheduleSchema, computeDailyScheduleLoadSummary, hashDailySchedule } from '@/lib/daily-schedule'
import { isValidDateOnly } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const ApplyProposalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'Invalid calendar date'),
  messageId: z.number().int().positive(),
  confirmed: z.literal(true),
  replaceExisting: z.boolean().default(false),
  expectedCurrentScheduleHash: z.string().length(64).nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const validation = ApplyProposalSchema.safeParse(body)
    if (!validation.success) return ApiErrors.validationFailed(validation.error.format())

    const { date, messageId, replaceExisting, expectedCurrentScheduleHash } = validation.data
    const result = await applyDailyScheduleProposal({ userId, date, messageId, replaceExisting, expectedCurrentScheduleHash })

    if (result.status === 404) return ApiErrors.notFound('Schedule proposal')
    if (result.status === 400) return ApiErrors.badRequest(result.error)
    if (result.status === 409) return NextResponse.json({ error: result.error ?? 'Schedule conflict', currentHash: result.currentHash }, { status: 409 })

    const scheduleValidation = DailyScheduleSchema.safeParse(result.schedule)
    const responseSchedule = scheduleValidation.success ? scheduleValidation.data : result.schedule
    return NextResponse.json({
      schedule: responseSchedule,
      updatedAt: result.updatedAt.toISOString(),
      status: result.applyStatus,
      hash: scheduleValidation.success ? hashDailySchedule(scheduleValidation.data) : null,
      loadSummary: scheduleValidation.success ? computeDailyScheduleLoadSummary(scheduleValidation.data) : null,
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') return NextResponse.json({ error: (error as Error).message || 'Unauthorized' }, { status: statusCode })
    return ApiErrors.serverError('Failed to apply schedule proposal', error)
  }
}
