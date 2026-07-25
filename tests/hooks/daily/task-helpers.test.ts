import { describe, expect, it } from 'vitest'
import {
  buildTasksFromTexts,
  mergeAppliedPlanTasks,
  parseExtraTasksJson,
  parseSelectedTasksJson,
  preserveSelectionByTaskIds,
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

  it('preserves selected task status when editing selected task text', () => {
    const nextTasks = buildTasksFromTexts(['Edited selected', 'Active'], '2026-05-02')

    expect(Array.from(preserveSelectionByTaskIds(new Set([1]), nextTasks))).toEqual([1])
  })

  it('merges applied planTasks preserving completed existing tasks by text and adding new tasks unchecked', () => {
    const prevTasks = buildTasksFromTexts(['Готово', 'Активно'], '2026-05-02')
    const merged = mergeAppliedPlanTasks(prevTasks, new Set([1]), ['Готово', 'Активно', 'Новая'], '2026-05-02')

    expect(merged.tasks.map(task => task.taskText)).toEqual(['Готово', 'Активно', 'Новая'])
    expect(Array.from(merged.selectedTasks)).toEqual([1])
  })

  it('uses the latest selected tasks snapshot when merging after an in-flight apply', () => {
    const prevTasks = buildTasksFromTexts(['Сделать отчёт', 'Позвонить'], '2026-05-02')
    const selectedAtClick = new Set([1])
    const selectedAtCommit = new Set([2])

    expect(Array.from(mergeAppliedPlanTasks(prevTasks, selectedAtClick, ['Сделать отчёт', 'Позвонить', 'Новая'], '2026-05-02').selectedTasks)).toEqual([1])
    expect(Array.from(mergeAppliedPlanTasks(prevTasks, selectedAtCommit, ['Сделать отчёт', 'Позвонить', 'Новая'], '2026-05-02').selectedTasks)).toEqual([2])
  })

  it('preserves unselected task status when editing unselected task text', () => {
    const nextTasks = buildTasksFromTexts(['Selected', 'Edited active'], '2026-05-02')

    expect(Array.from(preserveSelectionByTaskIds(new Set([1]), nextTasks))).toEqual([1])
  })

  it('preserves task statuses by id when edited text duplicates another task', () => {
    const nextTasks = buildTasksFromTexts(['Call', 'Call', 'Other'], '2026-05-02')

    expect(Array.from(preserveSelectionByTaskIds(new Set([1, 3]), nextTasks))).toEqual([1, 3])
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
