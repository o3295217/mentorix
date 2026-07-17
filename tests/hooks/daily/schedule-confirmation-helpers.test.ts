import { describe, expect, it } from 'vitest'
import { isStrictScheduleConfirmation, selectStrictScheduleConfirmationProposal } from '@/hooks/daily/schedule-confirmation-helpers'
import type { ChatMessage } from '@/hooks/daily/types'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'

const metadata: DailyScheduleProposalMetadata = {
  type: 'daily_schedule_proposal',
  schemaVersion: 1,
  date: '2026-07-16',
  createdAt: '2026-07-16T08:00:00.000Z',
  currentScheduleExists: false,
  currentScheduleHash: null,
  appliedAt: null,
  proposal: {
    version: 1,
    date: '2026-07-16',
    timezone: 'Europe/Moscow',
    dayStartMinutes: 540,
    dayEndMinutes: 1080,
    blocks: [{ kind: 'task', taskIndex: 1, taskText: 'Фокус', startMinutes: 540, durationMinutes: 45 }],
  },
}

const assistantProposal = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: '55',
  role: 'assistant',
  content: 'Черновик',
  metadata,
  ...overrides,
})

describe('schedule confirmation helpers', () => {
  it('accepts only strict confirmation phrases', () => {
    expect(isStrictScheduleConfirmation('размести')).toBe(true)
    expect(isStrictScheduleConfirmation('  Да  ')).toBe(true)
    expect(isStrictScheduleConfirmation('да, но сначала поправь')).toBe(false)
    expect(isStrictScheduleConfirmation('размести завтра')).toBe(false)
  })

  it('selects latest visible pending proposal', () => {
    const result = selectStrictScheduleConfirmationProposal('размести', [assistantProposal()], new Set())
    expect(result).toMatchObject({ messageId: '55', metadata })
  })

  it('does not select when a newer ordinary message is latest', () => {
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal(), { id: 'ordinary', role: 'assistant', content: 'Ок', metadata: null }], new Set())).toBeNull()
  })

  it('does not select dismissed, pending-id or already applied proposals', () => {
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal()], new Set(['55']))).toBeNull()
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: 'pending-1' })], new Set())).toBeNull()
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ metadata: { ...metadata, appliedAt: '2026-07-16T09:00:00.000Z' } })], new Set())).toBeNull()
  })

  it('accepts only positive numeric persisted ids as auto-apply targets', () => {
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: '1' })], new Set())?.messageId).toBe('1')
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: '0' })], new Set())).toBeNull()
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: 'local-1' })], new Set())).toBeNull()
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: '550e8400-e29b-41d4-a716-446655440000' })], new Set())).toBeNull()
    expect(selectStrictScheduleConfirmationProposal('да', [assistantProposal({ id: '' })], new Set())).toBeNull()
  })
})
