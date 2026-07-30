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

import { PATCH } from '@/app/api/tasks/[id]/route'

const task = { id: 11, userId: 'user-1', taskText: 'Original task', isClosed: false }

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tasks/11', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = '11') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.openTaskFindFirst.mockResolvedValue(task)
  mocks.openTaskUpdate.mockResolvedValue({ ...task, taskText: 'Updated task' })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/tasks/[id] PATCH', () => {
  it('rejects invalid body with validation details', async () => {
    const response = await PATCH(request({ taskText: '' }), params())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
    expect(mocks.openTaskFindFirst).not.toHaveBeenCalled()
    expect(mocks.openTaskUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when task belongs to another user or is absent', async () => {
    mocks.openTaskFindFirst.mockResolvedValue(null)

    const response = await PATCH(request({ taskText: 'Updated task' }), params())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Task not found' })
    expect(mocks.openTaskFindFirst).toHaveBeenCalledWith({ where: { id: 11, userId: 'user-1' } })
    expect(mocks.openTaskUpdate).not.toHaveBeenCalled()
  })

  it('updates owned task text', async () => {
    const response = await PATCH(request({ taskText: 'Updated task' }), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ...task, taskText: 'Updated task' })
    expect(mocks.openTaskFindFirst).toHaveBeenCalledWith({ where: { id: 11, userId: 'user-1' } })
    expect(mocks.openTaskUpdate).toHaveBeenCalledWith({ where: { id: 11 }, data: { taskText: 'Updated task' } })
  })
})
