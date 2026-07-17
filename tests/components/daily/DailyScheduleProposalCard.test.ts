import { describe, expect, it } from 'vitest'
import {
  getProposalActionSemantics,
  getProposalApplyButtonLabel,
  getProposalBlockMetaLabel,
  getProposalBoundaryText,
  isProposalBlockFixed,
} from '@/components/daily/DailyScheduleProposalCard'
import type { DailyScheduleProposalMetadata } from '@/lib/daily-schedule-proposal'

const v2Metadata: DailyScheduleProposalMetadata = {
  type: 'daily_schedule_proposal',
  schemaVersion: 2,
  date: '2026-07-16',
  createdAt: '2026-07-16T08:00:00.000Z',
  currentScheduleExists: true,
  currentScheduleHash: null,
  appliedAt: null,
  proposal: {
    version: 2,
    date: '2026-07-16',
    timezone: 'Europe/Moscow',
    dayStartMinutes: 9 * 60,
    dayEndMinutes: 21 * 60 + 30,
    planningBasis: 'day_start',
    planningStartMinutes: 9 * 60,
    workEndMinutes: 18 * 60,
    activityEndMinutes: 21 * 60 + 30,
    blocks: [
      { kind: 'task', taskIndex: 1, taskText: 'Фокус', category: 'main', isFixed: false, startMinutes: 9 * 60 + 30, durationMinutes: 45 },
      { kind: 'buffer', title: 'Дорога', category: 'travel', isFixed: true, startMinutes: 18 * 60, durationMinutes: 90 },
    ],
  },
  loadSummary: {
    activeInterval: { startMinutes: 9 * 60, endMinutes: 21 * 60 + 30, availableMinutes: 750 },
    workInterval: { startMinutes: 9 * 60, endMinutes: 18 * 60, availableMinutes: 540 },
    scheduledMinutes: 135,
    unscheduledMinutes: 615,
    scheduledPercent: 18,
    unscheduledPercent: 82,
    workScheduledMinutes: 45,
    workUnscheduledMinutes: 495,
    workScheduledPercent: 8.33,
    categories: {
      main: { minutes: 45, percent: 6, workMinutes: 45, workPercent: 8.33 },
      operational: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
      travel: { minutes: 90, percent: 12, workMinutes: 0, workPercent: 0 },
      personal: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
      meal: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
      rest: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
      buffer: { minutes: 0, percent: 0, workMinutes: 0, workPercent: 0 },
    },
    loadLevel: 'light',
    recommendation: 'ok',
  },
}

const v1Metadata: DailyScheduleProposalMetadata = {
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
    dayStartMinutes: 9 * 60,
    dayEndMinutes: 18 * 60,
    blocks: [{ kind: 'task', taskIndex: 1, taskText: 'Фокус', startMinutes: 9 * 60 + 30, durationMinutes: 45 }],
  },
}

describe('DailyScheduleProposalCard view helpers', () => {
  it('builds v2 boundary and fixed block labels', () => {
    expect(getProposalBoundaryText(v2Metadata)).toBe('старт 09:00 · работа до 18:00 · активность до 21:30')
    expect(isProposalBlockFixed(v2Metadata.proposal.blocks[1])).toBe(true)
    expect(getProposalBlockMetaLabel(v2Metadata.proposal.blocks[1])).toBe('дорога · 1 ч 30 мин · фиксированное время')
  })

  it('falls back for v1 boundary and non-fixed label', () => {
    expect(getProposalBoundaryText(v1Metadata)).toBe('старт 09:00 · работа до 18:00 · активность до 18:00')
    expect(isProposalBlockFixed(v1Metadata.proposal.blocks[0])).toBe(false)
    expect(getProposalBlockMetaLabel(v1Metadata.proposal.blocks[0])).toBe('задача · 45 мин')
  })

  it('describes apply labels before and after apply', () => {
    expect(getProposalApplyButtonLabel({ isApplied: false, isApplying: false, hasExistingSchedule: false })).toBe('Применить')
    expect(getProposalApplyButtonLabel({ isApplied: false, isApplying: false, hasExistingSchedule: true })).toBe('Заменить расписание')
    expect(getProposalApplyButtonLabel({ isApplied: false, isApplying: true, hasExistingSchedule: true })).toBe('Применяем…')
    expect(getProposalApplyButtonLabel({ isApplied: true, isApplying: false, hasExistingSchedule: true })).toBe('Применено')
  })

  it('keeps discuss and dismiss action semantics explicit', () => {
    expect(getProposalActionSemantics({ messageId: 'm1', isApplying: false, isApplied: false, hasExistingSchedule: true })).toEqual({
      applyLabel: 'Заменить расписание',
      applyDisabled: false,
      discussLabel: 'Обсудить изменения',
      discussDisabled: false,
      dismissLabel: 'Отменить',
      dismissDisabled: false,
    })
    expect(getProposalActionSemantics({ isApplying: true, isApplied: false, hasExistingSchedule: false })).toMatchObject({
      applyLabel: 'Применяем…',
      applyDisabled: true,
      discussDisabled: true,
      dismissDisabled: true,
    })
  })
})
