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

import { POST } from '@/app/api/tasks/[id]/close/route'

const task = { id: 11, userId: 'user-1', taskText: 'Task', isClosed: false }

function request(): NextRequest {
  return new NextRequest('http://localhost/api/tasks/11/close', { method: 'POST' })
}

function params(id = '11') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.openTaskFindFirst.mockResolvedValue(task)
  mocks.openTaskUpdate.mockResolvedValue({ ...task, isClosed: true, archiveStatus: 'completed', closedAt: new Date('2026-07-30T10:00:00.000Z') })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/tasks/[id]/close', () => {
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

  it('closes owned task as completed', async () => {
    const response = await POST(request(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(expect.objectContaining({ id: 11, isClosed: true, archiveStatus: 'completed' }))
    expect(mocks.openTaskUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { isClosed: true, archiveStatus: 'completed', closedAt: expect.any(Date) },
    })
  })
})
