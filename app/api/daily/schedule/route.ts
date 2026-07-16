import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ApiErrors } from '@/lib/api-utils'
import { DailySchedule, DailyScheduleResponse, DailyScheduleSchema, hashDailySchedule } from '@/lib/daily-schedule'
import { lockDailyEntryForScheduleMutation } from '@/lib/daily-schedule-lock'
import { isValidDateOnly, parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidDateOnly, 'Invalid calendar date')
const GetScheduleSchema = z.object({ date: DateSchema })
const PutScheduleSchema = z.object({
  date: DateSchema,
  schedule: DailyScheduleSchema,
})

function emptyScheduleResponse(): DailyScheduleResponse {
  return { schedule: null, updatedAt: null }
}

function toScheduleResponse(schedule: DailySchedule, updatedAt: Date): DailyScheduleResponse {
  return {
    schedule,
    updatedAt: updatedAt.toISOString(),
    hash: hashDailySchedule(schedule),
  }
}

function parseStoredSchedule(scheduleJson: Prisma.JsonValue): DailySchedule | null {
  const validation = DailyScheduleSchema.safeParse(scheduleJson)
  if (!validation.success) {
    console.error('[Daily Schedule] Stored scheduleJson validation failed:', validation.error.format())
    return null
  }

  return validation.data
}

function authErrorResponse(error: unknown): NextResponse | null {
  const statusCode = (error as { statusCode?: number })?.statusCode
  if (typeof statusCode !== 'number') return null
  return NextResponse.json({ error: (error as Error)?.message || 'Unauthorized' }, { status: statusCode })
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const validation = GetScheduleSchema.safeParse({ date: request.nextUrl.searchParams.get('date') })
    if (!validation.success) {
      return ApiErrors.validationFailed(validation.error.format())
    }

    const entry = await prisma.dailyEntry.findFirst({
      where: { userId, date: parseDateParam(validation.data.date) },
      select: { schedule: { select: { scheduleJson: true, updatedAt: true } } },
    })

    if (!entry?.schedule) {
      return NextResponse.json(emptyScheduleResponse())
    }

    const schedule = parseStoredSchedule(entry.schedule.scheduleJson)
    if (!schedule) {
      return ApiErrors.serverError('Failed to fetch daily schedule')
    }

    return NextResponse.json(toScheduleResponse(schedule, entry.schedule.updatedAt))
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    return ApiErrors.serverError('Failed to fetch daily schedule', error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body = await request.json()
    const validation = PutScheduleSchema.safeParse(body)
    if (!validation.success) {
      return ApiErrors.validationFailed(validation.error.format())
    }

    const schedule = await prisma.$transaction(async tx => {
      const entry = await tx.dailyEntry.findFirst({
        where: { userId, date: parseDateParam(validation.data.date) },
        select: { id: true },
      })

      if (!entry) return null

      await lockDailyEntryForScheduleMutation(tx, entry.id)

      return tx.dailySchedule.upsert({
        where: { dailyEntryId: entry.id },
        create: {
          dailyEntryId: entry.id,
          scheduleJson: validation.data.schedule as unknown as Prisma.InputJsonValue,
        },
        update: {
          scheduleJson: validation.data.schedule as unknown as Prisma.InputJsonValue,
        },
        select: { scheduleJson: true, updatedAt: true },
      })
    })

    if (!schedule) return ApiErrors.notFound('Daily entry')

    return NextResponse.json(toScheduleResponse(validation.data.schedule, schedule.updatedAt))
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    return ApiErrors.serverError('Failed to save daily schedule', error)
  }
}
