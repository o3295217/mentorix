'use client'

import Link from 'next/link'
import PeriodContextCard from '@/components/daily/PeriodContextCard'
import type { FactItem, PeriodGoalItem } from '@/hooks/daily/types'

interface DailyPeriodContextProps {
  hasGoalContext: boolean
  weekLabel: string
  weekGoals: PeriodGoalItem[]
  weekFactsTotal: number
  weekFacts: FactItem[]
  showWeekFacts: boolean
  onToggleWeekFacts: () => void
  monthLabel: string
  monthGoals: PeriodGoalItem[]
  monthFactsTotal: number
  monthFacts: FactItem[]
  showMonthFacts: boolean
  onToggleMonthFacts: () => void
  planTaskMutationLocked: boolean
  isGoalCompleted: (goalText: string) => boolean
  addGoalToTasks: (goalText: string) => void
}

export default function DailyPeriodContext({
  hasGoalContext,
  weekLabel,
  weekGoals,
  weekFactsTotal,
  weekFacts,
  showWeekFacts,
  onToggleWeekFacts,
  monthLabel,
  monthGoals,
  monthFactsTotal,
  monthFacts,
  showMonthFacts,
  onToggleMonthFacts,
  planTaskMutationLocked,
  isGoalCompleted,
  addGoalToTasks,
}: DailyPeriodContextProps) {
  if (!hasGoalContext) {
    return (
      <div className="type-secondary rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
        Цели недели и месяца пока не заданы. <Link href="/goals" className="font-medium text-primary-300 hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">Добавьте цели</Link>, чтобы Ментрикс точнее собирал план дня.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <PeriodContextCard
        accent="blue"
        label={weekLabel}
        goals={weekGoals}
        planTaskMutationLocked={planTaskMutationLocked}
        isGoalCompleted={isGoalCompleted}
        addGoalToTasks={addGoalToTasks}
        factsTotal={weekFactsTotal}
        facts={weekFacts}
        showFacts={showWeekFacts}
        onToggleFacts={onToggleWeekFacts}
      />
      <PeriodContextCard
        accent="purple"
        label={monthLabel}
        goals={monthGoals}
        planTaskMutationLocked={planTaskMutationLocked}
        isGoalCompleted={isGoalCompleted}
        addGoalToTasks={addGoalToTasks}
        factsTotal={monthFactsTotal}
        facts={monthFacts}
        showFacts={showMonthFacts}
        onToggleFacts={onToggleMonthFacts}
      />
    </div>
  )
}
