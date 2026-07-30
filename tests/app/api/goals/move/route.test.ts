import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  goalFindFirst: vi.fn(),
  goalUpdate: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    goal: { findFirst: mocks.goalFindFirst, update: mocks.goalUpdate },
  },
}))

import { POST } from '@/app/api/goals/move/route'

const goal = {
  id: 7,
  userId: 'user-1',
  text: 'Move me',
  periodType: 'week',
  periodKey: '2026-W31',
  priority: 'none',
  tagsJson: ['focus'],
  blockedByJson: [],
  historyJson: [{ type: 'created', date: '2026-07-30T10:00:00.000Z' }],
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/goals/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.goalFindFirst.mockResolvedValue(goal)
  mocks.goalUpdate.mockResolvedValue({ ...goal, periodType: 'month', periodKey: '2026-07' })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/goals/move', () => {
  it('rejects invalid body with validation details', async () => {
    const response = await POST(request({ id: 7, toPeriodType: 'decade', toPeriodKey: '2026' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
    expect(mocks.goalFindFirst).not.toHaveBeenCalled()
    expect(mocks.goalUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when goal belongs to another user or is absent', async () => {
    mocks.goalFindFirst.mockResolvedValue(null)

    const response = await POST(request({ id: 7, toPeriodType: 'month', toPeriodKey: '2026-07' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Goal not found' })
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'user-1' } })
    expect(mocks.goalUpdate).not.toHaveBeenCalled()
  })

  it('moves owned goal and appends move history', async () => {
    const response = await POST(request({ id: 7, toPeriodType: 'month', toPeriodKey: '2026-07' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({ id: 7, periodType: 'month', periodKey: '2026-07', tags: ['focus'], blockedBy: [] }))
    expect(mocks.goalUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        periodType: 'month',
        periodKey: '2026-07',
        historyJson: expect.arrayContaining([
          expect.objectContaining({
            type: 'moved',
            from: { periodType: 'week', periodKey: '2026-W31' },
            to: { periodType: 'month', periodKey: '2026-07' },
          }),
        ]),
      }),
    })
  })
})
