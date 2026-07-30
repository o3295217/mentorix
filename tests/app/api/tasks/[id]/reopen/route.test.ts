import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  openTaskFindFirst: vi.fn(),
  openTaskUpdate: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    openTask: { findFirst: mocks.openTaskFindFirst, update: mocks.openTaskUpdate },
  },
}))

import { POST } from '@/app/api/tasks/[id]/reopen/route'

const task = { id: 11, userId: 'user-1', taskText: 'Task', isClosed: true, archiveStatus: 'completed', closedAt: new Date('2026-07-30T10:00:00.000Z') }

function request(): NextRequest {
  return new NextRequest('http://localhost/api/tasks/11/reopen', { method: 'POST' })
}

function params(id = '11') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.openTaskFindFirst.mockResolvedValue(task)
  mocks.openTaskUpdate.mockResolvedValue({ ...task, isClosed: false, archiveStatus: null, closedAt: null })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/tasks/[id]/reopen', () => {
  it('rejects invalid task id', async () => {
    const response = await POST(request(), params('abc'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Invalid task ID' })
    expect(mocks.openTaskFindFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when task belongs to another user or is absent', async () => {
    mocks.openTaskFindFirst.mockResolvedValue(null)

    const response = await POST(request(), params())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Task not found' })
    expect(mocks.openTaskFindFirst).toHaveBeenCalledWith({ where: { id: 11, userId: 'user-1' } })
    expect(mocks.openTaskUpdate).not.toHaveBeenCalled()
  })

  it('reopens owned task', async () => {
    const response = await POST(request(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({ id: 11, isClosed: false, archiveStatus: null, closedAt: null }))
    expect(mocks.openTaskUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { isClosed: false, archiveStatus: null, closedAt: null },
    })
  })
})
