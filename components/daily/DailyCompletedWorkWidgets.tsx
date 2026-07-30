'use client'

import type { FactItem } from '@/hooks/daily/types'

interface DailyCompletedWorkWidgetsProps {
  weekFactsTotal: number
  monthFactsTotal: number
  weekFacts: FactItem[]
  monthFacts: FactItem[]
  showWeekFacts: boolean
  showMonthFacts: boolean
  onToggleWeekFacts: () => void
  onToggleMonthFacts: () => void
}

function getWorkNoun(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'дел'
  if (lastDigit === 1) return 'дело'
  if (lastDigit >= 2 && lastDigit <= 4) return 'дела'
  return 'дел'
}

export default function DailyCompletedWorkWidgets({
  weekFactsTotal,
  monthFactsTotal,
  weekFacts,
  monthFacts,
  showWeekFacts,
  showMonthFacts,
  onToggleWeekFacts,
  onToggleMonthFacts,
}: DailyCompletedWorkWidgetsProps) {
  return (
      (weekFactsTotal > 0 || monthFactsTotal > 0) && (
        <div className={`grid grid-cols-1 ${weekFactsTotal > 0 && monthFactsTotal > 0 ? 'md:grid-cols-2' : ''} gap-4`}>
          {/* Сделано за неделю */}
          {weekFactsTotal > 0 && (
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
            <button
              onClick={onToggleWeekFacts}
               className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
               aria-expanded={showWeekFacts}
            >
              <h3 className="text-sm font-medium text-blue-300">
                Сделано за неделю: {weekFactsTotal} {getWorkNoun(weekFactsTotal)}
              </h3>
              <span className="text-blue-400 text-xs">{showWeekFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showWeekFacts && (
              <div className="mt-3 space-y-1 lg:max-h-48 lg:overflow-y-auto">
                {weekFacts.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-blue-500">✓</span>
                    <span className="min-w-0 break-words text-gray-300">{item.text}</span>
                    {item.category && (
                      <span className={`text-[10px] ml-auto ${
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

          {/* Сделано за месяц */}
          {monthFactsTotal > 0 && (
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
            <button
              onClick={onToggleMonthFacts}
               className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
               aria-expanded={showMonthFacts}
            >
              <h3 className="text-sm font-medium text-purple-300">
                Сделано за месяц: {monthFactsTotal} {getWorkNoun(monthFactsTotal)}
              </h3>
              <span className="text-purple-400 text-xs">{showMonthFacts ? '▲ скрыть' : '▼ показать'}</span>
            </button>
            {showMonthFacts && (
              <div className="mt-3 space-y-1 lg:max-h-48 lg:overflow-y-auto">
                {monthFacts.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-purple-500">✓</span>
                    <span className="min-w-0 break-words text-gray-300">{item.text}</span>
                    {item.category && (
                      <span className={`text-[10px] ml-auto ${
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
  )
}
