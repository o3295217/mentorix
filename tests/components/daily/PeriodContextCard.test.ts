import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PeriodContextCard, { getFactsSummaryLabel, getWorkNoun } from '@/components/daily/PeriodContextCard'
import type { FactItem, PeriodGoalItem } from '@/hooks/daily/types'

describe('getWorkNoun', () => {
  it('agrees with 1 as "дело"', () => {
    expect(getWorkNoun(1)).toBe('дело')
    expect(getWorkNoun(21)).toBe('дело')
  })

  it('agrees with 2-4 as "дела"', () => {
    expect(getWorkNoun(2)).toBe('дела')
    expect(getWorkNoun(3)).toBe('дела')
    expect(getWorkNoun(4)).toBe('дела')
    expect(getWorkNoun(24)).toBe('дела')
  })

  it('agrees with 0, 5-20 and 11-14 as "дел"', () => {
    expect(getWorkNoun(0)).toBe('дел')
    expect(getWorkNoun(5)).toBe('дел')
    expect(getWorkNoun(11)).toBe('дел')
    expect(getWorkNoun(12)).toBe('дел')
    expect(getWorkNoun(14)).toBe('дел')
    expect(getWorkNoun(20)).toBe('дел')
  })
})

describe('getFactsSummaryLabel', () => {
  it('formats the collapsed accordion row text', () => {
    expect(getFactsSummaryLabel(1)).toBe('Сделано: 1 дело')
    expect(getFactsSummaryLabel(3)).toBe('Сделано: 3 дела')
    expect(getFactsSummaryLabel(11)).toBe('Сделано: 11 дел')
  })
})

const baseGoals: PeriodGoalItem[] = [
  { text: 'Закрыть спринт', completed: false },
  { text: 'Пробежать 10км', completed: true },
]

const baseFacts: FactItem[] = [
  { id: 1, text: 'Провёл ретро', type: 'task', category: 'операционные' },
  { id: 2, text: 'Написал отчёт', type: 'task', category: null },
]

function renderCard(overrides: Partial<Parameters<typeof PeriodContextCard>[0]> = {}) {
  const props = {
    accent: 'blue' as const,
    label: 'Неделя 24-30 авг',
    goals: baseGoals,
    planTaskMutationLocked: false,
    isGoalCompleted: () => false,
    addGoalToTasks: vi.fn(),
    factsTotal: 0,
    facts: [],
    showFacts: false,
    onToggleFacts: vi.fn(),
    ...overrides,
  }
  return renderToStaticMarkup(createElement(PeriodContextCard, props))
}

describe('PeriodContextCard', () => {
  it('renders the period label and goal list', () => {
    const html = renderCard()
    expect(html).toContain('Неделя 24-30 авг')
    expect(html).toContain('Закрыть спринт')
    expect(html).toContain('Пробежать 10км')
  })

  it('shows the "add to plan" arrow only for incomplete goals', () => {
    const html = renderCard()
    expect(html).toContain('Добавить в план дня')
    // Только одна незавершённая цель из двух — одна кнопка.
    expect(html.match(/aria-label="Добавить в план дня"/g)?.length).toBe(1)
  })

  it('treats a goal completed today (via isGoalCompleted) as completed even if the period status says otherwise', () => {
    const html = renderCard({ isGoalCompleted: (text) => text === 'Закрыть спринт' })
    expect(html.match(/aria-label="Добавить в план дня"/g)).toBeNull()
  })

  it('does not render the facts accordion row when factsTotal is 0', () => {
    const html = renderCard({ factsTotal: 0, facts: [] })
    expect(html).not.toContain('Сделано:')
  })

  it('renders the collapsed facts accordion row with the summary label and hides items', () => {
    const html = renderCard({ factsTotal: 2, facts: baseFacts, showFacts: false })
    expect(html).toContain('Сделано: 2 дела')
    expect(html).toContain('▼ показать')
    expect(html).not.toContain('Провёл ретро')
  })

  it('expands the facts list when showFacts is true', () => {
    const html = renderCard({ factsTotal: 2, facts: baseFacts, showFacts: true })
    expect(html).toContain('▲ скрыть')
    expect(html).toContain('Провёл ретро')
    expect(html).toContain('Написал отчёт')
    expect(html).toContain('операционные')
  })

  it('renders nothing for an empty goal list beyond the heading', () => {
    const html = renderCard({ goals: [] })
    expect(html).not.toContain('<ul')
  })
})
