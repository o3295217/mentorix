'use client'

import type { DailyScheduleBlockCategory, DailyScheduleLoadSummary } from '@/lib/daily-schedule'
import { formatDurationLabel } from '@/hooks/daily/schedule-helpers'

// Shared between the day timeline and the schedule proposal card in chat — both
// render the same DailyScheduleLoadSummary shape and should look identical.
export const SCHEDULE_LOAD_CATEGORY_LABELS: Record<DailyScheduleBlockCategory, string> = {
  main: 'главное',
  operational: 'операц.',
  travel: 'дорога',
  personal: 'личное',
  meal: 'еда',
  rest: 'отдых',
  buffer: 'буфер',
}

// Exported so other views of the same schedule data (e.g. the chat proposal card's
// block rows) can reuse the exact same category colors instead of inventing new ones.
export const CATEGORY_BAR_COLOR: Record<DailyScheduleBlockCategory, string> = {
  main: 'bg-primary-500',
  operational: 'bg-purple-500',
  travel: 'bg-cyan-500',
  personal: 'bg-pink-500',
  meal: 'bg-orange-500',
  rest: 'bg-emerald-500',
  buffer: 'bg-gray-500',
}

// Fixed render order so bar segments and legend entries always line up the same way.
const CATEGORY_ORDER: DailyScheduleBlockCategory[] = ['main', 'operational', 'travel', 'personal', 'meal', 'rest', 'buffer']

export interface ScheduleLoadSummaryProps {
  summary: DailyScheduleLoadSummary
  className?: string
}

export default function ScheduleLoadSummary({ summary, className = '' }: ScheduleLoadSummaryProps) {
  const activeCategories = CATEGORY_ORDER.filter(category => (summary.categories[category]?.minutes ?? 0) > 0)
  const isOverloaded = summary.loadLevel === 'overloaded'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <p className="text-sm text-gray-300">
        Занято <span className="font-medium text-gray-100">{formatDurationLabel(summary.scheduledMinutes)}</span>
        {' '}· свободно <span className="font-medium text-gray-100">{formatDurationLabel(summary.unscheduledMinutes)}</span>
      </p>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-gray-800"
        role="img"
        aria-label={`Занято ${formatDurationLabel(summary.scheduledMinutes)} из ${formatDurationLabel(summary.activeInterval.availableMinutes)}, свободно ${formatDurationLabel(summary.unscheduledMinutes)}`}
      >
        {activeCategories.map(category => (
          <div
            key={category}
            className={CATEGORY_BAR_COLOR[category]}
            style={{ width: `${summary.categories[category].percent}%` }}
          />
        ))}
      </div>

      {activeCategories.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          {activeCategories.map(category => (
            <span key={category} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_BAR_COLOR[category]}`} aria-hidden />
              {SCHEDULE_LOAD_CATEGORY_LABELS[category]} {formatDurationLabel(summary.categories[category].minutes)}
            </span>
          ))}
        </div>
      )}

      {isOverloaded ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-amber-300" role="status">
          <span aria-hidden>⚠</span>
          {summary.recommendation}
        </p>
      ) : (
        <p className="text-xs text-gray-500">{summary.recommendation}</p>
      )}
    </div>
  )
}
