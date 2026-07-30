import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDateParam } from '@/lib/dates'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  goalFindMany: vi.fn(),
  goalCount: vi.fn(),
  goalFindFirst: vi.fn(),
  goalCreate: vi.fn(),
  goalUpdate: vi.fn(),
  goalDelete: vi.fn(),
  completedWorkUpdateMany: vi.fn(),
  syncCompletedWorkForGoal: vi.fn(),
  removeCompletedWorkForGoal: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/completed-work', () => ({
  syncCompletedWorkForGoal: mocks.syncCompletedWorkForGoal,
  removeCompletedWorkForGoal: mocks.removeCompletedWorkForGoal,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    goal: {
      findMany: mocks.goalFindMany,
      count: mocks.goalCount,
      findFirst: mocks.goalFindFirst,
      create: mocks.goalCreate,
      update: mocks.goalUpdate,
      delete: mocks.goalDelete,
    },
    completedWork: { updateMany: mocks.completedWorkUpdateMany },
  },
}))

import { DELETE, GET, POST, PUT } from '@/app/api/goals/items/route'
import { AuthError } from '@/lib/auth'

const now = new Date('2026-07-30T10:00:00.000Z')

const goal = {
  id: 7,
  userId: 'user-1',
  text: 'Ship contract tests',
  periodType: 'week',
  periodKey: '2026-W31',
  deadline: null,
  priority: 'medium',
  tagsJson: ['quality'],
  blockedByJson: [3],
  historyJson: [{ type: 'created', date: now.toISOString() }],
  completed: false,
  completedAt: null,
  parentId: null,
  sortOrder: 0,
  scope: 'dream',
  rootYearGoalId: null,
  createdAt: now,
  updatedAt: now,
}

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(url, init)
}

function jsonRequest(method: string, body: unknown): NextRequest {
  return request('http://localhost/api/goals/items', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.goalFindMany.mockResolvedValue([])
  mocks.goalCount.mockResolvedValue(0)
  mocks.goalFindFirst.mockResolvedValue(goal)
  mocks.goalCreate.mockResolvedValue(goal)
  mocks.goalUpdate.mockResolvedValue(goal)
  mocks.goalDelete.mockResolvedValue(goal)
  mocks.completedWorkUpdateMany.mockResolvedValue({ count: 1 })
  mocks.syncCompletedWorkForGoal.mockResolvedValue(undefined)
  mocks.removeCompletedWorkForGoal.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/goals/items', () => {
  it.each([
    ['GET', () => GET(request('http://localhost/api/goals/items'))],
    ['POST', () => POST(jsonRequest('POST', { text: 'Goal', periodType: 'week', periodKey: '2026-W31' }))],
    ['PUT', () => PUT(jsonRequest('PUT', { id: 7, text: 'Updated' }))],
    ['DELETE', () => DELETE(request('http://localhost/api/goals/items?id=7', { method: 'DELETE' }))],
  ])('returns 401 for %s without authentication', async (_method, callRoute) => {
    mocks.requireUserId.mockRejectedValue(new AuthError('Unauthorized', 401))

    const response = await callRoute()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('filters GET by authenticated user and requested period', async () => {
    mocks.goalFindMany.mockResolvedValue([goal])
    mocks.goalCount.mockResolvedValue(1)

    const response = await GET(request('http://localhost/api/goals/items?periodType=week&periodKey=2026-W31'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toEqual([expect.objectContaining({ id: 7, priority: 1, tags: ['quality'], blockedBy: [3] })])
    expect(mocks.goalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', periodType: 'week', periodKey: '2026-W31' },
    }))
    expect(mocks.goalCount).toHaveBeenCalledWith({ where: { userId: 'user-1', periodType: 'week', periodKey: '2026-W31' } })
  })

  it('rejects invalid POST body with validation details', async () => {
    const response = await POST(jsonRequest('POST', { text: '', periodType: 'week', periodKey: '2026-W31' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
    expect(mocks.goalCreate).not.toHaveBeenCalled()
  })

  it('returns 404 when POST parent goal belongs to another user or is absent', async () => {
    mocks.goalFindFirst.mockResolvedValue(null)

    const response = await POST(jsonRequest('POST', {
      text: 'Child goal',
      periodType: 'week',
      periodKey: '2026-W31',
      parentId: 99,
    }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Parent goal not found' })
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 99, userId: 'user-1' } })
    expect(mocks.goalCreate).not.toHaveBeenCalled()
  })

  it('creates goal for authenticated user and maps response fields', async () => {
    const response = await POST(jsonRequest('POST', {
      text: 'Ship contract tests',
      periodType: 'week',
      periodKey: '2026-W31',
      deadline: '2026-08-01',
      priority: 2,
      tags: ['quality'],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({ id: 7, text: 'Ship contract tests', priority: 1, tags: ['quality'] }))
    expect(mocks.goalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        text: 'Ship contract tests',
        deadline: parseDateParam('2026-08-01'),
        priority: 'high',
        tagsJson: ['quality'],
      }),
    })
  })

  it('rejects invalid PUT body with validation details', async () => {
    const response = await PUT(jsonRequest('PUT', { id: 7, text: '' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
    expect(mocks.goalFindFirst).not.toHaveBeenCalled()
    expect(mocks.goalUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when PUT target goal belongs to another user or is absent', async () => {
    mocks.goalFindFirst.mockResolvedValue(null)

    const response = await PUT(jsonRequest('PUT', { id: 7, text: 'Updated' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Goal not found' })
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'user-1' } })
    expect(mocks.goalUpdate).not.toHaveBeenCalled()
  })

  it('updates owned goal and syncs completed work when completion changes', async () => {
    const completedGoal = { ...goal, completed: true, completedAt: new Date('2026-07-30T11:00:00.000Z'), priority: 'high', tagsJson: ['done'] }
    mocks.goalUpdate.mockResolvedValue(completedGoal)

    const response = await PUT(jsonRequest('PUT', { id: 7, completed: true, priority: 'high', tags: ['done'] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({ id: 7, completed: true, priority: 2, tags: ['done'] }))
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'user-1' } })
    expect(mocks.goalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: expect.objectContaining({ completed: true, priority: 'high', tagsJson: ['done'] }),
    }))
    expect(mocks.syncCompletedWorkForGoal).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', goalId: 7 }))
  })

  it('rejects DELETE without numeric id', async () => {
    const response = await DELETE(request('http://localhost/api/goals/items?id=abc', { method: 'DELETE' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Invalid goal ID' })
    expect(mocks.goalFindFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when DELETE target goal belongs to another user or is absent', async () => {
    mocks.goalFindFirst.mockResolvedValue(null)

    const response = await DELETE(request('http://localhost/api/goals/items?id=7', { method: 'DELETE' }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Goal not found' })
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'user-1' } })
    expect(mocks.goalDelete).not.toHaveBeenCalled()
  })

  it('deletes owned goal and detaches completed work links', async () => {
    const response = await DELETE(request('http://localhost/api/goals/items?id=7', { method: 'DELETE' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mocks.goalFindFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'user-1' } })
    expect(mocks.completedWorkUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', sourceType: 'goal', sourceId: 7 },
      data: { sourceId: 0 },
    })
    expect(mocks.goalDelete).toHaveBeenCalledWith({ where: { id: 7 } })
  })
})
