import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDateParam } from '@/lib/dates'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  dailyEntryCreate: vi.fn(),
  dailyEntryUpdate: vi.fn(),
  openTaskFindMany: vi.fn(),
  openTaskCreate: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyEntry: {
      findFirst: mocks.dailyEntryFindFirst,
      create: mocks.dailyEntryCreate,
      update: mocks.dailyEntryUpdate,
    },
    openTask: {
      findMany: mocks.openTaskFindMany,
      create: mocks.openTaskCreate,
    },
  },
}))

import { POST } from '@/app/api/tasks/process-uncompleted/route'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/tasks/process-uncompleted', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.dailyEntryFindFirst.mockResolvedValue({ id: 21, userId: 'user-1', date: parseDateParam('2026-07-31'), planText: 'Existing', selectedTasksJson: [] })
  mocks.dailyEntryCreate.mockResolvedValue({ id: 22, userId: 'user-1', date: parseDateParam('2026-08-01'), planText: '' })
  mocks.dailyEntryUpdate.mockResolvedValue({})
  mocks.openTaskFindMany.mockResolvedValue([])
  mocks.openTaskCreate.mockResolvedValue({ id: 31 })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/tasks/process-uncompleted', () => {
  it('rejects body without decisions array', async () => {
    const response = await POST(request({ sourceDate: '2026-07-30' }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: 'decisions array required' })
    expect(mocks.dailyEntryFindFirst).not.toHaveBeenCalled()
    expect(mocks.openTaskCreate).not.toHaveBeenCalled()
  })

  it('routes transfer, backlog, completed and skip decisions to different mutations', async () => {
    mocks.dailyEntryFindFirst
      .mockResolvedValueOnce({ id: 21, userId: 'user-1', date: parseDateParam('2026-07-31'), planText: 'Existing task', selectedTasksJson: [] })
      .mockResolvedValueOnce({ id: 23, userId: 'user-1', date: parseDateParam('2026-07-30'), planText: 'Source', selectedTasksJson: [9] })
    mocks.openTaskFindMany.mockResolvedValue([{ taskText: 'Different backlog item' }])

    const response = await POST(request({
      sourceDate: '2026-07-30',
      decisions: [
        { taskId: 1, taskText: 'Transfer me', action: { type: 'transfer', date: '2026-07-31' } },
        { taskId: 2, taskText: 'Backlog me', action: { type: 'backlog' } },
        { taskId: 3, taskText: 'Done already', action: { type: 'completed' } },
        { taskId: 4, taskText: 'Skip me', action: { type: 'skip' } },
      ],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      results: [
        { taskId: 1, success: true, action: 'transferred' },
        { taskId: 2, success: true, action: 'added_to_backlog' },
        { taskId: 3, success: true, action: 'marked_completed' },
        { taskId: 4, success: true, action: 'skipped' },
      ],
    })
    expect(mocks.dailyEntryFindFirst).toHaveBeenNthCalledWith(1, { where: { userId: 'user-1', date: parseDateParam('2026-07-31') } })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 21 }, data: { planText: 'Existing task\nTransfer me' } })
    expect(mocks.openTaskFindMany).toHaveBeenCalledWith({ where: { userId: 'user-1', isClosed: false }, select: { taskText: true } })
    expect(mocks.openTaskCreate).toHaveBeenCalledWith({
      data: { userId: 'user-1', taskText: 'Backlog me', taskType: 'operational', originDate: parseDateParam('2026-07-30') },
    })
    expect(mocks.dailyEntryFindFirst).toHaveBeenNthCalledWith(2, { where: { userId: 'user-1', date: parseDateParam('2026-07-30') } })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 23 }, data: { selectedTasksJson: [9, 3] } })
  })

  it('creates target daily entry for transfer when it does not exist', async () => {
    mocks.dailyEntryFindFirst.mockResolvedValue(null)

    const response = await POST(request({
      sourceDate: '2026-07-30',
      decisions: [{ taskId: 1, taskText: 'Transfer me', action: { type: 'transfer', date: '2026-08-01' } }],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toEqual([{ taskId: 1, success: true, action: 'transferred' }])
    expect(mocks.dailyEntryCreate).toHaveBeenCalledWith({ data: { userId: 'user-1', date: parseDateParam('2026-08-01'), planText: '' } })
    expect(mocks.dailyEntryUpdate).toHaveBeenCalledWith({ where: { id: 22 }, data: { planText: 'Transfer me' } })
  })

  it('does not duplicate similar backlog task', async () => {
    mocks.openTaskFindMany.mockResolvedValue([{ taskText: 'Backlog me' }])

    const response = await POST(request({
      sourceDate: '2026-07-30',
      decisions: [{ taskId: 2, taskText: 'Backlog me', action: { type: 'backlog' } }],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.results).toEqual([{ taskId: 2, success: true, action: 'added_to_backlog' }])
    expect(mocks.openTaskCreate).not.toHaveBeenCalled()
  })
})
