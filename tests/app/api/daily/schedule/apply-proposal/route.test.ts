import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProposalMetadata, proposalToDailyScheduleV2, proposalToDailyScheduleV3, type DailyScheduleProposal, type DailyScheduleProposalV2 } from '@/lib/daily-schedule-proposal'
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

const proposalV2: DailyScheduleProposalV2 = {
  version: 2,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 570,
  dayEndMinutes: 1290,
  planningBasis: 'current_time',
  planningStartMinutes: 570,
  workEndMinutes: 1080,
  activityEndMinutes: 1290,
  blocks: [
    { kind: 'task', taskIndex: 1, taskText: 'Deep work', category: 'main', isFixed: false, startMinutes: 600, durationMinutes: 45 },
    { kind: 'buffer', title: 'Personal', category: 'personal', isFixed: true, startMinutes: 1080, durationMinutes: 120 },
  ],
}

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
  it('rejects missing expectedCurrentScheduleHash', async () => {
    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('creates schedule from stored proposal with numeric messageId', async () => {
    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('created')
    expect(body.planTasks).toEqual(['Deep work'])
    expect(mocks.chatMessageFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 12, userId: 'user-1' }) }))
    expect(mocks.queryRaw).toHaveBeenCalledOnce()
  })

  it.each([
    ['string', '12'],
    ['boolean', true],
    ['array', [12]],
    ['local id', 'local-12'],
    ['zero', 0],
  ])('rejects %s messageId', async (_caseName, messageId) => {
    const response = await POST(request({ date: '2026-02-28', messageId, confirmed: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('applies proposal metadata v2 as schedule v3 and returns persisted summary/hash', async () => {
    const metadataV2 = createProposalMetadata({ date: '2026-02-28', proposal: proposalV2, currentScheduleHash: null, currentScheduleExists: false, createdAt: new Date('2026-02-28T10:00:00.000Z') })
    const scheduleV3 = proposalToDailyScheduleV3(proposalV2)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: metadataV2 })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: null })
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: scheduleV3, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.schedule.version).toBe(3)
    expect(body.hash).toBe(hashDailySchedule(scheduleV3))
    expect(body.loadSummary).toMatchObject({ scheduledMinutes: 165, scheduledPercent: 22.92 })
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { dailyEntryId: 42, scheduleJson: scheduleV3 },
      update: { scheduleJson: scheduleV3 },
    }))
  })

  it('rejects null expected hash when a current schedule exists', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T10:30:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(schedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns conflict for stale expected hash even when replaceExisting is true', async () => {
    const currentSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 120 }] }
    const staleSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 45 }] }
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: currentSchedule, updatedAt: new Date('2026-02-28T10:30:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: hashDailySchedule(staleSchedule) }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(currentSchedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns conflict for not-applied proposal when current schedule changed after proposal base', async () => {
    const baseSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 45 }] }
    const currentSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 120 }] }
    const baseHash = hashDailySchedule(baseSchedule)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, currentScheduleHash: baseHash, currentScheduleExists: true } })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: currentSchedule, updatedAt: new Date('2026-02-28T10:30:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: baseHash }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(currentSchedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('replaces current schedule when expected hash matches', async () => {
    const currentHash = hashDailySchedule(schedule)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, currentScheduleHash: currentHash, currentScheduleExists: true } })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T10:30:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: currentHash }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('replaced')
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledOnce()
  })

  it('rejects wrong expected base hash before already_applied idempotency check', async () => {
    const baseSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 45 }] }
    const baseHash = hashDailySchedule(baseSchedule)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, currentScheduleHash: baseHash, currentScheduleExists: true, appliedAt: '2026-02-28T11:00:00.000Z' } })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(schedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('keeps already_applied idempotency with original proposal base hash', async () => {
    const baseSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 45 }] }
    const baseHash = hashDailySchedule(baseSchedule)
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, currentScheduleHash: baseHash, currentScheduleExists: true, appliedAt: '2026-02-28T11:00:00.000Z' } })
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: schedule, updatedAt: new Date('2026-02-28T11:00:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: baseHash }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('already_applied')
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
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

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentScheduleHash: null }))

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

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('already_applied')
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns conflict when an applied proposal schedule was changed afterwards', async () => {
    mocks.chatMessageFindFirst.mockResolvedValue({ id: 12, metadataJson: { ...metadata, appliedAt: '2026-02-28T11:00:00.000Z' } })
    const changedSchedule = { ...schedule, blocks: [{ ...schedule.blocks[0], durationMinutes: 120 }] }
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: changedSchedule, updatedAt: new Date('2026-02-28T12:00:00.000Z') } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.currentHash).toBe(hashDailySchedule(changedSchedule))
    expect(mocks.dailyScheduleUpsert).not.toHaveBeenCalled()
  })

  it('returns controlled conflict for invalid stored schedule', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue({ id: 42, planText: 'Deep work', schedule: { scheduleJson: { version: 999 }, updatedAt: new Date() } })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, replaceExisting: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Stored schedule is invalid')
  })

  it('rolls back transaction path on invalid persisted payload after upsert', async () => {
    let transactionRejected = false
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      try {
        return await fn({
          $queryRaw: mocks.queryRaw,
          chatMessage: { findFirst: mocks.chatMessageFindFirst, update: mocks.chatMessageUpdate },
          dailyEntry: { findFirst: mocks.dailyEntryFindFirst },
          dailySchedule: { upsert: mocks.dailyScheduleUpsert },
        })
      } catch (error) {
        transactionRejected = true
        throw error
      }
    })
    mocks.dailyScheduleUpsert.mockResolvedValue({ scheduleJson: { version: 999 }, updatedAt: new Date('2026-02-28T11:00:00.000Z') })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentScheduleHash: null }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('Persisted schedule is invalid')
    expect(transactionRejected).toBe(true)
    expect(mocks.dailyScheduleUpsert).toHaveBeenCalledOnce()
    expect(mocks.chatMessageUpdate).not.toHaveBeenCalled()
  })
})
