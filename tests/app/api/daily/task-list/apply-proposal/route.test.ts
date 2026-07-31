import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashDailyPlanTasks } from '@/lib/daily-schedule-proposal'

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  applyDailyTaskListProposal: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/daily-schedule-apply', () => ({ applyDailyTaskListProposal: mocks.applyDailyTaskListProposal }))

import { POST } from '@/app/api/daily/task-list/apply-proposal/route'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/daily/task-list/apply-proposal', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('/api/daily/task-list/apply-proposal', () => {
  beforeEach(() => {
    mocks.requireUserId.mockResolvedValue('user-1')
    mocks.applyDailyTaskListProposal.mockResolvedValue({
      status: 200,
      updatedAt: new Date('2026-02-28T11:00:00.000Z'),
      applyStatus: 'created',
      proposalMessageId: 12,
      planText: 'Тетроникс\nЗарядка',
      planTasks: ['Тетроникс', 'Зарядка'],
      currentPlanTasksHash: hashDailyPlanTasks(['Тетроникс', 'Зарядка']),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('applies task-list proposal and returns updated plan only', async () => {
    const expectedCurrentPlanTasksHash = hashDailyPlanTasks([])
    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentPlanTasksHash }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ status: 'created', planText: 'Тетроникс\nЗарядка', planTasks: ['Тетроникс', 'Зарядка'], proposalMessageId: 12 })
    expect(body).not.toHaveProperty('schedule')
    expect(mocks.applyDailyTaskListProposal).toHaveBeenCalledWith({ userId: 'user-1', date: '2026-02-28', messageId: 12, expectedCurrentPlanTasksHash })
  })

  it('rejects missing expectedCurrentPlanTasksHash', async () => {
    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(mocks.applyDailyTaskListProposal).not.toHaveBeenCalled()
  })

  it('returns conflict with current plan hash', async () => {
    const currentPlanTasksHash = hashDailyPlanTasks(['Уже есть'])
    mocks.applyDailyTaskListProposal.mockResolvedValue({ status: 409, currentPlanTasksHash, error: 'Список задач изменился после создания предложения. Попросите AI обновить список.' })

    const response = await POST(request({ date: '2026-02-28', messageId: 12, confirmed: true, expectedCurrentPlanTasksHash: hashDailyPlanTasks([]) }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({ error: 'Список задач изменился после создания предложения. Попросите AI обновить список.', currentPlanTasksHash })
  })
})
