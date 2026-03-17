'use client'

import { useState, useEffect, useMemo } from 'react'
import { Goal, GoalTag } from '@/lib/types'
import { monthNames } from '@/lib/goals-utils'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { useCopyDropdown } from '@/hooks/useCopyDropdown'

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
  onAddWeekGoal: (weekKey: string, text: string, tags?: string[]) => void
  onRemoveWeekGoal: (weekKey: string, index: number) => void
  onEditWeekGoal: (weekKey: string, index: number, text: string) => void
  
  // Goal Tracking
  processingGoals: Set<string>
  expandedGoals: Set<string>
  setExpandedGoals: (callback: (prev: Set<string>) => Set<string>) => void
  onToggleGoalCompletion: (weekKey: string, text: string, completed: boolean) => void
  onSetGoalPriority: (weekKey: string, text: string, priority: number) => void
  // Tags
  tags?: GoalTag[]
  onCreateTag?: (name: string, color: string) => void
  onSetGoalTags?: (weekKey: string, text: string, tags: string[]) => void
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
  tags = [],
  onCreateTag,
  onSetGoalTags,
  searchQuery = '',
  filterStatus = 'all',
  filterPriority = null,
  filterTag = null,
}: MonthSectionProps) {
  const [newGoal, setNewGoal] = useState('')
  const [newWeekGoals, setNewWeekGoals] = useState<Record<string, string>>({})
  const { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit } = useInlineEdit(onEditGoal)
  const { copyDropdownIndex, dropdownRef, toggleDropdown, closeDropdown } = useCopyDropdown()
  const [editingWeekGoal, setEditingWeekGoal] = useState<{ weekKey: string; index: number } | null>(null)
  const [editingWeekText, setEditingWeekText] = useState('')

  const isPast = !isCurrent && new Date(year, month + 1, 0) < new Date()

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

  const hasWeekGoals = weeksInMonth.some(w => (periodGoals.get(w.key) || []).length > 0)
  const isEmpty = goals.length === 0 && !hasWeekGoals
  const [collapsed, setCollapsed] = useState(isPast && isEmpty)

  useEffect(() => {
    if (!isPast) setCollapsed(false)
    else if (isEmpty) setCollapsed(true)
  }, [isPast, isEmpty])

  const handleAdd = () => {
    if (newGoal.trim()) { onAddGoal(newGoal); setNewGoal('') }
  }

  const handleAddWeekGoal = (weekKey: string) => {
    const text = newWeekGoals[weekKey]?.trim()
    if (text) {
      onAddWeekGoal(weekKey, text)
      setNewWeekGoals(prev => ({ ...prev, [weekKey]: '' }))
    }
  }

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

  // Собираем все цели недель для фильтрации списка месяца
  const allWeekGoalTexts = useMemo(() => {
    const s = new Set<string>()
    for (const w of weeksInMonth) {
      for (const g of periodGoals.get(w.key) || []) s.add(g.trim().toLowerCase())
    }
    return s
  }, [weeksInMonth, periodGoals])

  // Нераспределённые цели месяца (ещё не в неделях)
  const unassignedGoals = useMemo(() => {
    const sq = searchQuery.toLowerCase()
    return goals
      .map((g, i) => ({ text: g, idx: i }))
      .filter(g => !allWeekGoalTexts.has(g.text.trim().toLowerCase()))
      .filter(g => !sq || g.text.toLowerCase().includes(sq))
  }, [goals, allWeekGoalTexts, searchQuery])

  return (
    <div id={`month-${monthKey}`} className={`overflow-hidden rounded-[24px] border transition-colors ${
      isCurrent
        ? 'border-blue-500/30 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'
        : 'border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]'
    }`}>
      {/* Заголовок */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/20 transition-colors select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className={`text-lg font-semibold tracking-tight ${collapsed ? 'text-slate-500' : 'text-white'}`}>
            {monthNames[month]} {year} — детализация по неделям
          </h2>
          {isCurrent && (
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">сейчас</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {progress.total > 0 && !collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all bg-blue-500" style={{ width: `${progress.percent}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">{progress.percent}%</span>
            </div>
          )}
          {collapsed && isEmpty && <span className="text-[10px] text-slate-600">пусто</span>}
        </div>
      </div>

      {!collapsed && (
      <div className="px-5 pb-5">
        {/* ── Нераспределённые цели месяца ── */}
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Добавить задачу на месяц..."
              className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button onClick={handleAdd} className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-blue-400">+</button>
          </div>

          {unassignedGoals.length > 0 && (
            <div className="space-y-1">
              {unassignedGoals.map(({ text: goal, idx: originalIndex }) => {
                const tracked = trackedGoals.find(g =>
                  g.periodKey === monthKey &&
                  (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
                )
                const isCompleted = tracked?.completed || false
                const isProcessing = processingGoals.has(`${monthKey}:${goal}`)
                return (
                  <div
                    key={originalIndex}
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-colors group/item ${isCompleted ? 'bg-green-500/5' : 'hover:bg-slate-800/30'}`}
                  >
                    <button
                      disabled={isProcessing}
                      onClick={() => { if (!isProcessing) onToggleGoalCompletion(monthKey, goal, !isCompleted) }}
                      className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-lg border transition-all ${
                        isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'
                      } ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    >
                      {isCompleted && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
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
                        className="flex-1 px-2 py-1 text-sm border border-slate-700 rounded-lg bg-slate-950/50 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        autoFocus
                      />
                    ) : (
                      <span className={`flex-1 ${isCompleted ? 'text-slate-500' : 'text-slate-200'}`}>{goal}</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      {weeksInMonth.length > 0 && (
                        <div className="relative" ref={copyDropdownIndex === originalIndex ? dropdownRef : null}>
                          <button
                            onClick={() => toggleDropdown(originalIndex)}
                            className="text-slate-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm"
                            title="Переместить в неделю"
                          >
                            ↓ в неделю
                          </button>
                          {copyDropdownIndex === originalIndex && (
                            <div className="absolute right-0 top-7 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl z-10 py-1 min-w-[140px]">
                              {weeksInMonth.map(w => (
                                <button
                                  key={w.num}
                                  onClick={() => { onCopyGoal(goal, 'week', w.key); closeDropdown() }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                  Неделя {w.num} ({w.start.getDate()}-{w.end.getDate()})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => startEdit(originalIndex, goal)}
                        className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm"
                      >✎</button>
                      <button
                        onClick={() => onRemoveGoal(originalIndex)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm"
                      >✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Таблица недель ── */}
        {weeksInMonth.length > 0 && (
          <div className="border-t border-slate-800/60 pt-4">
            <div
              className="grid gap-px bg-slate-800/40 rounded-xl overflow-hidden"
              style={{ gridTemplateColumns: `repeat(${weeksInMonth.length}, minmax(0, 1fr))` }}
            >
              {weeksInMonth.map(week => {
                const weekGoals = periodGoals.get(week.key) || []
                const today = new Date()
                const isCurrentWeek = today >= week.start && today <= week.end
                const isDragOver = dragOverWeek === week.key

                // Фильтрация
                const filtered = weekGoals.filter(goal => {
                  if (searchQuery && !goal.toLowerCase().includes(searchQuery.toLowerCase())) return false
                  const tracked = trackedGoals.find(g =>
                    g.periodKey === week.key &&
                    (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
                  )
                  if (filterStatus === 'completed' && !tracked?.completed) return false
                  if (filterStatus === 'active' && tracked?.completed) return false
                  if (filterPriority !== null && (tracked?.priority || 0) !== filterPriority) return false
                  if (filterTag && !(tracked?.tags || []).includes(filterTag)) return false
                  return true
                })

                return (
                  <div
                    key={week.key}
                    className={`bg-slate-950/60 p-3 flex flex-col ${isDragOver ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); if (draggedGoal && draggedGoal.weekKey !== week.key) setDragOverWeek(week.key) }}
                    onDragLeave={() => setDragOverWeek(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedGoal && draggedGoal.weekKey !== week.key) onMoveGoal(draggedGoal.weekKey, week.key, draggedGoal.index, draggedGoal.goal)
                      setDraggedGoal(null); setDragOverWeek(null)
                    }}
                  >
                    {/* Заголовок недели */}
                    <div className="mb-2 pb-2 border-b border-slate-800/60 flex items-baseline gap-2">
                      <div className={`text-sm font-semibold ${isCurrentWeek ? 'text-blue-400' : 'text-slate-400'}`}>
                        Неделя {week.num}
                      </div>
                      <div className={`text-[11px] ${isCurrentWeek ? 'text-blue-400/60' : 'text-slate-600'}`}>
                        {week.start.getDate()}-{week.end.getDate()} {monthNames[week.end.getMonth()]?.slice(0, 3)}
                      </div>
                    </div>

                    {/* Добавить задачу в неделю */}
                    <div className="mb-2">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newWeekGoals[week.key] || ''}
                          onChange={(e) => setNewWeekGoals(prev => ({ ...prev, [week.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddWeekGoal(week.key) }}
                          placeholder="+ задача"
                          className="flex-1 px-2 py-1 text-xs border border-slate-800 rounded-lg bg-transparent text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-700"
                        />
                      </div>
                    </div>

                    {/* Задачи недели */}
                    <div className="flex-1 space-y-1">
                      {filtered.map(goal => {
                        const index = weekGoals.indexOf(goal)
                        const tracked = trackedGoals.find(g =>
                          g.periodKey === week.key &&
                          (g.text === goal || g.text.startsWith(goal.slice(0, 30)) || goal.startsWith(g.text.slice(0, 30)))
                        )
                        const isCompleted = tracked?.completed || false
                        const isProcessing = processingGoals.has(`${week.key}-${goal}`)
                        const isDragging = draggedGoal?.weekKey === week.key && draggedGoal?.index === index

                        return (
                          <div
                            key={index}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggedGoal({ weekKey: week.key, index, goal })
                            }}
                            onDragEnd={() => { setDraggedGoal(null); setDragOverWeek(null) }}
                            className={`flex items-start gap-2 py-1.5 px-1 rounded-lg group/wg transition-colors cursor-grab active:cursor-grabbing ${
                              isDragging ? 'opacity-40' : ''
                            } ${isCompleted ? 'bg-green-500/5' : 'hover:bg-slate-800/40'}`}
                          >
                            <button
                              disabled={isProcessing}
                              draggable={false}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); if (!isProcessing) onToggleGoalCompletion(week.key, goal, !isCompleted) }}
                              className={`flex-shrink-0 flex items-center justify-center rounded-md border transition-all mt-0.5 ${
                                isCompleted ? 'bg-green-500 border-green-500' : 'border-slate-600 hover:border-slate-400 bg-transparent'
                              } ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                              style={{ width: '16px', height: '16px', minWidth: '16px' }}
                            >
                              {isCompleted && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>

                            {editingWeekGoal?.weekKey === week.key && editingWeekGoal?.index === index ? (
                              <input
                                type="text"
                                value={editingWeekText}
                                onChange={(e) => setEditingWeekText(e.target.value)}
                                onBlur={() => { if (editingWeekText.trim()) onEditWeekGoal(week.key, index, editingWeekText); setEditingWeekGoal(null) }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { if (editingWeekText.trim()) onEditWeekGoal(week.key, index, editingWeekText); setEditingWeekGoal(null) }
                                  if (e.key === 'Escape') setEditingWeekGoal(null)
                                }}
                                className="flex-1 px-1.5 py-0.5 text-xs border border-slate-700 rounded bg-slate-950/50 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                autoFocus
                              />
                            ) : (
                              <span className={`flex-1 text-sm leading-tight ${isCompleted ? 'text-slate-500' : 'text-slate-200'}`}>
                                {goal}
                              </span>
                            )}

                            <div className="flex items-center gap-0.5 opacity-0 group-hover/wg:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => { setEditingWeekGoal({ weekKey: week.key, index }); setEditingWeekText(goal) }}
                                className="text-slate-600 hover:text-slate-300 p-0.5 rounded transition-colors text-xs"
                              >✎</button>
                              <button
                                draggable={false}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => onRemoveWeekGoal(week.key, index)}
                                className="text-slate-600 hover:text-red-400 p-0.5 rounded transition-colors text-xs"
                              >✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>


                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

