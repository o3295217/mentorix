'use client'

import { useState } from 'react'
import { Goal } from '@/lib/types'
import { parseDateParam, toDateKey } from '@/lib/dates'
import { WeekData } from './WeekStrip'

interface WeekCardProps {
  week: WeekData
  weekGoals: string[]
  isCurrentWeek: boolean
  trackedGoals: Goal[]
  // Drag
  draggedGoal: { weekKey: string; index: number; goal: string } | null
  setDraggedGoal: (goal: { weekKey: string; index: number; goal: string } | null) => void
  setDragOverWeek: (weekKey: string | null) => void
  onMoveGoal: (fromWeekKey: string, toWeekKey: string, index: number, goal: string) => void
  // CRUD
  onAddWeekGoal: (weekKey: string, text: string) => void
  onRemoveWeekGoal: (weekKey: string, index: number) => void
  onEditWeekGoal: (weekKey: string, index: number, text: string) => void
  // Tracking
  processingGoals: Set<string>
  expandedGoals: Set<string>
  setExpandedGoals: (callback: (prev: Set<string>) => Set<string>) => void
  onToggleGoalCompletion: (weekKey: string, text: string, completed: boolean) => void
  onSetGoalPriority: (weekKey: string, text: string, priority: number) => void
  // Filters
  searchQuery: string
  filterStatus: 'all' | 'active' | 'completed'
  filterPriority: number | null
  filterTag: string | null
}

const isOverdue = (deadline: string | null): boolean => {
  if (!deadline) return false
  return toDateKey(parseDateParam(deadline)) < toDateKey(new Date())
}

export default function WeekCard({
  week,
  weekGoals,
  isCurrentWeek,
  trackedGoals,
  draggedGoal,
  setDraggedGoal,
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
  searchQuery,
  filterStatus,
  filterPriority,
  filterTag,
}: WeekCardProps) {
  const weekKey = week.key
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string; index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')

  return (
    <div
      id={`week-${weekKey}`}
      className={`rounded-lg p-3 border transition-all ${
        isCurrentWeek
          ? 'border-blue-500/30 bg-blue-500/5'
          : 'border-gray-700 bg-gray-800/30'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (draggedGoal && draggedGoal.weekKey !== weekKey) setDragOverWeek(weekKey)
      }}
      onDragLeave={() => setDragOverWeek(null)}
      onDrop={(e) => {
        e.preventDefault()
        if (draggedGoal && draggedGoal.weekKey !== weekKey) {
          onMoveGoal(draggedGoal.weekKey, weekKey, draggedGoal.index, draggedGoal.goal)
        }
        setDraggedGoal(null)
        setDragOverWeek(null)
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold ${isCurrentWeek ? 'text-blue-400' : 'text-gray-400'}`}>
          Неделя {week.num}: {week.start.getDate()}-{week.end.getDate()}
        </span>
        {isCurrentWeek && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">сейчас</span>}
      </div>

      {/* Добавление цели в неделю */}
      <div className="flex gap-1 mb-2">
        <input
          type="text"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLInputElement
              if (target.value.trim()) { onAddWeekGoal(weekKey, target.value); target.value = '' }
            }
          }}
          placeholder="Цель на неделю..."
          className="flex-1 px-2 py-1 text-xs border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-gray-600"
        />
        <button
          onClick={(e) => {
            const input = e.currentTarget.previousElementSibling as HTMLInputElement
            if (input.value.trim()) { onAddWeekGoal(weekKey, input.value); input.value = '' }
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded-lg transition-colors"
        >
          +
        </button>
      </div>

      {/* Цели недели */}
      <div className="space-y-1">
        {weekGoals.length === 0 ? (
          <p className="text-gray-600 text-xs text-center py-2">Нет целей</p>
        ) : (() => {
          const filtered = weekGoals.filter((goal) => {
            if (searchQuery && !goal.toLowerCase().includes(searchQuery.toLowerCase())) return false
            const tracked = trackedGoals.find(g =>
              g.periodKey === weekKey &&
              (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
            )
            if (filterStatus === 'completed' && !tracked?.completed) return false
            if (filterStatus === 'active' && tracked?.completed) return false
            if (filterPriority !== null && (tracked?.priority || 0) !== filterPriority) return false
            if (filterTag && !(tracked?.tags || []).includes(filterTag)) return false
            return true
          })
          return filtered.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-2">Нет целей по фильтру</p>
          ) : filtered.map((goal) => {
            const index = weekGoals.indexOf(goal)
            const lockKey = `${weekKey}-${goal}`
            const isProcessing = processingGoals.has(lockKey)
            const goalKey = `week-${weekKey}-${index}`
            const isGoalExpanded = expandedGoals.has(goalKey)
            const isLongText = goal.length > 50
            const isDragging = draggedGoal?.weekKey === weekKey && draggedGoal?.index === index

            const trackedGoal = trackedGoals.find(g =>
              g.periodKey === weekKey &&
              (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
            )
            const isCompleted = trackedGoal?.completed || false
            const goalDeadline = trackedGoal?.deadline
            const isDeadlineOverdue = goalDeadline && isOverdue(goalDeadline) && !isCompleted
            const goalPriority = trackedGoal?.priority || 0

            return (
              <div
                key={index}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', goal)
                  setDraggedGoal({ weekKey, index, goal })
                }}
                onDragEnd={() => { setDraggedGoal(null); setDragOverWeek(null) }}
                style={{ touchAction: 'none', userSelect: 'none' }}
                className={`p-1.5 rounded-lg border transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-50 scale-95' : ''
                } ${
                  isCompleted
                    ? 'bg-green-900/15 border-green-700/50'
                    : isDeadlineOverdue
                      ? 'bg-red-900/15 border-red-700/50'
                      : 'bg-gray-800/40 border-gray-700 hover:border-gray-600'
                }`}
              >
                {editingWeekGoal?.weekKey === weekKey && editingWeekGoal?.index === index ? (
                  <textarea
                    value={editingWeekText}
                    onChange={(e) => setEditingWeekText(e.target.value)}
                    onBlur={() => {
                      if (editingWeekText.trim()) onEditWeekGoal(weekKey, index, editingWeekText)
                      setEditingWeekGoal(null); setEditingWeekText('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (editingWeekText.trim()) onEditWeekGoal(weekKey, index, editingWeekText)
                        setEditingWeekGoal(null); setEditingWeekText('')
                      }
                      if (e.key === 'Escape') { setEditingWeekGoal(null); setEditingWeekText('') }
                    }}
                    className="w-full px-2 py-1 text-xs border border-blue-500/50 rounded bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      disabled={isProcessing}
                      draggable={false}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (!isProcessing) onToggleGoalCompletion(weekKey, goal, !isCompleted)
                      }}
                      className={`w-3.5 h-3.5 mt-0.5 rounded border-gray-600 text-green-500 focus:ring-green-400 flex-shrink-0 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs ${isLongText ? 'cursor-pointer' : ''} ${isLongText && !isGoalExpanded ? 'line-clamp-2' : ''} ${isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}
                        onClick={() => {
                          if (isLongText) {
                            setExpandedGoals(prev => {
                              const next = new Set(prev)
                              if (next.has(goalKey)) next.delete(goalKey); else next.add(goalKey)
                              return next
                            })
                          }
                        }}
                      >
                        {goal}
                      </div>
                      {goalDeadline && (
                        <div className={`text-[10px] mt-0.5 ${isDeadlineOverdue ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                          ⏰ {parseDateParam(goalDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-1 mt-1">
                  <select
                    value={goalPriority}
                    disabled={isProcessing}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      if (!isProcessing) onSetGoalPriority(weekKey, goal, parseInt(e.target.value))
                    }}
                    className={`text-xs px-1 py-0.5 border border-gray-700 rounded bg-gray-900 text-gray-300 ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                  >
                    <option value="0">⚪</option>
                    <option value="1">🟡</option>
                    <option value="2">🔴</option>
                  </select>
                  <button
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => { setEditingWeekGoal({ weekKey, index }); setEditingWeekText(goal) }}
                    className="text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#9998;
                  </button>
                  <button
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onRemoveWeekGoal(weekKey, index)}
                    className="text-gray-500 hover:text-red-400 px-1 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#10005;
                  </button>
                </div>
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
