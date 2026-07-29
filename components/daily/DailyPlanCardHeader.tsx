'use client'

import PlanLensSwitch, { type PlanLens } from './PlanLensSwitch'
import type { DailyPhase } from '@/hooks/daily/phase-helpers'

type DailyPlanCardHeaderProps = {
  currentTime: string | null
  completedCount: number
  totalCount: number
  completionPercent: number
  extraDoneCount: number
  lens: PlanLens
  onLensChange: (lens: PlanLens) => void
  timelineDisabled: boolean
  timelineBusy: boolean
  phase: DailyPhase
  evaluating: boolean
  canEvaluate: boolean
  onEvaluate: () => void
}

export default function DailyPlanCardHeader({
  currentTime,
  completedCount,
  totalCount,
  completionPercent,
  extraDoneCount,
  lens,
  onLensChange,
  timelineDisabled,
  timelineBusy,
  phase,
  evaluating,
  canEvaluate,
  onEvaluate,
}: DailyPlanCardHeaderProps) {
  const isExecution = phase === 'execution'
  const isSummary = phase === 'summary'
  return (
    <div className="daily-phase-accent mb-4 flex flex-shrink-0 flex-wrap items-start justify-between gap-3 lg:pr-6" data-phase={phase}>
      <div className="flex flex-shrink-0 items-baseline gap-2 whitespace-nowrap">
        <h2 className="text-xl font-bold">План на день</h2>
        <span
          className="inline-block text-base font-semibold tabular-nums leading-none tracking-tight text-gray-400"
          aria-label={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
          title={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
        >
          <span className={currentTime ? undefined : 'text-transparent'} suppressHydrationWarning>
            {currentTime ?? '00:00'}
          </span>
        </span>
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-2 sm:w-auto sm:justify-end">
        {totalCount > 0 && (
          <span className={`whitespace-nowrap tabular-nums leading-none tracking-tight ${isExecution ? 'text-xl font-bold' : 'text-base font-semibold'} ${
            completionPercent === 100 ? 'text-green-400' :
            completionPercent > 0 ? 'text-amber-400' :
            'text-gray-400'
          }`}>
            {isExecution ? `${completedCount}/${totalCount} · ${completionPercent}%` : `${completedCount}/${totalCount} (${completionPercent}%)`}
            {extraDoneCount > 0 && ` +${extraDoneCount}`}
          </span>
        )}
        {isSummary && (
          <button
            type="button"
            onClick={onEvaluate}
            disabled={!canEvaluate || evaluating}
            className="btn-primary min-h-10 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            {evaluating ? 'Анализирую…' : 'Оценить день'}
          </button>
        )}
        <PlanLensSwitch
          value={lens}
          onChange={onLensChange}
          timelineDisabled={timelineDisabled}
          timelineBusy={timelineBusy}
        />
      </div>
    </div>
  )
}
