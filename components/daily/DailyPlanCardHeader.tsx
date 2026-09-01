'use client'

import PlanLensSwitch, { type PlanLens } from './PlanLensSwitch'
import type { DailyPhase } from '@/hooks/daily/phase-helpers'
import { formatDurationLabel } from '@/hooks/daily/schedule-helpers'

function formatTaskCountWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи'
  return 'задач'
}

type DailyPlanCardHeaderProps = {
  currentTime: string | null
  /** Остаток рабочего окна (мин), null — не показывать (нет расписания или не сегодня) */
  workRemainingMinutes?: number | null
  /** Невыполненные задачи на шкале: количество и сумма времени, без еды/перерывов/буферов */
  scheduledTasks?: { count: number; minutes: number } | null
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
  workRemainingMinutes = null,
  scheduledTasks = null,
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
      <div className="flex flex-shrink-0 items-baseline gap-2 whitespace-nowrap">
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
        {(workRemainingMinutes !== null || scheduledTasks !== null) && (
          // Коротко и символично: «⏳ остаток · N задач / M ч»; расшифровка — в подсказке
          <span
            className="type-caption cursor-default whitespace-nowrap leading-none text-gray-500"
            title={[
              workRemainingMinutes !== null ? `До конца рабочего окна осталось ${formatDurationLabel(workRemainingMinutes)}` : null,
              scheduledTasks !== null ? `Невыполненных задач на шкале: ${scheduledTasks.count}, суммарно ${formatDurationLabel(scheduledTasks.minutes)} (еда, перерывы и буферы не считаются)` : null,
              workRemainingMinutes !== null && scheduledTasks !== null && scheduledTasks.minutes > workRemainingMinutes
                ? 'Задачи не помещаются в остаток рабочего окна'
                : null,
            ].filter(Boolean).join('. ')}
          >
            {workRemainingMinutes !== null && (
              <> · <span aria-hidden="true">⏳</span> <span className="tabular-nums text-gray-300">{formatDurationLabel(workRemainingMinutes)}</span></>
            )}
            {scheduledTasks !== null && (
              <> ·{' '}
                <span className={`tabular-nums ${
                  workRemainingMinutes !== null && scheduledTasks.minutes > workRemainingMinutes
                    ? 'font-semibold text-amber-300'
                    : 'text-gray-300'
                }`}>
                  {scheduledTasks.count} {formatTaskCountWord(scheduledTasks.count)} / {formatDurationLabel(scheduledTasks.minutes)}
                </span>
              </>
            )}
          </span>
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
