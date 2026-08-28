'use client'

import type { FactItem, PeriodGoalItem } from '@/hooks/daily/types'

export type PeriodContextAccent = 'blue' | 'purple'

interface AccentClasses {
  card: string
  title: string
  list: string
  addButton: string
  factsBorder: string
  factsLabel: string
  factsToggle: string
  factsCheck: string
}

const ACCENT_CLASSES: Record<PeriodContextAccent, AccentClasses> = {
  blue: {
    card: 'bg-blue-500/10 border-blue-500/20',
    title: 'text-blue-200',
    list: 'text-blue-300',
    addButton: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/20 hover:text-blue-200',
    factsBorder: 'border-blue-500/20',
    factsLabel: 'text-blue-300',
    factsToggle: 'text-blue-400',
    factsCheck: 'text-blue-500',
  },
  purple: {
    card: 'bg-purple-500/10 border-purple-500/20',
    title: 'text-purple-200',
    list: 'text-purple-300',
    addButton: 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/20 hover:text-purple-200',
    factsBorder: 'border-purple-500/20',
    factsLabel: 'text-purple-300',
    factsToggle: 'text-purple-400',
    factsCheck: 'text-purple-500',
  },
}

/** Согласование числительного с русским словом «дело» (1 дело, 2 дела, 5 дел, 11 дел...). */
export function getWorkNoun(count: number): string {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'дел'
  if (lastDigit === 1) return 'дело'
  if (lastDigit >= 2 && lastDigit <= 4) return 'дела'
  return 'дел'
}

/** Текст сводки строки-аккордеона «Сделано» внутри карточки периода. */
export function getFactsSummaryLabel(count: number): string {
  return `Сделано: ${count} ${getWorkNoun(count)}`
}

interface PeriodContextCardProps {
  accent: PeriodContextAccent
  label: string
  goals: PeriodGoalItem[]
  planTaskMutationLocked: boolean
  isGoalCompleted: (goalText: string) => boolean
  addGoalToTasks: (goalText: string) => void
  factsTotal: number
  facts: FactItem[]
  showFacts: boolean
  onToggleFacts: () => void
}

export default function PeriodContextCard({
  accent,
  label,
  goals,
  planTaskMutationLocked,
  isGoalCompleted,
  addGoalToTasks,
  factsTotal,
  facts,
  showFacts,
  onToggleFacts,
}: PeriodContextCardProps) {
  const c = ACCENT_CLASSES[accent]

  return (
    <div className={`rounded-lg border p-4 ${c.card}`}>
      <h3 className={`mb-3 text-lg font-semibold ${c.title}`}>{label}</h3>

      {goals.length > 0 && (
        <ul className={`space-y-1.5 text-base ${c.list}`}>
          {goals.map((goal, index) => {
            const completedInPeriod = goal.completed
            const completedToday = isGoalCompleted(goal.text)
            const completed = completedInPeriod || completedToday
            return (
              <li key={index} className="flex min-w-0 items-start gap-2 leading-normal">
                <span className={completed ? 'text-green-400' : 'text-gray-500'}>
                  {completed ? '✓' : '•'}
                </span>
                <span className={`min-w-0 flex-1 break-words pt-2.5 lg:pt-0 ${completed ? 'text-green-400' : ''}`}>
                  {goal.text}
                </span>
                {!completed && (
                  <button
                    onClick={() => addGoalToTasks(goal.text)}
                    disabled={planTaskMutationLocked}
                    className={`flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-md px-3 text-lg font-medium leading-none disabled:cursor-not-allowed disabled:opacity-45 lg:h-auto lg:min-w-0 lg:py-1.5 ${c.addButton}`}
                    title="Добавить в план дня"
                    aria-label="Добавить в план дня"
                  >
                    →
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {factsTotal > 0 && (
        <div className={`mt-3 border-t pt-1 ${c.factsBorder}`}>
          <button
            onClick={onToggleFacts}
            className="flex w-full items-center justify-between gap-2 py-1.5 text-left"
            aria-expanded={showFacts}
          >
            <span className={`text-xs font-medium ${c.factsLabel}`}>{getFactsSummaryLabel(factsTotal)}</span>
            <span className={`text-xs ${c.factsToggle}`}>{showFacts ? '▲ скрыть' : '▼ показать'}</span>
          </button>
          {showFacts && (
            <div className="mt-2 space-y-1 lg:max-h-48 lg:overflow-y-auto">
              {facts.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={c.factsCheck}>✓</span>
                  <span className="min-w-0 break-words text-gray-300">{item.text}</span>
                  {item.category && (
                    <span className={`ml-auto text-[10px] ${
                      item.category === 'стратегические' ? 'text-orange-400' :
                      item.category === 'операционные' ? 'text-blue-400' : 'text-gray-500'
                    }`}>{item.category}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
