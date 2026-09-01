// Чистая логика сверки списка текстов целей периода с записями Goal.
// Единственный источник правды по целям — таблица goals; UI редактирует
// список как массив строк, а этот диф превращает его в точечные операции
// над записями, сохраняя id (и значит выполненность, историю, теги).

import { fuzzyMatchGoal } from '@/lib/goals-utils'

export interface ExistingGoalLite {
  id: number
  text: string
}

export interface PeriodGoalsDiff {
  create: Array<{ text: string; sortOrder: number }>
  update: Array<{ id: number; text: string; sortOrder: number }>
  removeIds: number[]
}

/**
 * Сопоставляет желаемый список текстов с существующими записями:
 * 1) точное совпадение текста; 2) нечёткое (fuzzyMatchGoal);
 * 3) позиционное — текст на той же позиции считается переименованием.
 * Несопоставленные входные тексты создаются, несопоставленные записи удаляются.
 */
export function diffPeriodGoalTexts(existing: ExistingGoalLite[], incoming: string[]): PeriodGoalsDiff {
  const texts = incoming.map(t => t.trim()).filter(Boolean)
  const unmatched = new Map(existing.map((g, pos) => [g.id, { ...g, pos }]))
  const matchedIds: Array<number | null> = texts.map(() => null)

  const claim = (index: number, predicate: (g: { text: string; pos: number }) => boolean) => {
    for (const [id, g] of unmatched) {
      if (predicate(g)) {
        unmatched.delete(id)
        matchedIds[index] = id
        return
      }
    }
  }

  texts.forEach((t, i) => claim(i, g => g.text === t))
  texts.forEach((t, i) => { if (matchedIds[i] === null) claim(i, g => fuzzyMatchGoal(g.text, t)) })
  texts.forEach((_, i) => { if (matchedIds[i] === null) claim(i, g => g.pos === i) })

  const diff: PeriodGoalsDiff = { create: [], update: [], removeIds: [...unmatched.keys()] }
  texts.forEach((text, sortOrder) => {
    const id = matchedIds[sortOrder]
    if (id === null) diff.create.push({ text, sortOrder })
    else diff.update.push({ id, text, sortOrder })
  })
  return diff
}
