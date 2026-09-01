import { describe, expect, it } from 'vitest'
import { diffPeriodGoalTexts } from '@/lib/period-goals-diff'

describe('diffPeriodGoalTexts', () => {
  const existing = [
    { id: 1, text: 'Запустить лендинг' },
    { id: 2, text: 'Написать статью' },
    { id: 3, text: 'Собрать отчёт' },
  ]

  it('неизменённый список — только sortOrder, без создания и удаления', () => {
    const diff = diffPeriodGoalTexts(existing, ['Запустить лендинг', 'Написать статью', 'Собрать отчёт'])
    expect(diff.create).toEqual([])
    expect(diff.removeIds).toEqual([])
    expect(diff.update).toEqual([
      { id: 1, text: 'Запустить лендинг', sortOrder: 0 },
      { id: 2, text: 'Написать статью', sortOrder: 1 },
      { id: 3, text: 'Собрать отчёт', sortOrder: 2 },
    ])
  })

  it('добавление новой цели создаёт запись, существующие сохраняют id', () => {
    const diff = diffPeriodGoalTexts(existing, ['Запустить лендинг', 'Написать статью', 'Собрать отчёт', 'Новая цель'])
    expect(diff.create).toEqual([{ text: 'Новая цель', sortOrder: 3 }])
    expect(diff.removeIds).toEqual([])
  })

  it('удаление цели из списка удаляет её запись', () => {
    const diff = diffPeriodGoalTexts(existing, ['Запустить лендинг', 'Собрать отчёт'])
    expect(diff.removeIds).toEqual([2])
    expect(diff.create).toEqual([])
  })

  it('переименование на месте сохраняет id (позиционное сопоставление)', () => {
    const diff = diffPeriodGoalTexts(existing, ['Запустить лендинг', 'Совсем другой текст цели', 'Собрать отчёт'])
    expect(diff.create).toEqual([])
    expect(diff.removeIds).toEqual([])
    expect(diff.update).toContainEqual({ id: 2, text: 'Совсем другой текст цели', sortOrder: 1 })
  })

  it('перестановка сохраняет id и меняет sortOrder', () => {
    const diff = diffPeriodGoalTexts(existing, ['Собрать отчёт', 'Запустить лендинг', 'Написать статью'])
    expect(diff.create).toEqual([])
    expect(diff.removeIds).toEqual([])
    expect(diff.update).toContainEqual({ id: 3, text: 'Собрать отчёт', sortOrder: 0 })
    expect(diff.update).toContainEqual({ id: 1, text: 'Запустить лендинг', sortOrder: 1 })
  })

  it('мелкая правка длинного текста матчится нечётко, а не пересоздаёт запись', () => {
    const long = { id: 9, text: 'Опубликовать сайт AIONLAB: главная с миссией, страницы 4 продуктов' }
    const diff = diffPeriodGoalTexts([long], ['Опубликовать сайт AIONLAB: главная с миссией, страницы 5 продуктов'])
    expect(diff.create).toEqual([])
    expect(diff.removeIds).toEqual([])
    expect(diff.update[0].id).toBe(9)
  })

  it('пустые строки во входном списке игнорируются', () => {
    const diff = diffPeriodGoalTexts([], ['  ', 'Цель', ''])
    expect(diff.create).toEqual([{ text: 'Цель', sortOrder: 0 }])
  })
})
