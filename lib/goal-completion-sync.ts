// Синхронизация «выполненная задача дня → tracked-цель» (запись в БД).
// Чистая логика отбора — в lib/goal-task-match.ts.

import { prisma } from '@/lib/prisma'
import { safeParseJsonArray } from '@/lib/fact-utils'
import { syncCompletedWorkForGoal } from '@/lib/completed-work'
import { selectGoalsToComplete } from '@/lib/goal-task-match'

/**
 * Отмечает выполненными незавершённые tracked-цели, чей текст совпал
 * с выполненными задачами дня. Побочные эффекты — те же, что при ручной
 * отметке на странице целей (historyJson, completedAt, CompletedWork).
 * Снятие галочки с задачи цель обратно НЕ снимает — выполненность цели
 * отменяется только вручную. Возвращает число отмеченных целей.
 */
export async function completeTrackedGoalsForTasks(params: {
  userId: string
  date: Date
  taskTexts: string[]
}): Promise<number> {
  const { userId, date, taskTexts } = params
  if (taskTexts.filter(Boolean).length === 0) return 0

  const openGoals = await prisma.goal.findMany({
    where: { userId, completed: false },
    select: { id: true, text: true, periodKey: true, historyJson: true },
  })
  const toComplete = selectGoalsToComplete(openGoals, taskTexts, date)

  for (const goal of toComplete) {
    const history = safeParseJsonArray<{ type: string; date: string }>(goal.historyJson)
    history.push({ type: 'completed', date: new Date().toISOString() })
    await prisma.goal.update({
      where: { id: goal.id },
      data: { completed: true, completedAt: date, historyJson: history },
    })
    await syncCompletedWorkForGoal({
      userId,
      goalId: goal.id,
      goalText: goal.text,
      periodKey: goal.periodKey,
      completedAt: date,
    })
  }
  return toComplete.length
}
