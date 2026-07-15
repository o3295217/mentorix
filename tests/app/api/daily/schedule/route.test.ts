import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailySchedule } from '@/lib/daily-schedule'
import { parseDateParam } from '@/lib/dates'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  dailyScheduleUpsert: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({
  requireUserId: mocks.requireUserId,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyEntry: {
      findFirst: mocks.dailyEntryFindFirst,
    },
    dailySchedule: {
      upsert: mocks.dailyScheduleUpsert,
    },
  },
}))

import { GET, PUT } from '@/app/api/daily/schedule/route'

const validSchedule: DailySchedule = {
  version: 1,
  timezone: 'Europe/Moscow',
  dayStartMinutes: 8 * 60,
  dayEndMinutes: 18 * 60,
  blocks: [
    {
      id: 'block-1',
      taskIndex: 1,
      taskText: 'Deep work',
      startMinutes: 9 * 60,
      durationMinutes: 60,
    },
  ],
}

function getRequest(date: string): NextRequest {
  return new NextRequest(`http://localhost/api/daily/schedule?date=${date}`)
}

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/daily/schedule', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/daily/schedule', () => {
  it('rejects non-existent calendar dates in query', async () => {
    const response = await GET(getRequest('2026-02-31'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.dailyEntryFindFirst).not.toHaveBeenCalled()
  })

  it('returns not found for PUT when daily entry is absent or belongs to another user', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue(null)

    const response = await PUT(putRequest({ date: '2026-02-28', schedule: validSchedule }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Daily entry not found' })
    expect(mocks.dailyEntryFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', date: parseDateParam('2026-02-28') },
      select: { id: true },
    })
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('rejects invalid PUT body', async () => {
    const response = await PUT(putRequest({
      date: '2026-02-28',
      schedule: { ...validSchedule, dayEndMinutes: validSchedule.dayStartMinutes },
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.dailyEntryFindFirst).not.toHaveBeenCalled()
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('fails safely when persisted schedule JSON is invalid', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue({
      schedule: {
        scheduleJson: { ...validSchedule, version: 3 },
        updatedAt: new Date('2026-02-28T10:00:00.000Z'),
      },
    })

    const response = await GET(getRequest('2026-02-28'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: 'Failed to fetch daily schedule' })
  })

  it('returns persisted schedule for successful GET', async () => {
    const updatedAt = new Date('2026-02-28T10:00:00.000Z')
    mocks.dailyEntryFindFirst.mockResolvedValue({
      schedule: { scheduleJson: validSchedule, updatedAt },
    })

    const response = await GET(getRequest('2026-02-28'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ schedule: validSchedule, updatedAt: updatedAt.toISOString() })
    expect(body.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.dailyEntryFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', date: parseDateParam('2026-02-28') },
      select: { schedule: { select: { scheduleJson: true, updatedAt: true } } },
    })
  })

  it('saves valid schedule for successful PUT', async () => {
    const updatedAt = new Date('2026-02-28T11:00:00.000Z')
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42 })
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: validSchedule, updatedAt })

    const response = await PUT(putRequest({ date: '2026-02-28', schedule: validSchedule }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ schedule: validSchedule, updatedAt: updatedAt.toISOString() })
    expect(body.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledWith({
      where: { dailyEntryId: 42 },
      create: { dailyEntryId: 42, scheduleJson: validSchedule },
      update: { scheduleJson: validSchedule },
      select: { scheduleJson: true, updatedAt: true },
    })
  })
})
