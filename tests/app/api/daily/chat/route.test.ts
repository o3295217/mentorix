import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const proposalInput = {
  version: 1,
  date: '2026-02-28',
  timezone: 'Europe/Moscow',
  dayStartMinutes: 480,
  dayEndMinutes: 1080,
  blocks: [{ kind: 'task', taskIndex: 1, taskText: 'Deep work', startMinutes: 540, durationMinutes: 60 }],
}

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  checkRateLimit: vi.fn(),
  stream: vi.fn(),
  logAIUsage: vi.fn(),
  chatMessageCreate: vi.fn(),
  dailyEntryFindMany: vi.fn(),
  dailyEntryFindFirst: vi.fn(),
  goalFindMany: vi.fn(),
  insightEntryFindMany: vi.fn(),
  getPlanUserContext: vi.fn(),
  getUserStatsForAI: vi.fn(),
  getWorkContextForAI: vi.fn(),
}))

vi.mock('@/lib/get-user-id', () => ({ requireUserId: mocks.requireUserId }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit, rateLimiters: { ai: {} } }))
vi.mock('@/lib/ai-usage', () => ({ logAIUsage: mocks.logAIUsage }))
vi.mock('@/lib/anthropic', () => ({ getAiModel: () => 'fast-model', getAnthropicClient: () => ({ messages: { stream: mocks.stream } }) }))
vi.mock('@/lib/user-context', () => ({ getPlanUserContext: mocks.getPlanUserContext }))
vi.mock('@/lib/user-stats', () => ({ getUserStatsForAI: mocks.getUserStatsForAI }))
vi.mock('@/lib/completed-work', () => ({ getWorkContextForAI: mocks.getWorkContextForAI }))
vi.mock('@/lib/prompts/plan-chat', () => ({
  PLAN_CHAT_SYSTEM_PROMPT: 'system',
  buildPlanChatContext: () => 'context',
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatMessage: { create: mocks.chatMessageCreate },
    dailyEntry: { findMany: mocks.dailyEntryFindMany, findFirst: mocks.dailyEntryFindFirst },
    goal: { findMany: mocks.goalFindMany },
    insightEntry: { findMany: mocks.insightEntryFindMany },
  },
}))

import { POST } from '@/app/api/daily/chat/route'

function makeStream(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event
    },
    finalMessage: vi.fn().mockResolvedValue({ usage: { input_tokens: 10, output_tokens: 20 } }),
  }
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/daily/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      date: '2026-02-28',
      timezone: 'Europe/Moscow',
      planTasks: ['Deep work'],
      completedTasks: [],
      messages: [],
      userMessage: 'Составь расписание',
    }),
  })
}

beforeEach(() => {
  mocks.requireUserId.mockResolvedValue('user-1')
  mocks.checkRateLimit.mockReturnValue({ success: true })
  mocks.dailyEntryFindMany.mockResolvedValue([])
  mocks.goalFindMany.mockResolvedValue([])
  mocks.insightEntryFindMany.mockResolvedValue([])
  mocks.dailyEntryFindFirst.mockResolvedValue({ schedule: null })
  mocks.getUserStatsForAI.mockResolvedValue({})
  mocks.getWorkContextForAI.mockResolvedValue({})
  mocks.getPlanUserContext.mockResolvedValue({ weekGoals: [], monthGoals: [], dreamGoal: null, profile: null, insights: null })
  mocks.logAIUsage.mockResolvedValue(undefined)
  mocks.chatMessageCreate.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 123 })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('/api/daily/chat SSE schedule proposal', () => {
  it('streams first text before proposal and done id, and stores metadata only when valid', async () => {
    mocks.stream.mockReturnValue(makeStream([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Сначала текст.' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'propose_daily_schedule' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify(proposalInput) } },
    ]))

    const response = await POST(request())
    const text = await response.text()

    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(text.indexOf('event: text')).toBeLessThan(text.indexOf('event: proposal'))
    expect(text).toContain('event: done')
    expect(text).toContain('"assistantMessageId":123')
    expect(mocks.chatMessageCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'assistant', metadataJson: expect.objectContaining({ currentScheduleExists: false, proposal: proposalInput }) }),
    }))
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('TIMEZONE: Europe/Moscow') })]),
      tools: expect.arrayContaining([expect.objectContaining({ input_schema: expect.objectContaining({ properties: expect.objectContaining({ timezone: expect.objectContaining({ description: expect.stringContaining('request context') }) }) }) })]),
    }))
  })

  it('does not emit proposal or metadata when tool input fails current plan validation', async () => {
    mocks.stream.mockReturnValue(makeStream([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Текст.' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'propose_daily_schedule' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ ...proposalInput, blocks: [{ ...proposalInput.blocks[0], taskText: 'Invented' }] }) } },
    ]))

    const response = await POST(request())
    const text = await response.text()

    expect(text).not.toContain('event: proposal')
    expect(mocks.chatMessageCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ metadataJson: expect.anything() }),
    }))
  })

  it('rejects proposal with timezone different from request timezone', async () => {
    mocks.stream.mockReturnValue(makeStream([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Текст.' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'propose_daily_schedule' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ ...proposalInput, timezone: 'Asia/Tbilisi' }) } },
    ]))

    const response = await POST(request())
    const text = await response.text()

    expect(text).not.toContain('event: proposal')
    expect(mocks.chatMessageCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ metadataJson: expect.anything() }),
    }))
  })
})
