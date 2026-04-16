import { useCallback } from 'react'
import { parsePeriodKey, getPeriodKey, MONTH_NAMES, PeriodType, fuzzyMatchGoal } from '@/lib/goals-utils'
import type { ParsedGoal } from '@/hooks/useGoalsChat'
import type { Goal } from '@/lib/types'

interface UseAcceptGoalsDeps {
  yearGoals: Map<number, string[]>
  periodGoals: Map<string, string[]>
  goals: Goal[]
  saveYearGoals: (year: number, goals: string[]) => Promise<void>
  savePeriodGoals: (periodType: PeriodType, date: Date, goals: string[], label: string) => Promise<void>
  addYearGoal: (year: number, text: string) => void
  addPeriodGoalBatch: (key: string, periodType: 'week' | 'month' | 'quarter' | 'half_year' | 'year', date: Date, label: string, texts: string[]) => void
  createTrackedGoal: (periodKey: string, text: string, priority?: number, tags?: string[], parentId?: number | null) => Promise<Goal | null>
  deleteGoal: (goalId: number) => Promise<boolean>
  showMessage: (msg: string) => void
}

function dedupeGoals(texts: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const text of texts) {
    const normalized = text.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(text.trim())
  }

  return result
}

function getCompletedTextsForPeriod(periodKey: string, currentTexts: string[], trackedGoals: Goal[]): string[] {
  const completedTracked = trackedGoals.filter(goal => goal.periodKey === periodKey && goal.completed)

  const matchedCurrent = currentTexts.filter(text =>
    completedTracked.some(goal => fuzzyMatchGoal(goal.text, text))
  )

  const extraCompleted = completedTracked
    .map(goal => goal.text)
    .filter(text => !matchedCurrent.some(existing => fuzzyMatchGoal(existing, text)))

  return dedupeGoals([...matchedCurrent, ...extraCompleted])
}

/** Resolve ParsedGoal period info → canonical key + date + label */
function resolveGoalPeriod(goal: ParsedGoal): { key: string; periodType: PeriodType; date: Date; label: string } | null {
  const parsed = parsePeriodKey(goal.periodKey)
  if (!parsed) return null

  let date: Date
  let label: string

  switch (parsed.type) {
    case 'year':
      return null // handled separately
    case 'half_year':
      date = new Date(parsed.year, (parsed.index - 1) * 6, 1)
      label = `H${parsed.index} ${parsed.year}`
      break
    case 'quarter':
      date = new Date(parsed.year, (parsed.index - 1) * 3, 1)
      label = `Q${parsed.index} ${parsed.year}`
      break
    case 'month':
      date = new Date(parsed.year, parsed.index, 1)
      label = MONTH_NAMES[parsed.index]
      break
    case 'week': {
      const m = parsed.month!
      const firstDay = new Date(parsed.year, m, 1)
      date = new Date(firstDay)
      while (date.getDay() !== 1) date.setDate(date.getDate() + 1)
      date.setDate(date.getDate() + (parsed.index - 1) * 7)
      label = `Неделя ${parsed.index}`
      break
    }
  }

  const key = parsed.type === 'week'
    ? `${parsed.year}-${String(parsed.month! + 1).padStart(2, '0')}-W${parsed.index}`
    : getPeriodKey(parsed.type as 'quarter' | 'month' | 'half_year', date!)

  return { key, periodType: parsed.type, date: date!, label }
}

/** Resolve period key (canonical) for Phase 2 tracked goal creation */
function resolveTrackedPeriodKey(goal: ParsedGoal): string {
  if (goal.periodType === 'year') return goal.periodKey

  const parsed = parsePeriodKey(goal.periodKey)
  if (!parsed) return ''

  switch (parsed.type) {
    case 'half_year':
      return getPeriodKey('half_year', new Date(parsed.year, (parsed.index - 1) * 6, 1))
    case 'quarter':
      return getPeriodKey('quarter', new Date(parsed.year, (parsed.index - 1) * 3, 1))
    case 'month':
      return getPeriodKey('month', new Date(parsed.year, parsed.index, 1))
    case 'week':
      return `${parsed.year}-${String(parsed.month! + 1).padStart(2, '0')}-W${parsed.index}`
    default:
      return ''
  }
}

export function useAcceptGoals({ yearGoals, periodGoals, goals, saveYearGoals, savePeriodGoals, addYearGoal, addPeriodGoalBatch, createTrackedGoal, deleteGoal, showMessage }: UseAcceptGoalsDeps) {
  const handleAcceptGoals = useCallback(async (parsedGoals: ParsedGoal[]) => {
    let yearCount = 0, periodCount = 0

    const hierarchyIdMap = new Map<string, number>()
    const hasHierarchy = parsedGoals.some(g => g.hierarchyNumber && g.hierarchyNumber.includes('.'))
    const incomingYearGoals = new Map<number, string[]>()

    // ===== ФАЗА 1: Группируем period goals по ключу, сохраняем batch-ом =====
    const periodBatches = new Map<string, { periodType: 'week' | 'month' | 'quarter' | 'half_year' | 'year'; date: Date; label: string; texts: string[] }>()

    for (const goal of parsedGoals) {
      if (goal.periodType === 'year') {
        const year = parseInt(goal.periodKey, 10)
        if (!isNaN(year)) {
          const yearTexts = incomingYearGoals.get(year) || []
          yearTexts.push(goal.text)
          incomingYearGoals.set(year, yearTexts)
          yearCount++
        }
        continue
      }

      const resolved = resolveGoalPeriod(goal)
      if (!resolved) continue

      const batch = periodBatches.get(resolved.key)
      if (batch) {
        batch.texts.push(goal.text)
      } else {
        periodBatches.set(resolved.key, { periodType: resolved.periodType, date: resolved.date, label: resolved.label, texts: [goal.text] })
      }
      periodCount++
    }

    const affectedPeriodKeys = new Set(periodBatches.keys())
    const affectedYearKeys = new Set(Array.from(incomingYearGoals.keys()).map(String))
    const goalsToDelete = (goalsState: Goal[]) => goalsState
      .filter((goal) => !goal.completed && (affectedPeriodKeys.has(goal.periodKey) || affectedYearKeys.has(goal.periodKey)))
      .sort((a, b) => (b.parentId ? 1 : 0) - (a.parentId ? 1 : 0))

    const uncompletedGoalsToDelete = goalsToDelete(goals)
    for (const goal of uncompletedGoalsToDelete) {
      await deleteGoal(goal.id)
    }

    for (const [year, newTexts] of incomingYearGoals) {
      const currentTexts = yearGoals.get(year) || []
      const completedTexts = getCompletedTextsForPeriod(String(year), currentTexts, goals)
      await saveYearGoals(year, dedupeGoals([...completedTexts, ...newTexts]))
    }

    for (const [key, batch] of periodBatches) {
      const currentTexts = periodGoals.get(key) || []
      const completedTexts = getCompletedTextsForPeriod(key, currentTexts, goals)
      await savePeriodGoals(batch.periodType, batch.date, dedupeGoals([...completedTexts, ...batch.texts]), batch.label)
    }

    for (const [year, texts] of incomingYearGoals) {
      for (const text of dedupeGoals(texts)) {
        addYearGoal(year, text)
      }
    }

    for (const [key, batch] of periodBatches) {
      addPeriodGoalBatch(key, batch.periodType, batch.date, batch.label, dedupeGoals(batch.texts))
    }

    const parts: string[] = []
    if (yearCount > 0) parts.push(`${yearCount} годовых`)
    if (periodCount > 0) parts.push(`${periodCount} по периодам`)
    showMessage(`Добавлено: ${parts.join(', ')} (всего ${parsedGoals.length})`)

    // ===== ФАЗА 2: Создать tracked goals с parentId (последовательно) =====
    if (hasHierarchy) {
      for (const goal of parsedGoals) {
        if (!goal.hierarchyNumber) continue

        const periodKey = resolveTrackedPeriodKey(goal)
        if (!periodKey) continue

        let parentId: number | null = null
        const parentNum = goal.hierarchyNumber.split('.').slice(0, -1).join('.')
        if (parentNum) parentId = hierarchyIdMap.get(parentNum) || null

        const tracked = await createTrackedGoal(periodKey, goal.text, 0, [], parentId)
        if (tracked) hierarchyIdMap.set(goal.hierarchyNumber, tracked.id)
      }
    }
  }, [yearGoals, periodGoals, goals, saveYearGoals, savePeriodGoals, addYearGoal, addPeriodGoalBatch, createTrackedGoal, deleteGoal, showMessage])

  return handleAcceptGoals
}
