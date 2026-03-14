'use client'

import { monthNames } from '@/lib/goals-utils'

interface MonthTimelineProps {
  year: number
  selectedMonth: number
  onSelectMonth: (month: number) => void
  currentYear: number
  currentMonth: number
  periodGoals: Map<string, string[]>
  calculatePeriodProgress: (key: string) => { total: number; completed: number; percent: number }
}

export default function MonthTimeline({
  year,
  selectedMonth,
  onSelectMonth,
  currentYear,
  currentMonth,
  periodGoals,
  calculatePeriodProgress,
}: MonthTimelineProps) {
  return (
    <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm py-3 -mx-1 px-1 border-b border-gray-800/50">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 12 }, (_, i) => {
          const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`
          const goals = periodGoals.get(monthKey) || []
          const progress = calculatePeriodProgress(monthKey)
          const isSelected = i === selectedMonth
          const isCurrent = year === currentYear && i === currentMonth
          const shortName = monthNames[i].slice(0, 3)

          return (
            <button
              key={i}
              onClick={() => onSelectMonth(i)}
              className={`
                relative flex-1 min-w-[44px] sm:min-w-[56px] px-1 sm:px-1.5 py-1.5 sm:py-2 rounded-lg text-center transition-all
                ${isSelected
                  ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                  : isCurrent
                    ? 'bg-gray-800/50 border border-blue-500/20 text-gray-200'
                    : 'border border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                }
              `}
            >
              <span className="text-xs font-medium block">{shortName}</span>
              {goals.length > 0 && (
                <div className="mt-1 flex justify-center">
                  <div className="w-8 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? 'bg-blue-400' : 'bg-gray-500'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}
              {goals.length > 0 && (
                <span className="text-[9px] text-gray-600 mt-0.5 block tabular-nums">{goals.length}</span>
              )}
              {isCurrent && !isSelected && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
