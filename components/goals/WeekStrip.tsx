'use client'

import { Goal } from '@/lib/types'

export interface WeekData {
  num: number
  key: string
  start: Date
  end: Date
}

interface WeekStripProps {
  weeks: WeekData[]
  expandedWeek: string | null
  onSelectWeek: (key: string | null) => void
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  draggedGoal: { weekKey: string; index: number; goal: string } | null
  setDraggedGoal: (goal: { weekKey: string; index: number; goal: string } | null) => void
  dragOverWeek: string | null
  setDragOverWeek: (weekKey: string | null) => void
  onMoveGoal: (fromWeekKey: string, toWeekKey: string, index: number, goal: string) => void
}

export default function WeekStrip({
  weeks,
  expandedWeek,
  onSelectWeek,
  periodGoals,
  trackedGoals,
  draggedGoal,
  setDraggedGoal,
  dragOverWeek,
  setDragOverWeek,
  onMoveGoal,
}: WeekStripProps) {
  const today = new Date()

  const calculateWeekProgress = (weekKey: string) => {
    const wGoals = periodGoals.get(weekKey) || []
    const total = wGoals.length
    const completed = wGoals.filter(goalText => {
      const tracked = trackedGoals.find(g => g.periodKey === weekKey && g.text === goalText)
      return tracked?.completed
    }).length
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  return (
    <div className="flex gap-1.5">
      {weeks.map(week => {
        const weekGoals = periodGoals.get(week.key) || []
        const wp = calculateWeekProgress(week.key)
        const isCurrentWeek = today >= week.start && today <= week.end
        const isSelected = expandedWeek === week.key
        const isDragOver = dragOverWeek === week.key

        return (
          <button
            key={week.key}
            onClick={() => onSelectWeek(isSelected ? null : week.key)}
            className={`flex-1 rounded-lg px-1.5 py-1.5 text-center transition-all ${
              isDragOver
                ? 'bg-blue-500/20 border-2 border-blue-500/50 border-dashed'
                : isSelected
                  ? 'bg-blue-500/15 border border-blue-500/40'
                  : isCurrentWeek
                    ? 'bg-gray-800/80 border border-blue-500/20'
                    : 'bg-gray-800/40 border border-gray-800 hover:border-gray-700'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              if (draggedGoal && draggedGoal.weekKey !== week.key) setDragOverWeek(week.key)
            }}
            onDragLeave={() => setDragOverWeek(null)}
            onDrop={(e) => {
              e.preventDefault()
              if (draggedGoal && draggedGoal.weekKey !== week.key) {
                onMoveGoal(draggedGoal.weekKey, week.key, draggedGoal.index, draggedGoal.goal)
              }
              setDraggedGoal(null)
              setDragOverWeek(null)
            }}
          >
            <div className="text-[10px] font-semibold text-gray-400">W{week.num}</div>
            <div className="text-[9px] text-gray-600">{week.start.getDate()}-{week.end.getDate()}</div>
            {isCurrentWeek && <div className="w-1 h-1 rounded-full bg-blue-400 mx-auto mt-0.5" />}
            {wp.total > 0 && (
              <div className="w-full h-0.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${wp.percent}%` }} />
              </div>
            )}
            {weekGoals.length > 0 && (
              <div className="text-[9px] text-gray-500 mt-0.5">{wp.completed}/{wp.total}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
