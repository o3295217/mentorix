import { describe, expect, it } from 'vitest'
import { deriveCompletedTaskTexts, selectGoalsToComplete } from '@/lib/goal-task-match'

describe('deriveCompletedTaskTexts', () => {
  it('собирает отмеченные строки плана и внеплан', () => {
    const texts = deriveCompletedTaskTexts({
      planText: 'Написать статью\nСозвон с командой\nОплатить хостинг',
      selectedTasksJson: [1, 3],
      extraTasksJson: ['Внеплановая задача'],
    })
    expect(texts).toEqual(['Написать статью', 'Оплатить хостинг', 'Внеплановая задача'])
  })

  it('игнорирует id вне диапазона плана и пустые значения', () => {
    const texts = deriveCompletedTaskTexts({
      planText: 'Одна задача',
      selectedTasksJson: '[0, 1, 5]',
      extraTasksJson: null,
    })
    expect(texts).toEqual(['Одна задача'])
  })
})

describe('selectGoalsToComplete', () => {
  const day = new Date(2026, 8, 1) // 1 сентября 2026

  it('отмечает цель прошедшего периода: задача августа, выполненная 1 сентября', () => {
    const goals = [
      { id: 1, text: 'Запустить лендинг', periodKey: '2026-08-W4' },
      { id: 2, text: 'Запустить лендинг', periodKey: '2026-08' },
    ]
    const picked = selectGoalsToComplete(goals, ['Запустить лендинг'], day)
    expect(picked.map(g => g.id)).toEqual([1, 2])
  })

  it('не трогает цели будущих периодов с тем же текстом', () => {
    const goals = [
      { id: 1, text: 'Запустить лендинг', periodKey: '2026-09-W1' }, // текущая неделя (пн 31.08)
      { id: 2, text: 'Запустить лендинг', periodKey: '2026-09-W3' }, // будущая неделя
      { id: 3, text: 'Запустить лендинг', periodKey: '2026-10' },    // будущий месяц
    ]
    const picked = selectGoalsToComplete(goals, ['Запустить лендинг'], day)
    expect(picked.map(g => g.id)).toEqual([1])
  })

  it('не отмечает цели с несовпадающим текстом и не падает без задач', () => {
    const goals = [{ id: 1, text: 'Запустить лендинг', periodKey: '2026-08' }]
    expect(selectGoalsToComplete(goals, ['Сходить в спортзал'], day)).toEqual([])
    expect(selectGoalsToComplete(goals, [], day)).toEqual([])
  })

  it('матчит нестрого — как areTasksSimilar (вхождение текста цели в задачу)', () => {
    const goals = [{ id: 1, text: 'Запустить лендинг проекта', periodKey: '2026-08' }]
    const picked = selectGoalsToComplete(goals, ['Запустить лендинг проекта до вечера'], day)
    expect(picked.map(g => g.id)).toEqual([1])
  })
})
