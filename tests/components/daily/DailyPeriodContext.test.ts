import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DailyPeriodContext from '@/components/daily/DailyPeriodContext'
import type { FactItem, PeriodGoalItem } from '@/hooks/daily/types'

const weekGoals: PeriodGoalItem[] = [{ text: 'Сдать модуль', completed: false }]
const monthGoals: PeriodGoalItem[] = [{ text: 'Прочитать книгу', completed: true }]
const weekFacts: FactItem[] = [{ id: 1, text: 'Сделал зарядку', type: 'task', category: null }]
const monthFacts: FactItem[] = [{ id: 2, text: 'Сдал отчёт', type: 'task', category: null }]

function renderContext(overrides: Partial<Parameters<typeof DailyPeriodContext>[0]> = {}) {
  const props = {
    hasGoalContext: true,
    weekLabel: 'Неделя 24-30 авг',
    weekGoals,
    weekFactsTotal: weekFacts.length,
    weekFacts,
    showWeekFacts: false,
    onToggleWeekFacts: vi.fn(),
    monthLabel: 'Август',
    monthGoals,
    monthFactsTotal: monthFacts.length,
    monthFacts,
    showMonthFacts: false,
    onToggleMonthFacts: vi.fn(),
    planTaskMutationLocked: false,
    isGoalCompleted: () => false,
    addGoalToTasks: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(DailyPeriodContext, props))
}

describe('DailyPeriodContext', () => {
  it('shows a call to action when there is no goal context yet, instead of the cards', () => {
    const html = renderContext({ hasGoalContext: false })
    expect(html).toContain('Добавьте цели')
    expect(html).not.toContain('Неделя 24-30 авг')
    expect(html).not.toContain('Август')
  })

  it('renders a week card and a month card side by side, each with its own goals and facts', () => {
    const html = renderContext()
    expect(html).toContain('Неделя 24-30 авг')
    expect(html).toContain('Сдать модуль')
    expect(html).toContain('Август')
    expect(html).toContain('Прочитать книгу')
    expect(html).toContain('Сделано: 1 дело')
  })
})
