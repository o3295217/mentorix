import { describe, expect, it } from 'vitest'
import { getTaskCategory, getTaskType } from '@/lib/task-categorize'

describe('task categorization', () => {
  it('detects habits by routine words and time prefixes', () => {
    expect(getTaskCategory('07:30 подъём и душ')).toBe('привычки')
    expect(getTaskCategory('Зарядка утром')).toBe('привычки')
    expect(getTaskCategory('Начало работы')).toBe('привычки')
  })

  it('detects calls and meetings', () => {
    expect(getTaskCategory('Оперативка с командой')).toBe('созвоны')
    expect(getTaskCategory('Созвон по проекту')).toBe('созвоны')
    expect(getTaskCategory('Встреча с партнёром')).toBe('созвоны')
    expect(getTaskCategory('Звонок клиенту')).toBe('созвоны')
  })

  it('detects strategic work after higher-priority categories', () => {
    expect(getTaskCategory('Стратегическое планирование бюджета')).toBe('стратегические')
    expect(getTaskCategory('Анализ и разработка проекта')).toBe('стратегические')
    expect(getTaskCategory('Созвон по стратегии')).toBe('созвоны')
  })

  it('defaults to operational and keeps getTaskType alias compatible', () => {
    expect(getTaskCategory('Разобрать почту')).toBe('операционные')
    expect(getTaskType('Разобрать почту')).toBe('операционные')
  })
})