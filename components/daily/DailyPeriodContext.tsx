'use client'

import Link from 'next/link'
import type { PeriodGoalItem } from '@/hooks/daily/types'

interface DailyPeriodContextProps {
  hasGoalContext: boolean
  weekLabel: string
  weekGoals: PeriodGoalItem[]
  monthLabel: string
  monthGoals: PeriodGoalItem[]
  planTaskMutationLocked: boolean
  isGoalCompleted: (goalText: string) => boolean
  addGoalToTasks: (goalText: string) => void
}

export default function DailyPeriodContext({
  hasGoalContext,
  weekLabel,
  weekGoals,
  monthLabel,
  monthGoals,
  planTaskMutationLocked,
  isGoalCompleted,
  addGoalToTasks,
}: DailyPeriodContextProps) {
  return (
      !hasGoalContext ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-sm text-gray-400">
          Цели недели и месяца пока не заданы. <Link href="/goals" className="font-medium text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">Добавьте цели</Link>, чтобы Ментрикс точнее собирал план дня.
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h3 className="font-semibold text-lg text-blue-200 mb-3">{weekLabel}:</h3>
          {weekGoals.length > 0 ? (
            <ul className="text-base text-blue-300 space-y-1.5">
              {weekGoals.map((goal, index) => {
                // Используем статус из API (за весь период) или проверяем задачи текущего дня
                const goalText = typeof goal === 'string' ? goal : goal.text
                const completedInPeriod = typeof goal === 'string' ? false : goal.completed
                const completedToday = isGoalCompleted(goalText)
                const completed = completedInPeriod || completedToday
                return (
                  <li key={index} className="flex min-w-0 items-start gap-2 leading-normal">
                    <span className={completed ? 'text-green-400' : 'text-gray-500'}>
                      {completed ? '✓' : '•'}
                    </span>
                    <span className={`min-w-0 flex-1 break-words pt-2.5 lg:pt-0 ${completed ? 'text-green-400' : ''}`}>
                      {goalText}
                    </span>
                    {!completed && (
                      <button
                        onClick={() => addGoalToTasks(goalText)}
                        disabled={planTaskMutationLocked}
                        className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-md bg-blue-500/15 px-3 text-lg font-medium leading-none text-blue-400 hover:bg-blue-500/20 hover:text-blue-200 disabled:cursor-not-allowed disabled:opacity-45 lg:h-auto lg:min-w-0 lg:py-1.5"
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
          ) : null}
        </div>

        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <h3 className="font-semibold text-lg text-purple-200 mb-3">{monthLabel}:</h3>
          {monthGoals.length > 0 ? (
            <ul className="text-base text-purple-300 space-y-1.5">
              {monthGoals.map((goal, index) => {
                // Используем статус из API (за весь период) или проверяем задачи текущего дня
                const goalText = typeof goal === 'string' ? goal : goal.text
                const completedInPeriod = typeof goal === 'string' ? false : goal.completed
                const completedToday = isGoalCompleted(goalText)
                const completed = completedInPeriod || completedToday
                return (
                  <li key={index} className="flex min-w-0 items-start gap-2 leading-normal">
                    <span className={completed ? 'text-green-400' : 'text-gray-500'}>
                      {completed ? '✓' : '•'}
                    </span>
                    <span className={`min-w-0 flex-1 break-words pt-2.5 lg:pt-0 ${completed ? 'text-green-400' : ''}`}>
                      {goalText}
                    </span>
                    {!completed && (
                      <button
                        onClick={() => addGoalToTasks(goalText)}
                        disabled={planTaskMutationLocked}
                        className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-md bg-purple-500/15 px-3 text-lg font-medium leading-none text-purple-400 hover:bg-purple-500/20 hover:text-purple-200 disabled:cursor-not-allowed disabled:opacity-45 lg:h-auto lg:min-w-0 lg:py-1.5"
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
          ) : null}
        </div>
      </div>
      )
  )
}
