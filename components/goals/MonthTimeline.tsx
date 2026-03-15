'use client'

import { monthNames } from '@/lib/goals-utils'
import { GoalTag } from '@/lib/types'

// Tag color palette for pills (when tag has no custom color)
const PILL_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-violet-500/20 text-violet-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-cyan-500/20 text-cyan-300',
]

interface MonthTimelineProps {
  year: number
  selectedMonth: number
  onSelectMonth: (month: number) => void
  currentYear: number
  currentMonth: number
  periodGoals: Map<string, string[]>
  calculatePeriodProgress: (key: string) => { total: number; completed: number; percent: number }
  tags?: GoalTag[]
}

export default function MonthTimeline({
  year,
  selectedMonth,
  onSelectMonth,
  currentYear,
  currentMonth,
  periodGoals,
  calculatePeriodProgress,
  tags: _tags,
}: MonthTimelineProps) {
  return (
    <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md py-3 -mx-1 px-1 border-b border-slate-800/50">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {Array.from({ length: 12 }, (_, i) => {
          const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`
          const goals = periodGoals.get(monthKey) || []
          const progress = calculatePeriodProgress(monthKey)
          const isSelected = i === selectedMonth
          const isCurrent = year === currentYear && i === currentMonth
          const shortName = monthNames[i].slice(0, 3)

          // Show first 2 goals as pills (truncated)
          const previewGoals = goals.slice(0, 2)

          return (
            <button
              key={i}
              onClick={() => onSelectMonth(i)}
              className={`
                relative flex-1 min-w-[52px] sm:min-w-[64px] px-1 sm:px-1.5 py-1.5 sm:py-2 rounded-xl text-center transition-all
                ${isSelected
                  ? 'bg-gradient-to-b from-blue-500/20 to-blue-500/5 border border-blue-500/30 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                  : isCurrent
                    ? 'bg-slate-800/50 border border-blue-400/20 text-slate-200'
                    : 'border border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                }
              `}
            >
              <span className="text-sm font-medium block">{shortName}</span>
              {goals.length > 0 && (
                <div className="mt-1 flex justify-center">
                  <div className="w-8 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? 'bg-blue-400' : 'bg-slate-600'}`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}
              {/* Goal preview pills */}
              {previewGoals.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 items-center">
                  {previewGoals.map((goal, gi) => (
                    <span
                      key={gi}
                      className={`block max-w-full truncate rounded-md px-1 py-px text-[9px] leading-tight font-medium ${
                        PILL_COLORS[gi % PILL_COLORS.length]
                      }`}
                      title={goal}
                    >
                      {goal.length > 12 ? goal.slice(0, 11) + '…' : goal}
                    </span>
                  ))}
                  {goals.length > 2 && (
                    <span className="text-[8px] text-slate-600 tabular-nums">+{goals.length - 2}</span>
                  )}
                </div>
              )}
              {goals.length > 0 && previewGoals.length === 0 && (
                <span className="text-[9px] text-slate-600 mt-0.5 block tabular-nums">{goals.length}</span>
              )}
              {isCurrent && !isSelected && (
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
