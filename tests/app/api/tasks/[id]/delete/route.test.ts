import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  openTaskFindFirst: vi.fn(),
  openTaskDelete: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    openTask: { findFirst: mocks.openTaskFindFirst, delete: mocks.openTaskDelete },
  },
}))

import { DELETE } from '@/app/api/tasks/[id]/delete/route'

const task = { id: 11, userId: 'user-1', taskText: 'Task', isClosed: false }

function request(): NextRequest {
  return new NextRequest('http://localhost/api/tasks/11/delete', { method: 'DELETE' })
}

function params(id = '11') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.openTaskFindFirst.mockResolvedValue(task)
  mocks.openTaskDelete.mockResolvedValue(task)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/tasks/[id]/delete', () => {
  it('rejects invalid task id', async () => {
    const response = await DELETE(request(), params('abc'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'Invalid task ID' })
    expect(mocks.openTaskFindFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when task belongs to another user or is absent', async () => {
    mocks.openTaskFindFirst.mockResolvedValue(null)

    const response = await DELETE(request(), params())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: 'Task not found' })
    expect(mocks.openTaskFindFirst).toHaveBeenCalledWith({ where: { id: 11, userId: 'user-1' } })
    expect(mocks.openTaskDelete).not.toHaveBeenCalled()
  })

  it('deletes owned task', async () => {
    const response = await DELETE(request(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mocks.openTaskDelete).toHaveBeenCalledWith({ where: { id: 11 } })
  })
})
