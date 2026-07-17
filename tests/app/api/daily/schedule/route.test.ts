import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailySchedule } from '@/lib/daily-schedule'
import { parseDateParam } from '@/lib/dates'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  dailyScheduleUpsert: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({
  requireUserId: mocks.requireUserId,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
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

const validScheduleV3: DailySchedule = {
  version: 3,
  timezone: 'Europe/Moscow',
  dayStartMinutes: 9 * 60 + 30,
  dayEndMinutes: 21 * 60 + 30,
  planningBasis: 'current_time',
  planningStartMinutes: 9 * 60 + 30,
  workEndMinutes: 18 * 60,
  activityEndMinutes: 21 * 60 + 30,
  blocks: [
    { id: 'main-1', kind: 'task', taskIndex: 1, taskText: 'Deep work 1', category: 'main', isFixed: false, startMinutes: 10 * 60, durationMinutes: 45 },
    { id: 'main-2', kind: 'task', taskIndex: 2, taskText: 'Deep work 2', category: 'main', isFixed: false, startMinutes: 11 * 60, durationMinutes: 90 },
    { id: 'personal-1', kind: 'buffer', title: 'Personal', category: 'personal', isFixed: true, startMinutes: 18 * 60, durationMinutes: 120 },
    { id: 'travel-1', kind: 'buffer', title: 'Travel', category: 'travel', isFixed: true, startMinutes: 20 * 60, durationMinutes: 90 },
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
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
    $queryRaw: mocks.queryRaw,
    dailyEntry: { findFirst: mocks.dailyEntryFindFirst },
    dailySchedule: { upsert: mocks.dailyScheduleUpsert },
  }))
  mocks.queryRaw.mockResolvedValue([])
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
    expect(mocks.queryRaw).not.toHaveBeenCalled()
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
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.queryRaw).toHaveBeenCalledOnce()
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledWith({
      where: { dailyEntryId: 42 },
      create: { dailyEntryId: 42, scheduleJson: validSchedule },
      update: { scheduleJson: validSchedule },
      select: { scheduleJson: true, updatedAt: true },
    })
  })

  it('saves valid v3 schedule and returns persisted schedule with server load summary', async () => {
    const updatedAt = new Date('2026-02-28T11:00:00.000Z')
    const persisted = { ...validScheduleV3, blocks: [...validScheduleV3.blocks].reverse() }
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42 })
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: persisted, updatedAt })

    const response = await PUT(putRequest({ date: '2026-02-28', schedule: validScheduleV3 }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.schedule).toEqual(persisted)
    expect(body.loadSummary).toMatchObject({ scheduledMinutes: 345, scheduledPercent: 47.92, workScheduledMinutes: 135 })
    expect(body.hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects invalid v3 schedule in PUT body', async () => {
    const response = await PUT(putRequest({ date: '2026-02-28', schedule: { ...validScheduleV3, planningStartMinutes: 571 } }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('takes the DailyEntry row lock before manual schedule upsert', async () => {
    const calls: string[] = []
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      $queryRaw: vi.fn(() => {
        calls.push('lock')
        return Promise.resolve([])
      }),
      dailyEntry: {
        findFirst: vi.fn(() => {
          calls.push('entry')
          return Promise.resolve({ id: 42 })
        }),
      },
      dailySchedule: {
        upsert: vi.fn(() => {
          calls.push('upsert')
          return Promise.resolve({ scheduleJson: validSchedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })
        }),
      },
    }))

    const response = await PUT(putRequest({ date: '2026-02-28', schedule: validSchedule }))

    expect(response.status).toBe(200)
    expect(calls).toEqual(['entry', 'lock', 'upsert'])
  })
})
