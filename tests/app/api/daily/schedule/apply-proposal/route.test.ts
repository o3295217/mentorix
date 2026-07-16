import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProposalMetadata, proposalToDailyScheduleV2, type DailyScheduleProposal } from '@/lib/daily-schedule-proposal'
import { hashDailySchedule } from '@/lib/daily-schedule'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  chatMessageFindFirst: vi.fn(),
  chatMessageUpdate: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  dailyScheduleUpsert: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    chatMessage: { findFirst: mocks.chatMessageFindFirst, update: mocks.chatMessageUpdate },
    dailyEntry: { findFirst: mocks.dailyEntryFindFirst },
    dailySchedule: { upsert: mocks.dailyScheduleUpsert },
  },
}))

import { POST } from '@/app/api/daily/schedule/apply-proposal/route'

const proposal: DailyScheduleProposal = {
  version: 1,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 480,
  dayEndMinutes: 1080,
  blocks: [{ kind: 'task', taskIndex: 1, taskText: 'Deep work', startMinutes: 540, durationMinutes: 60 }],
}
const schedule = proposalToDailyScheduleV2(proposal)
const metadata = createProposalMetadata({ date: '2026-02-28', proposal, currentScheduleHash: null, currentScheduleExists: false, createdAt: new Date('2026-02-28T10:00:00.000Z') })

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/daily/schedule/apply-proposal', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
    $queryRaw: mocks.queryRaw,
    chatMessage: { findFirst: mocks.chatMessageFindFirst, update: mocks.chatMessageUpdate },
    dailyEntry: { findFirst: mocks.dailyEntryFindFirst },
    dailySchedule: { upsert: mocks.dailyScheduleUpsert },
  }))
  mocks.queryRaw.mockResolvedValue([])
  mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadata })
  mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: null })
  mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/daily/schedule/apply-proposal', () => {
  it('coerces string messageId and creates schedule from stored proposal', async () => {
    const response = await POST(request({ date: '2026-02-28', messageId: '12', confirmed: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('created')
    expect(mocks.chatMessageFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 12, userId: 'user-1' }) }))
    expect(mocks.queryRaw).toHaveBeenCalledOnce()
  })

  it('locks DailyEntry before re-reading schedule and applying proposal', async () => {
    const calls: string[] = []
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      $queryRaw: vi.fn(() => {
        calls.push('lock')
        return Promise.resolve([])
      }),
      chatMessage: {
        findFirst: vi.fn(() => {
          calls.push('message')
          return Promise.resolve({ id: 12, metadataJson: metadata })
        }),
        update: vi.fn(() => {
          calls.push('metadata')
          return Promise.resolve({})
        }),
      },
      dailyEntry: {
        findFirst: vi.fn(() => {
          calls.push('entry')
          return Promise.resolve({ id: 42, planText: 'Deep work', schedule: null })
        }),
      },
      dailySchedule: {
        upsert: vi.fn(() => {
          calls.push('upsert')
          return Promise.resolve({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })
        }),
      },
    }))

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true }))

    expect(response.status).toBe(200)
    expect(calls).toEqual(['entry', 'lock', 'message', 'entry', 'upsert', 'metadata'])
  })

  it('uses fresh metadata read after DailyEntry lock for concurrent double apply idempotency', async () => {
    const appliedMetadata = { ...metadata, appliedAt: '2026-02-28T11:00:00.000Z' }
    const calls: string[] = []
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
      $queryRaw: vi.fn(() => {
        calls.push('lock')
        return Promise.resolve([])
      }),
      chatMessage: {
        findFirst: vi.fn(() => {
          calls.push('message:fresh-applied')
          return Promise.resolve({ id: 12, metadataJson: appliedMetadata })
        }),
        update: vi.fn(() => {
          calls.push('metadata')
          return Promise.resolve({})
        }),
      },
      dailyEntry: {
        findFirst: vi.fn()
          .mockImplementationOnce(() => {
            calls.push('entry:identity')
            return Promise.resolve({ id: 42 })
          })
          .mockImplementationOnce(() => {
            calls.push('entry:with-schedule')
            return Promise.resolve({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') } })
          }),
      },
      dailySchedule: {
        upsert: vi.fn(() => {
          calls.push('upsert')
          return Promise.resolve({ scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') })
        }),
      },
    }))

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('already_applied')
    expect(calls).toEqual(['entry:identity', 'lock', 'message:fresh-applied', 'entry:with-schedule'])
  })

  it('returns already_applied on double click even when replaceExisting is true', async () => {
    const appliedMetadata = { ...metadata, appliedAt: '2026-02-28T11:00:00.000Z' }
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: appliedMetadata })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('already_applied')
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns conflict when an applied proposal schedule was changed afterwards', async () => {
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, appliedAt: '2026-02-28T11:00:00.000Z' } })
    const changedSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 120 }] }
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: changedSchedule, updatedAt: new Date('2026-02-28T12:00:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(changedSchedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns controlled conflict for invalid stored schedule', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: { version: 999 }, updatedAt: new Date() } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Stored schedule is invalid')
  })
})
