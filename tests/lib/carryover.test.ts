import { describe, expect, it } from 'vitest'
import { collectCarryoverItems, formatCarriedFrom, formatMonthGenitive, prevMonthOf, CarryoverGoalRow } from '@/lib/carryover'

describe('prevMonthOf', () => {
  it('обычный месяц: сентябрь 2026 → август 2026', () => {
    expect(prevMonthOf(new Date(2026, 8, 1))).toEqual({ year: 2026, month: 7, key: '2026-08' })
  })

  it('январь откатывается на декабрь прошлого года', () => {
    expect(prevMonthOf(new Date(2026, 0, 15))).toEqual({ year: 2025, month: 11, key: '2025-12' })
  })
})

describe('formatMonthGenitive / formatCarriedFrom', () => {
  it('склоняет месяц', () => {
    expect(formatMonthGenitive('2026-08')).toBe('августа 2026')
    expect(formatCarriedFrom('2026-08')).toBe('из августа 2026')
  })
})

describe('collectCarryoverItems', () => {
  const prevMonthKey = '2026-08'
  const prevKeys = ['2026-08', '2026-08-W1', '2026-08-W2', '2026-08-W3', '2026-08-W4']

  const rows: CarryoverGoalRow[] = [
    { id: 1, text: 'Запустить лендинг', periodKey: '2026-08', completed: false },
    { id: 2, text: 'Написать статью', periodKey: '2026-08-W4', completed: false },
    { id: 3, text: 'Запустить лендинг', periodKey: '2026-08-W3', completed: false }, // недельный дубль месячной
    { id: 4, text: 'Собрать отчёт', periodKey: '2026-08-W4', completed: true }, // выполнена
    { id: 5, text: 'Цель сентября', periodKey: '2026-09-W2', completed: false }, // не прошлый месяц
  ]

  it('собирает незакрытое прошлого месяца, месячные в приоритете при дедупе', () => {
    const items = collectCarryoverItems({ prevMonthKey, prevKeys, rows, currentMonthTexts: [], openTaskTexts: [] })
    expect(items).toEqual([
      { goalId: 1, text: 'Запустить лендинг', fromKey: '2026-08', fromType: 'month' },
      { goalId: 2, text: 'Написать статью', fromKey: '2026-08-W4', fromType: 'week' },
    ])
  })

  it('исключает уже перенесённое в текущий месяц и уже отправленное в задачи', () => {
    const items = collectCarryoverItems({
      prevMonthKey,
      prevKeys,
      rows,
      currentMonthTexts: ['Написать статью'],
      openTaskTexts: ['Запустить лендинг'],
    })
    expect(items).toEqual([])
  })

  it('выполненная запись не попадает в список независимо от недели', () => {
    const items = collectCarryoverItems({
      prevMonthKey,
      prevKeys,
      rows: [{ id: 7, text: 'Опубликовать сайт AIONLAB', periodKey: '2026-08-W4', completed: true }],
      currentMonthTexts: [],
      openTaskTexts: [],
    })
    expect(items).toEqual([])
  })
})
