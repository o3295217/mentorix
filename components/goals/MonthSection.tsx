'use client'

import { useState, useEffect, useMemo } from 'react'
import { Goal, GoalTag } from '@/lib/types'
import { monthNames, fuzzyMatchGoal } from '@/lib/goals-utils'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { useCopyDropdown } from '@/hooks/useCopyDropdown'
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
  tags: _tags = [],
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
            {monthNames[month]} {year}
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
            <div className="space-y-0">
              {unassignedGoals.map(({ text: goal, idx: originalIndex }) => {
                const tracked = trackedGoals.find(g =>
                  g.periodKey === monthKey && fuzzyMatchGoal(g.text, goal)
                )
                const isCompleted = tracked?.completed || false
                const isProcessing = processingGoals.has(`${monthKey}-${goal}`)
                return (
                  <div
                    key={originalIndex}
                    className={`flex items-center gap-3 py-0.5 px-3 rounded-xl transition-colors group/item ${isCompleted ? 'bg-green-500/5' : 'hover:bg-slate-800/30'}`}
                  >
                    <button
                      disabled={isProcessing}
                      onClick={() => { if (!isProcessing) onToggleGoalCompletion(monthKey, goal, !isCompleted) }}
                      className={`flex-shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-all ${
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
                      <div className="flex-1 min-w-0">
                        <span className={`${isCompleted ? 'text-slate-500' : 'text-slate-200'}`}>{goal}</span>
                        {tracked?.parentId && (() => {
                          const parentGoal = trackedGoals.find(g => g.id === tracked.parentId)
                          return parentGoal ? (
                            <div className="text-[10px] text-slate-500 truncate" title={parentGoal.text}>
                              ↑ {parentGoal.text.length > 35 ? parentGoal.text.slice(0, 35) + '…' : parentGoal.text}
                            </div>
                          ) : null
                        })()}
                      </div>
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
                const today = new Date()
                const isCurrentWeek = today >= week.start && today <= week.end

                return (
                  <WeekCard
                    key={week.key}
                    week={week}
                    weekGoals={periodGoals.get(week.key) || []}
                    isCurrentWeek={isCurrentWeek}
                    trackedGoals={trackedGoals}
                    tags={_tags}
                    onCreateTag={onCreateTag || (() => {})}
                    onSetGoalTags={onSetGoalTags || (() => {})}
                    draggedGoal={draggedGoal}
                    setDraggedGoal={setDraggedGoal}
                    dragOverWeek={dragOverWeek}
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
                    variant="grid"
                    newGoalValue={newWeekGoals[week.key] || ''}
                    onNewGoalChange={(val) => setNewWeekGoals(prev => ({ ...prev, [week.key]: val }))}
                  />
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
