import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiErrors } from '@/lib/api-utils'
import { applyDailyTaskListProposal } from '@/lib/daily-schedule-apply'
import { hashDailyPlanTasks } from '@/lib/daily-schedule-proposal'
import { isValidDateOnly } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const ApplyTaskListProposalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'Invalid calendar date'),
  messageId: z.number().int().positive(),
  confirmed: z.literal(true),
  expectedCurrentPlanTasksHash: z.string().length(64),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const validation = ApplyTaskListProposalSchema.safeParse(body)
    if (!validation.success) return ApiErrors.validationFailed(validation.error.format())

    const { date, messageId, expectedCurrentPlanTasksHash } = validation.data
    const result = await applyDailyTaskListProposal({ userId, date, messageId, expectedCurrentPlanTasksHash })

    if (result.status === 404) return ApiErrors.notFound('Task list proposal')
    if (result.status === 400) return ApiErrors.badRequest(result.error)
    if (result.status === 409) return NextResponse.json({ error: result.error ?? 'Task list conflict', currentPlanTasksHash: result.currentPlanTasksHash }, { status: 409 })

    return NextResponse.json({
      status: result.applyStatus,
      updatedAt: result.updatedAt.toISOString(),
      planText: result.planText,
      planTasks: result.planTasks,
      hash: hashDailyPlanTasks(result.planTasks),
      proposalMessageId: result.proposalMessageId,
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    if (typeof statusCode === 'number') return NextResponse.json({ error: (error as Error).message || 'Unauthorized' }, { status: statusCode })
    return ApiErrors.serverError('Failed to apply task list proposal', error)
  }
}
