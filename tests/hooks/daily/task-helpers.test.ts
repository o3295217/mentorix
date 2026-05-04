import { describe, expect, it } from 'vitest'
import {
  buildTasksFromTexts,
  parseExtraTasksJson,
  parseSelectedTasksJson,
  remapSelectionByText,
  sanitizeSelectedForTotal,
} from '@/hooks/daily/task-helpers'

describe('daily task helpers', () => {
  it('builds trimmed one-based tasks for the selected date', () => {
    const tasks = buildTasksFromTexts([' First ', '', 'Second'], '2026-05-02')

    expect(tasks).toMatchObject([
      { id: 1, taskText: 'First', taskType: 'operational', originDate: '2026-05-02' },
      { id: 2, taskText: 'Second', taskType: 'operational', originDate: '2026-05-02' },
    ])
  })

  it('sanitizes selected IDs to existing task bounds', () => {
    expect(Array.from(sanitizeSelectedForTotal([1, '2', 2.8, 0, 4, 'bad'], 3))).toEqual([1, 2])
  })

  it('remaps selected tasks by normalized text while preserving duplicate counts', () => {
    const prevTasks = buildTasksFromTexts(['Call', 'Write', 'Call'], '2026-05-02')
    const nextTasks = buildTasksFromTexts(['write', 'CALL', 'Call', 'Other'], '2026-05-02')

    expect(Array.from(remapSelectionByText(prevTasks, new Set([1, 3]), nextTasks))).toEqual([2, 3])
  })

  it('parses extra tasks defensively', () => {
    expect(parseExtraTasksJson('["A", "", 3, "B"]')).toEqual(['A', 'B'])
    expect(parseExtraTasksJson(['A', '', 3, 'B'])).toEqual(['A', 'B'])
    expect(parseExtraTasksJson('{"nope":true}')).toEqual([])
    expect(parseExtraTasksJson('broken')).toEqual([])
    expect(parseExtraTasksJson(null)).toEqual([])
  })

  it('parses selected tasks defensively', () => {
    expect(parseSelectedTasksJson('[1, "2", null, "bad"]')).toEqual([1, '2', 'bad'])
    expect(parseSelectedTasksJson([1, '2', null, 'bad'])).toEqual([1, '2', 'bad'])
    expect(parseSelectedTasksJson('{"nope":true}')).toEqual([])
    expect(parseSelectedTasksJson(null)).toEqual([])
  })
})