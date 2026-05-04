import type { Goal } from '@/lib/types'
import { safeParseJson } from '@/lib/api-utils'

type GoalRecord = {
  priority: string
  tagsJson: unknown
  blockedByJson: unknown
  historyJson: unknown
  scope: string | null
  rootYearGoalId: string | null
}

export function goalPriorityStringToNumber(priority: string): number {
  switch (priority) {
    case 'high': return 2
    case 'medium': return 1
    default: return 0
  }
}

export function goalPriorityNumberToString(priority: number): string {
  switch (priority) {
    case 2: return 'high'
    case 1: return 'medium'
    default: return 'none'
  }
}

export function mapGoalForResponse<T extends GoalRecord>(goal: T): Omit<T, 'tagsJson' | 'blockedByJson' | 'historyJson' | 'priority'> & Goal {
  const { tagsJson, blockedByJson, historyJson, priority, ...rest } = goal

  return {
    ...rest,
    priority: goalPriorityStringToNumber(priority),
    tags: safeParseJson<string[]>(tagsJson, []),
    blockedBy: safeParseJson<number[]>(blockedByJson, []),
    history: safeParseJson<Array<{ action: string; date: string; from?: string; to?: string }>>(historyJson, []),
    scope: goal.scope || 'dream',
    rootYearGoalId: goal.rootYearGoalId || null,
  } as Omit<T, 'tagsJson' | 'blockedByJson' | 'historyJson' | 'priority'> & Goal
}