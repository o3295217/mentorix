'use client'

import { useState, useEffect, useMemo } from 'react'
import { Goal } from '@/lib/types'
import { monthNames } from '@/lib/goals-utils'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { useCopyDropdown } from '@/hooks/useCopyDropdown'
import WeekStrip from './WeekStrip'
import WeekCard from './WeekCard'

interface MonthSectionProps {
  month: number // 0-11
  year: number
  goals: string[]
  isCurrent: boolean
  progress: { total: number; completed: number; percent: number }
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  onCopyGoal: (goal: string, targetType: 'week', targetKey: string) => void
  
  // Week props
  draggedGoal: { weekKey: string; index: number; goal: string } | null
  setDraggedGoal: (goal: { weekKey: string; index: number; goal: string } | null) => void
  dragOverWeek: string | null
  setDragOverWeek: (weekKey: string | null) => void
  onMoveGoal: (fromWeekKey: string, toWeekKey: string, index: number, goal: string) => void
  onAddWeekGoal: (weekKey: string, text: string) => void
  onRemoveWeekGoal: (weekKey: string, index: number) => void
  onEditWeekGoal: (weekKey: string, index: number, text: string) => void
  
  // Goal Tracking
  processingGoals: Set<string>
  expandedGoals: Set<string>
  setExpandedGoals: (callback: (prev: Set<string>) => Set<string>) => void
  onToggleGoalCompletion: (weekKey: string, text: string, completed: boolean) => void
  onSetGoalPriority: (weekKey: string, text: string, priority: number) => void
  // Filters
  searchQuery?: string
  filterStatus?: 'all' | 'active' | 'completed'
  filterPriority?: number | null
  filterTag?: string | null
}

export default function MonthSection({
  month,
  year,
  goals,
  isCurrent,
  progress,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
  periodGoals,
  trackedGoals,
  onCopyGoal,
  draggedGoal,
  setDraggedGoal,
  dragOverWeek,
  setDragOverWeek,
  onMoveGoal,
  onAddWeekGoal,
  onRemoveWeekGoal,
  onEditWeekGoal,
  processingGoals,
  expandedGoals,
  setExpandedGoals,
  onToggleGoalCompletion,
  onSetGoalPriority,
  searchQuery = '',
  filterStatus = 'all',
  filterPriority = null,
  filterTag = null,
}: MonthSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit } = useInlineEdit(onEditGoal)
  const { copyDropdownIndex, dropdownRef, toggleDropdown, closeDropdown } = useCopyDropdown()
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  const weeksInMonth = useMemo(() => {
    const weeks: { num: number; key: string; start: Date; end: Date }[] = []
    const firstD = new Date(year, month, 1)
    const lastD = new Date(year, month + 1, 0)
    const curr = new Date(firstD)
    while (curr.getDay() !== 1) curr.setDate(curr.getDate() + 1)
    let wNum = 1
    while (curr <= lastD) {
      const wStart = new Date(curr)
      const wEnd = new Date(curr)
      wEnd.setDate(wEnd.getDate() + 6)
      weeks.push({ num: wNum, key: `${year}-${String(month + 1).padStart(2, '0')}-W${wNum}`, start: wStart, end: wEnd })
      curr.setDate(curr.getDate() + 7)
      wNum++
    }
    return weeks
  }, [year, month])

  // Auto-expand current week
  useEffect(() => {
    if (isCurrent && !expandedWeek) {
      const today = new Date()
      const currentWeek = weeksInMonth.find(w => today >= w.start && today <= w.end)
      if (currentWeek) setExpandedWeek(currentWeek.key)
    }
  }, [isCurrent, expandedWeek, weeksInMonth])

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal)
      setNewGoal('')
    }
  }

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  return (
    <div id={`month-${monthKey}`} className={`rounded-lg border transition-colors ${
      isCurrent
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-gray-800 bg-gray-900/20'
    }`}>
      {/* Заголовок месяца */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="font-medium text-sm text-gray-200">
          {monthNames[month]}
        </span>
        {isCurrent && (
          <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>
        )}
        {goals.length > 0 && (
          <span className="text-xs text-gray-500">({goals.length})</span>
        )}
        {progress.total > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-blue-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">{progress.percent}%</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Добавление цели */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Цель на месяц..."
            className="input text-sm py-1.5"
          />
          <button onClick={handleAdd} className="btn-primary text-sm px-3 py-1.5">+</button>
        </div>

        {/* Список целей месяца */}
        {goals.length > 0 && (() => {
          const sq = searchQuery.toLowerCase()
          const displayed = sq ? goals.filter(g => g.toLowerCase().includes(sq)) : goals
          return displayed.length > 0 && (
          <div className="space-y-1">
            {displayed.map((goal, index) => {
              const originalIndex = goals.indexOf(goal)
              return (
              <div
                key={originalIndex}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-800/50 transition-colors group/item"
              >
                <span className="w-4 h-4 rounded bg-gray-800 text-gray-500 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {originalIndex + 1}
                </span>
                {editingIndex === originalIndex ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => saveEdit(originalIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(originalIndex)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm text-gray-200 flex-1">{goal}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  {weeksInMonth.length > 0 && (
                    <div className="relative" ref={copyDropdownIndex === originalIndex ? dropdownRef : null}>
                      <button
                        onClick={() => toggleDropdown(originalIndex)}
                        className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                        title="В неделю"
                      >
                        ↓
                      </button>
                      {copyDropdownIndex === originalIndex && (
                        <div className="absolute right-0 top-7 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 py-1 min-w-[120px]">
                          {weeksInMonth.map(w => (
                            <button
                              key={w.num}
                              onClick={() => { onCopyGoal(goal, 'week', w.key); closeDropdown() }}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                            >
                              W{w.num} ({w.start.getDate()}-{w.end.getDate()})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => startEdit(originalIndex, goal)}
                    className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#9998;
                  </button>
                  <button
                    onClick={() => onRemoveGoal(originalIndex)}
                    className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#10005;
                  </button>
                </div>
              </div>
              )
            })}
          </div>
          )
        })()}

        {/* Компактная полоска недель */}
        {weeksInMonth.length > 0 && (
          <div className="pt-2 border-t border-gray-800 space-y-2">
            <WeekStrip
              weeks={weeksInMonth}
              expandedWeek={expandedWeek}
              onSelectWeek={setExpandedWeek}
              periodGoals={periodGoals}
              trackedGoals={trackedGoals}
              draggedGoal={draggedGoal}
              setDraggedGoal={setDraggedGoal}
              dragOverWeek={dragOverWeek}
              setDragOverWeek={setDragOverWeek}
              onMoveGoal={onMoveGoal}
            />

            {/* Раскрытая неделя */}
            {expandedWeek && (() => {
              const week = weeksInMonth.find(w => w.key === expandedWeek)
              if (!week) return null
              const weekGoals = periodGoals.get(week.key) || []
              const today = new Date()
              const isCurrentWeek = today >= week.start && today <= week.end

              return (
                <WeekCard
                  week={week}
                  weekGoals={weekGoals}
                  isCurrentWeek={isCurrentWeek}
                  trackedGoals={trackedGoals}
                  draggedGoal={draggedGoal}
                  setDraggedGoal={setDraggedGoal}
                  setDragOverWeek={setDragOverWeek}
                  onMoveGoal={onMoveGoal}
                  onAddWeekGoal={onAddWeekGoal}
                  onRemoveWeekGoal={onRemoveWeekGoal}
                  onEditWeekGoal={onEditWeekGoal}
                  processingGoals={processingGoals}
                  expandedGoals={expandedGoals}
                  setExpandedGoals={setExpandedGoals}
                  onToggleGoalCompletion={onToggleGoalCompletion}
                  onSetGoalPriority={onSetGoalPriority}
                  searchQuery={searchQuery}
                  filterStatus={filterStatus}
                  filterPriority={filterPriority}
                  filterTag={filterTag}
                />
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

