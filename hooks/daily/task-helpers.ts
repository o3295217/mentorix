import type { OpenTask } from '@/lib/types'

export function sanitizeSelectedForTotal(selected: (string | number)[], total: number): Set<number> {
  if (total <= 0) return new Set()

  const result = new Set<number>()
  for (const raw of selected) {
    const id = Number(raw)
    if (!Number.isFinite(id)) continue

    const rounded = Math.trunc(id)
    if (rounded >= 1 && rounded <= total) {
      result.add(rounded)
    }
  }

  return result
}

export function buildTasksFromTexts(texts: string[], selectedDate: string): OpenTask[] {
  return texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((taskText, index) => ({
      id: index + 1,
      taskText,
      taskType: 'operational' as const,
      originDate: selectedDate,
      isClosed: false,
      createdAt: new Date().toISOString(),
    }))
}

export function remapSelectionByText(
  prevTasks: OpenTask[],
  prevSelected: Set<number>,
  nextTasks: OpenTask[]
): Set<number> {
  const selectedTexts = prevTasks
    .filter((task) => prevSelected.has(task.id))
    .map((task) => task.taskText.trim().toLowerCase())
    .filter((taskText) => taskText.length > 0)

  const counts = new Map<string, number>()
  for (const text of selectedTexts) {
    counts.set(text, (counts.get(text) || 0) + 1)
  }

  const nextSelected = new Set<number>()
  for (const task of nextTasks) {
    const key = task.taskText.trim().toLowerCase()
    const count = counts.get(key) || 0
    if (count > 0) {
      nextSelected.add(task.id)
      if (count === 1) counts.delete(key)
      else counts.set(key, count - 1)
    }
  }

  return nextSelected
}

export function preserveSelectionByTaskIds(
  prevSelected: Set<number>,
  nextTasks: OpenTask[]
): Set<number> {
  const nextTaskIds = new Set(nextTasks.map((task) => task.id))
  return new Set(Array.from(prevSelected).filter((taskId) => nextTaskIds.has(taskId)))
}

export function parseSelectedTasksJson(value: unknown): (string | number)[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
      : []
  } catch {
    return []
  }
}

export function parseExtraTasksJson(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.filter((task): task is string => typeof task === 'string' && task.trim().length > 0)
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((task): task is string => typeof task === 'string' && task.trim().length > 0)
      : []
  } catch {
    return []
  }
}
