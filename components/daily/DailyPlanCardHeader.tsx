'use client'

import PlanLensSwitch, { type PlanLens } from './PlanLensSwitch'
import type { DailyPhase } from '@/hooks/daily/phase-helpers'
import { formatDurationLabel } from '@/hooks/daily/schedule-helpers'
import { BufferTimeIcon, MealRestIcon, PlanListIcon, PlanTimelineIcon } from '@/components/icons'

export type DailyPlanDayMetrics = {
  /** До конца дня (конца активности), мин */
  remainingMinutes: number
  /** Невыполненные задачи на шкале */
  taskCount: number
  taskMinutes: number
  /** Будущие сервисные блоки: еда, отдых, перерывы, личное, дорога */
  restMinutes: number
  /** Остаток − задачи − сервисные; может быть отрицательным */
  bufferMinutes: number
}

const metricPillBase = 'flex cursor-default items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-medium tabular-nums leading-none'
const metricPillNeutral = `${metricPillBase} border-gray-700/70 bg-gray-900/60 text-gray-200`

type DailyPlanCardHeaderProps = {
  currentTime: string | null
  /** Арифметика остатка дня; null — не показывать (нет расписания или не сегодня) */
  dayMetrics?: DailyPlanDayMetrics | null
  completedCount: number
  totalCount: number
  completionPercent: number
  habitCompletedCount: number
  habitTotalCount: number
  extraDoneCount: number
  lens: PlanLens
  onLensChange: (lens: PlanLens) => void
  timelineDisabled: boolean
  timelineBusy: boolean
  phase: DailyPhase
}

export default function DailyPlanCardHeader({
  currentTime,
  dayMetrics = null,
  completedCount,
  totalCount,
  completionPercent,
  habitCompletedCount,
  habitTotalCount,
  extraDoneCount,
  lens,
  onLensChange,
  timelineDisabled,
  timelineBusy,
  phase,
}: DailyPlanCardHeaderProps) {
  const isExecution = phase === 'execution'
  return (
    <div className="daily-phase-accent mb-4 flex flex-shrink-0 flex-wrap items-start justify-between gap-3 lg:pr-6" data-phase={phase}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="type-section-title whitespace-nowrap">План на день</h2>
        <span
          className="type-secondary inline-block font-semibold tabular-nums leading-none tracking-tight"
          aria-label={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
          title={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
        >
          <span className={currentTime ? undefined : 'text-transparent'} suppressHydrationWarning>
            {currentTime ?? '00:00'}
          </span>
        </span>
        {/* Пилюли арифметики дня: до конца · задачи · отдых/еда · буфер (может быть отрицательным) */}
        {dayMetrics !== null && (
          <>
            <span className={metricPillNeutral} title={`До конца дня осталось ${formatDurationLabel(dayMetrics.remainingMinutes)}`}>
              <PlanTimelineIcon className="h-4 w-4 text-gray-400" />
              {formatDurationLabel(dayMetrics.remainingMinutes)}
            </span>
            <span className={metricPillNeutral} title={`Невыполненных задач на шкале: ${dayMetrics.taskCount}, суммарно ${formatDurationLabel(dayMetrics.taskMinutes)}`}>
              <PlanListIcon className="h-4 w-4 text-gray-400" />
              {dayMetrics.taskCount} · {formatDurationLabel(dayMetrics.taskMinutes)}
            </span>
            <span className={metricPillNeutral} title={`Отдых, еда, перерывы и личные блоки до конца дня: ${formatDurationLabel(dayMetrics.restMinutes)} (прошедшие не считаются)`}>
              <MealRestIcon className="h-4 w-4 text-gray-400" />
              {formatDurationLabel(dayMetrics.restMinutes)}
            </span>
            <span
              className={`${metricPillBase} ${
                dayMetrics.bufferMinutes < 0
                  ? 'border-red-400/30 bg-red-500/10 text-red-200'
                  : 'border-gray-700/70 bg-gray-900/60 text-gray-200'
              }`}
              title={dayMetrics.bufferMinutes < 0
                ? `Буфер отрицательный: задачам и отдыху не хватает ${formatDurationLabel(-dayMetrics.bufferMinutes)} до конца дня`
                : `Буфер — незанятое время до конца дня после задач и отдыха: ${formatDurationLabel(dayMetrics.bufferMinutes)}`}
            >
              <BufferTimeIcon className={`h-4 w-4 ${dayMetrics.bufferMinutes < 0 ? 'text-red-300' : 'text-gray-400'}`} />
              {dayMetrics.bufferMinutes < 0 ? '−' : ''}{formatDurationLabel(Math.abs(dayMetrics.bufferMinutes))}
            </span>
          </>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-2 sm:w-auto sm:justify-end">
        {totalCount > 0 && (
          // Вне шкалы: KPI-счётчик прогресса дня намеренно растёт в фазе исполнения
          // (text-base → text-xl) как акцент внимания, это не статичная роль текста.
          <span className={`whitespace-nowrap tabular-nums leading-none tracking-tight ${isExecution ? 'text-xl font-bold' : 'text-base font-semibold'} ${
            completionPercent === 100 ? 'text-green-400' :
            completionPercent > 0 ? 'text-amber-400' :
            'text-gray-400'
          }`}>
            {isExecution ? `${completedCount}/${totalCount} · ${completionPercent}%` : `${completedCount}/${totalCount} (${completionPercent}%)`}
            {extraDoneCount > 0 && ` +${extraDoneCount}`}
          </span>
        )}
        {habitTotalCount > 0 && (
          <span
            className="type-caption whitespace-nowrap font-medium tabular-nums leading-none"
            title="Бытовые привычки не входят в показатель рабочих задач"
          >
            привычки {habitCompletedCount}/{habitTotalCount}
          </span>
        )}
        {/* Кнопка «Оценить день» живёт только в футере карточки — дубль в шапке убран */}
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
