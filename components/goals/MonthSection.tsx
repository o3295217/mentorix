'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Goal } from '@/lib/types'
import { monthNames } from '@/lib/goals-utils'
import { parseDateParam, toDateKey } from '@/lib/dates'

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
  showAllPeriods: boolean
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
  showAllPeriods,
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
  onSetGoalPriority
}: MonthSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string, index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')
  const [copyDropdownIndex, setCopyDropdownIndex] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCopyDropdownIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-expand current week
  useEffect(() => {
    if (isCurrent && !expandedWeek) {
      const today = new Date()
      const currentWeek = weeksInMonth.find(w => today >= w.start && today <= w.end)
      if (currentWeek) setExpandedWeek(currentWeek.key)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent])

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal)
      setNewGoal('')
    }
  }

  const handleSaveEdit = (index: number) => {
    if (editingText.trim()) {
      onEditGoal(index, editingText)
    }
    setEditingIndex(null)
    setEditingText('')
  }

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

  const calculateWeekProgress = (weekKey: string) => {
    const wGoals = periodGoals.get(weekKey) || []
    const total = wGoals.length
    const completed = wGoals.filter(goalText => {
      const tracked = trackedGoals.find(g => g.periodKey === weekKey && g.text === goalText)
      return tracked?.completed
    }).length
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  const isOverdue = (deadline: string | null): boolean => {
    if (!deadline) return false
    return toDateKey(parseDateParam(deadline)) < toDateKey(new Date())
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
        {goals.length > 0 && (
          <div className="space-y-1">
            {goals.map((goal, index) => (
              <div
                key={index}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-800/50 transition-colors group/item"
              >
                <span className="w-4 h-4 rounded bg-gray-800 text-gray-500 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {index + 1}
                </span>
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveEdit(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(index)
                      if (e.key === 'Escape') { setEditingIndex(null); setEditingText('') }
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-gray-700 rounded-lg bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm text-gray-200 flex-1">{goal}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  {isCurrent && (
                    <div className="relative" ref={copyDropdownIndex === index ? dropdownRef : null}>
                      <button
                        onClick={() => setCopyDropdownIndex(copyDropdownIndex === index ? null : index)}
                        className="text-gray-500 hover:text-blue-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                        title="В неделю"
                      >
                        ↓
                      </button>
                      {copyDropdownIndex === index && (
                        <div className="absolute right-0 top-7 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-10 py-1 min-w-[120px]">
                          {weeksInMonth.map(w => (
                            <button
                              key={w.num}
                              onClick={() => { onCopyGoal(goal, 'week', w.key); setCopyDropdownIndex(null) }}
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
                    onClick={() => { setEditingIndex(index); setEditingText(goal) }}
                    className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#9998;
                  </button>
                  <button
                    onClick={() => onRemoveGoal(index)}
                    className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors text-xs"
                  >
                    &#10005;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Компактная полоска недель */}
        {isCurrent && weeksInMonth.length > 0 && (
          <div className="pt-2 border-t border-gray-800 space-y-2">
            {/* WeekStrip — бейджи */}
            <div className="flex gap-1.5">
              {weeksInMonth.map(week => {
                const weekGoals = periodGoals.get(week.key) || []
                const wp = calculateWeekProgress(week.key)
                const today = new Date()
                const isCurrentWeek = today >= week.start && today <= week.end
                const isSelected = expandedWeek === week.key
                const isDragOver = dragOverWeek === week.key

                return (
                  <button
                    key={week.key}
                    onClick={() => setExpandedWeek(isSelected ? null : week.key)}
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
                    {/* Мини-прогресс */}
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

            {/* Раскрытая неделя */}
            {expandedWeek && (() => {
              const week = weeksInMonth.find(w => w.key === expandedWeek)
              if (!week) return null
              const weekKey = week.key
              const weekGoals = periodGoals.get(weekKey) || []
              const today = new Date()
              const isCurrentWeek = today >= week.start && today <= week.end

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
                    ) : (
                      weekGoals.map((goal, index) => {
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
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

