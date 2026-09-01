import { describe, expect, it } from 'vitest'
import { collectCarryoverItems, formatCarriedFrom, formatMonthGenitive, prevMonthOf } from '@/lib/carryover'

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
  const sources = [
    { key: '2026-08', type: 'month' as const, texts: ['Запустить лендинг', 'Написать статью'] },
    { key: '2026-08-W4', type: 'week' as const, texts: ['Написать статью', 'Собрать отчёт'] },
  ]

  it('собирает незакрытое, дедуплицируя месяц и недели (месячный источник в приоритете)', () => {
    const items = collectCarryoverItems({ sources, tracked: [], currentMonthTexts: [], openTaskTexts: [] })
    expect(items).toEqual([
      { text: 'Запустить лендинг', fromKey: '2026-08', fromType: 'month' },
      { text: 'Написать статью', fromKey: '2026-08', fromType: 'month' },
      { text: 'Собрать отчёт', fromKey: '2026-08-W4', fromType: 'week' },
    ])
  })

  it('исключает выполненные (tracked-запись с completed в том же периоде)', () => {
    const items = collectCarryoverItems({
      sources,
      tracked: [{ periodKey: '2026-08', text: 'Запустить лендинг', completed: true }],
      currentMonthTexts: [],
      openTaskTexts: [],
    })
    expect(items.map(i => i.text)).toEqual(['Написать статью', 'Собрать отчёт'])
  })

  it('с monthKey выполненность ищется по всему прошлому месяцу (текст переносили между неделями)', () => {
    const items = collectCarryoverItems({
      sources: [{ key: '2026-08-W4', type: 'week', texts: ['Опубликовать сайт AIONLAB'] }],
      tracked: [{ periodKey: '2026-08-W3', text: 'Опубликовать сайт AIONLAB', completed: true }],
      currentMonthTexts: [],
      openTaskTexts: [],
      monthKey: '2026-08',
    })
    expect(items).toHaveLength(0)
  })

  it('с monthKey выполненная в другом месяце запись не закрывает цель', () => {
    const items = collectCarryoverItems({
      sources: [{ key: '2026-08-W4', type: 'week', texts: ['Опубликовать сайт AIONLAB'] }],
      tracked: [{ periodKey: '2026-09-W1', text: 'Опубликовать сайт AIONLAB', completed: true }],
      currentMonthTexts: [],
      openTaskTexts: [],
      monthKey: '2026-08',
    })
    expect(items).toHaveLength(1)
  })

  it('не считает закрытой цель, выполненную в другом периоде', () => {
    const items = collectCarryoverItems({
      sources: [{ key: '2026-08', type: 'month', texts: ['Запустить лендинг'] }],
      tracked: [{ periodKey: '2026-07', text: 'Запустить лендинг', completed: true }],
      currentMonthTexts: [],
      openTaskTexts: [],
    })
    expect(items).toHaveLength(1)
  })

  it('исключает уже перенесённое в текущий месяц и уже отправленное в задачи', () => {
    const items = collectCarryoverItems({
      sources,
      tracked: [],
      currentMonthTexts: ['Написать статью'],
      openTaskTexts: ['Собрать отчёт'],
    })
    expect(items.map(i => i.text)).toEqual(['Запустить лендинг'])
  })
})
