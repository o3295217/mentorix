'use client'

import { getDetailLevel } from '@/lib/dates'

interface TimelineNavProps {
  years: number[]
  selectedYear: number
  selectedQuarter: number
  currentYear: number
  currentQuarter: number
  onSelectYear: (year: number) => void
  onSelectQuarter: (quarter: number) => void
}

export default function TimelineNav({
  years,
  selectedYear,
  selectedQuarter,
  currentYear,
  currentQuarter,
  onSelectYear,
  onSelectQuarter,
}: TimelineNavProps) {
  const detailLevel = getDetailLevel(selectedYear, currentYear)

  return (
    <div className="space-y-3">
      {/* Годы — горизонтальные чипы */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {years.map(year => {
          const isSelected = year === selectedYear
          const isCurrent = year === currentYear
          return (
            <button
              key={year}
              onClick={() => onSelectYear(year)}
              className={`relative flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {year}
              {isCurrent && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Периоды — табы (кварталы или полугодия) */}
      {detailLevel !== 'year' && (
        <div className="flex border-b border-gray-800">
          {detailLevel === 'half' ? (
            // Полугодия для дальних лет
            [1, 2].map(half => {
              const isSelected = selectedQuarter === half
              const label = half === 1 ? '1-е полугодие' : '2-е полугодие'
              return (
                <button
                  key={half}
                  onClick={() => onSelectQuarter(half)}
                  className={`relative px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                    isSelected
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              )
            })
          ) : (
            // Кварталы для текущего и ближнего года
            [1, 2, 3, 4].map(quarter => {
              const isSelected = quarter === selectedQuarter
              const isCurrent = selectedYear === currentYear && quarter === currentQuarter
              return (
                <button
                  key={quarter}
                  onClick={() => onSelectQuarter(quarter)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
                    isSelected
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-700'
                  }`}
                >
                  Q{quarter}
                  {isCurrent && (
                    <span className="text-[10px] px-1 py-px rounded bg-blue-500/15 text-blue-400">
                      сейчас
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
