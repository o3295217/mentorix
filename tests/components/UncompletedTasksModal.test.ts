import { describe, expect, it } from 'vitest'
import {
  applyBulkChip,
  areAllSelectionsValid,
  buildDecisions,
  buildTaskAction,
  getDefaultRowSelection,
  getInitialSelections,
  isRowSelectionValid,
  type RowSelection,
  type UncompletedTask,
} from '@/components/UncompletedTasksModal'

const tasks: UncompletedTask[] = [
  { id: 1, taskText: 'Первая задача' },
  { id: 2, taskText: 'Вторая задача', transferCount: 3 },
]

const tomorrow = '2026-08-30'

describe('getDefaultRowSelection', () => {
  it('defaults to the tomorrow chip', () => {
    expect(getDefaultRowSelection()).toEqual({ chip: 'tomorrow' })
  })
})

describe('getInitialSelections', () => {
  it('defaults every task to "tomorrow" so the modal opens with a valid CTA', () => {
    expect(getInitialSelections(tasks)).toEqual({
      1: { chip: 'tomorrow' },
      2: { chip: 'tomorrow' },
    })
  })

  it('returns an empty map for an empty task list', () => {
    expect(getInitialSelections([])).toEqual({})
  })
})

describe('isRowSelectionValid', () => {
  it('is valid for every chip except an unset custom date', () => {
    expect(isRowSelectionValid({ chip: 'tomorrow' })).toBe(true)
    expect(isRowSelectionValid({ chip: 'backlog' })).toBe(true)
    expect(isRowSelectionValid({ chip: 'completed' })).toBe(true)
    expect(isRowSelectionValid({ chip: 'skip' })).toBe(true)
  })

  it('is invalid when "custom" has no date yet', () => {
    expect(isRowSelectionValid({ chip: 'custom' })).toBe(false)
    expect(isRowSelectionValid({ chip: 'custom', customDate: '' })).toBe(false)
  })

  it('is valid once "custom" has a date', () => {
    expect(isRowSelectionValid({ chip: 'custom', customDate: '2026-09-01' })).toBe(true)
  })

  it('is invalid when the row has no selection at all', () => {
    expect(isRowSelectionValid(undefined)).toBe(false)
  })
})

describe('areAllSelectionsValid', () => {
  it('is true when every task defaults to "tomorrow"', () => {
    expect(areAllSelectionsValid(tasks, getInitialSelections(tasks))).toBe(true)
  })

  it('is false when one row picked "custom" without a date', () => {
    const selections: Record<number, RowSelection> = {
      1: { chip: 'tomorrow' },
      2: { chip: 'custom' },
    }
    expect(areAllSelectionsValid(tasks, selections)).toBe(false)
  })

  it('is true once the custom date is filled in', () => {
    const selections: Record<number, RowSelection> = {
      1: { chip: 'tomorrow' },
      2: { chip: 'custom', customDate: '2026-09-01' },
    }
    expect(areAllSelectionsValid(tasks, selections)).toBe(true)
  })
})

describe('buildTaskAction', () => {
  it('maps "tomorrow" to a transfer action for the tomorrow date', () => {
    expect(buildTaskAction({ chip: 'tomorrow' }, tomorrow)).toEqual({ type: 'transfer', date: tomorrow })
  })

  it('maps "custom" to a transfer action for the picked date', () => {
    expect(buildTaskAction({ chip: 'custom', customDate: '2026-09-05' }, tomorrow)).toEqual({
      type: 'transfer',
      date: '2026-09-05',
    })
  })

  it('falls back to tomorrow if "custom" somehow has no date', () => {
    expect(buildTaskAction({ chip: 'custom' }, tomorrow)).toEqual({ type: 'transfer', date: tomorrow })
  })

  it('maps "backlog", "completed" and "skip" to their bare actions', () => {
    expect(buildTaskAction({ chip: 'backlog' }, tomorrow)).toEqual({ type: 'backlog' })
    expect(buildTaskAction({ chip: 'completed' }, tomorrow)).toEqual({ type: 'completed' })
    expect(buildTaskAction({ chip: 'skip' }, tomorrow)).toEqual({ type: 'skip' })
  })
})

describe('buildDecisions', () => {
  it('builds one decision per task using its row selection', () => {
    const selections: Record<number, RowSelection> = {
      1: { chip: 'backlog' },
      2: { chip: 'skip' },
    }
    expect(buildDecisions(tasks, selections, tomorrow)).toEqual([
      { taskId: 1, taskText: 'Первая задача', action: { type: 'backlog' } },
      { taskId: 2, taskText: 'Вторая задача', action: { type: 'skip' } },
    ])
  })

  it('falls back to the default selection for a task missing from the map', () => {
    expect(buildDecisions(tasks, {}, tomorrow)).toEqual([
      { taskId: 1, taskText: 'Первая задача', action: { type: 'transfer', date: tomorrow } },
      { taskId: 2, taskText: 'Вторая задача', action: { type: 'transfer', date: tomorrow } },
    ])
  })
})

describe('applyBulkChip', () => {
  it('sets every task to the "tomorrow" chip', () => {
    expect(applyBulkChip(tasks, 'tomorrow')).toEqual({
      1: { chip: 'tomorrow' },
      2: { chip: 'tomorrow' },
    })
  })

  it('sets every task to the "backlog" chip, overriding a prior custom date', () => {
    expect(applyBulkChip(tasks, 'backlog')).toEqual({
      1: { chip: 'backlog' },
      2: { chip: 'backlog' },
    })
  })
})
