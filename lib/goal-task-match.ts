// Чистая логика связи «выполненная задача дня → tracked-цель».
// Обратное направление уже существует: /api/goals/period динамически матчит
// выполненные задачи с текстами целей, а отметка цели пишет CompletedWork.
// Функции ниже замыкают связь в другую сторону; работа с БД —
// в lib/goal-completion-sync.ts.

import { areTasksSimilar } from '@/lib/task-match'
import { resolvePeriodMeta } from '@/lib/goals-utils'
import { splitLines, safeParseJsonArray } from '@/lib/fact-utils'

// Тексты выполненных задач дня: отмеченные строки плана + внеплан
export function deriveCompletedTaskTexts(params: {
  planText: string | null
  selectedTasksJson: unknown
  extraTasksJson: unknown
}): string[] {
  const planTasks = splitLines(params.planText)
  const selectedIds = safeParseJsonArray<string | number>(params.selectedTasksJson)
    .map(id => Number(id))
    .filter(id => Number.isInteger(id) && id > 0 && id <= planTasks.length)
  const extraTasks = safeParseJsonArray<string>(params.extraTasksJson).filter(Boolean)
  return [...selectedIds.map(id => planTasks[id - 1]), ...extraTasks].filter(Boolean)
}

export interface CandidateGoal {
  id: number
  text: string
  periodKey: string
}

/**
 * Незавершённые цели, которые следует отметить выполненными: текст совпал
 * с выполненной задачей (areTasksSimilar), а период цели уже начался к дате
 * выполнения. Цели БУДУЩИХ периодов с тем же текстом не трогаем — при
 * декомпозиции одна формулировка часто повторяется в нескольких неделях.
 * Прошедшие периоды отмечаем: просроченную цель нередко доделывают позже
 * (задача августа, выполненная 1 сентября, должна закрыть августовскую цель).
 */
export function selectGoalsToComplete<T extends CandidateGoal>(
  goals: T[],
  taskTexts: string[],
  date: Date
): T[] {
  const texts = taskTexts.filter(Boolean)
  if (texts.length === 0) return []
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  return goals.filter(goal => {
    const meta = resolvePeriodMeta(goal.periodKey)
    if (!meta || meta.date > endOfDay) return false
    return texts.some(task => areTasksSimilar(goal.text, task))
  })
}
