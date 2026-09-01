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

const metricSegment = 'flex cursor-default items-center gap-1.5 whitespace-nowrap'

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
    <div className="daily-phase-accent mb-4 flex flex-shrink-0 flex-col gap-2 lg:pr-6" data-phase={phase}>
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
        <h2 className="type-section-title">План на день</h2>
        <span
          className="type-secondary inline-block font-semibold tabular-nums leading-none tracking-tight"
          aria-label={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
          title={currentTime ? `Текущее локальное время: ${currentTime}` : 'Текущее локальное время загружается'}
        >
          <span className={currentTime ? undefined : 'text-transparent'} suppressHydrationWarning>
            {currentTime ?? '00:00'}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 sm:justify-end">
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

      {/* Строка арифметики дня на всю ширину: подписи + значения, разделители «|».
          Не конкурирует с правым блоком управления и не ломает перенос. */}
      {dayMetrics !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm tabular-nums leading-none">
          <span className={metricSegment} title={`До конца дня осталось ${formatDurationLabel(dayMetrics.remainingMinutes)}`}>
            <PlanTimelineIcon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">до конца</span>
            <span className="font-medium text-gray-200">{formatDurationLabel(dayMetrics.remainingMinutes)}</span>
          </span>
          <span aria-hidden="true" className="text-gray-700">|</span>
          <span className={metricSegment} title={`Невыполненных задач на шкале: ${dayMetrics.taskCount}, суммарно ${formatDurationLabel(dayMetrics.taskMinutes)}`}>
            <PlanListIcon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">задачи</span>
            <span className="font-medium text-gray-200">{dayMetrics.taskCount} · {formatDurationLabel(dayMetrics.taskMinutes)}</span>
          </span>
          <span aria-hidden="true" className="text-gray-700">|</span>
          <span className={metricSegment} title={`Отдых, еда, перерывы и личные блоки до конца дня: ${formatDurationLabel(dayMetrics.restMinutes)} (прошедшие не считаются)`}>
            <MealRestIcon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-500">отдых</span>
            <span className="font-medium text-gray-200">{formatDurationLabel(dayMetrics.restMinutes)}</span>
          </span>
          <span aria-hidden="true" className="text-gray-700">|</span>
          <span
            className={metricSegment}
            title={dayMetrics.bufferMinutes < 0
              ? `Буфер отрицательный: задачам и отдыху не хватает ${formatDurationLabel(-dayMetrics.bufferMinutes)} до конца дня`
              : `Буфер — незанятое время до конца дня после задач и отдыха: ${formatDurationLabel(dayMetrics.bufferMinutes)}`}
          >
            <BufferTimeIcon className={`h-4 w-4 ${dayMetrics.bufferMinutes < 0 ? 'text-red-400' : 'text-gray-500'}`} />
            <span className={dayMetrics.bufferMinutes < 0 ? 'text-red-400/80' : 'text-gray-500'}>буфер</span>
            <span className={`font-medium ${dayMetrics.bufferMinutes < 0 ? 'font-semibold text-red-300' : 'text-gray-200'}`}>
              {dayMetrics.bufferMinutes < 0 ? '−' : ''}{formatDurationLabel(Math.abs(dayMetrics.bufferMinutes))}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
