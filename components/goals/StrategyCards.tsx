'use client'

import { useState, useMemo } from 'react'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { Goal } from '@/lib/types'

interface StrategyCardsProps {
  years: number[]
  selectedYear: number
  onSelectYear: (year: number) => void
  currentYear: number
  yearGoals: Map<number, string[]>
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  onAddYearGoal: (year: number, text: string) => void
  onRemoveYearGoal: (year: number, index: number) => void
  onEditYearGoal: (year: number, index: number, text: string) => void
}

const YEAR_COLORS = [
  { border: 'border-blue-400/30', bg: 'bg-blue-400/10', text: 'text-blue-300', bar: 'from-blue-500 to-blue-400', glow: 'rgba(59,130,246,0.08)' },
  { border: 'border-violet-400/30', bg: 'bg-violet-400/10', text: 'text-violet-300', bar: 'from-violet-500 to-violet-400', glow: 'rgba(139,92,246,0.08)' },
  { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-300', bar: 'from-emerald-500 to-emerald-400', glow: 'rgba(52,211,153,0.08)' },
  { border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-300', bar: 'from-amber-500 to-amber-400', glow: 'rgba(251,191,36,0.08)' },
  { border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-300', bar: 'from-rose-500 to-rose-400', glow: 'rgba(251,113,133,0.08)' },
]

export default function StrategyCards({
  years,
  selectedYear,
  onSelectYear,
  currentYear,
  yearGoals,
  periodGoals,
  trackedGoals,
  onAddYearGoal,
  onRemoveYearGoal,
  onEditYearGoal,
}: StrategyCardsProps) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        Стратегические цели ({years.length > 0 ? `${years.length} ${years.length === 1 ? 'год' : years.length < 5 ? 'года' : 'лет'}` : ''})
      </div>
      <div className="overflow-x-auto pb-2 -mx-1 scrollbar-hide">
        <div className="flex gap-4 px-1 pr-16 snap-x snap-mandatory md:snap-none" style={{ minWidth: 'min-content' }}>
          {years.map((year, i) => (
            <YearCard
              key={year}
              year={year}
              isSelected={year === selectedYear}
              isCurrent={year === currentYear}
              isPast={year < currentYear}
              goals={yearGoals.get(year) || []}
              periodGoals={periodGoals}
              trackedGoals={trackedGoals}
              color={YEAR_COLORS[i % YEAR_COLORS.length]}
              onSelect={() => onSelectYear(year)}
              onAddGoal={(text) => onAddYearGoal(year, text)}
              onRemoveGoal={(index) => onRemoveYearGoal(year, index)}
              onEditGoal={(index, text) => onEditYearGoal(year, index, text)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function YearCard({
  year,
  isSelected,
  isCurrent: _isCurrent,
  isPast,
  goals,
  periodGoals,
  trackedGoals,
  color,
  onSelect,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
}: {
  year: number
  isSelected: boolean
  isCurrent: boolean
  isPast: boolean
  goals: string[]
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  color: typeof YEAR_COLORS[number]
  onSelect: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
}) {
  const [newGoal, setNewGoal] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [titleExpanded, setTitleExpanded] = useState(false)
  const { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit } = useInlineEdit(onEditGoal)

  // Calculate total progress across all periods for this year
  const yearProgress = useMemo(() => {
    const yearPrefix = `${year}-`
    const yearGoalItems = trackedGoals.filter(t => t.periodKey.startsWith(yearPrefix))
    const total = yearGoalItems.length
    const completed = yearGoalItems.filter(t => t.completed).length
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percent }
  }, [year, trackedGoals])

  // Status label
  const statusLabel = goals.length === 0
    ? (yearProgress.total > 0 ? `${yearProgress.total} подцелей` : (isPast ? 'не заполнено' : 'запланировано'))
    : yearProgress.total === 0
      ? (isPast ? 'не заполнено' : 'запланировано')
      : yearProgress.percent === 100
        ? 'выполнено'
        : `${yearProgress.percent}% выполнено`

  // Summary: first goal as title or year only
  const summaryTitle = goals.length > 0 ? goals[0] : null

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal.trim())
      setNewGoal('')
    }
  }

  return (
    <div
      className={`
        flex-shrink-0 w-56 sm:w-64 rounded-[24px] border p-4 transition-all cursor-pointer snap-center
        ${isSelected
          ? 'border-blue-500/40 ring-1 ring-blue-500/20 shadow-[0_18px_60px_rgba(59,130,246,0.12)]'
          : 'border-slate-800 hover:border-slate-700'
        }
      `}
      style={{
        background: `radial-gradient(circle at top left, ${color.glow}, transparent 50%), linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))`,
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, textarea')) return
        onSelect()
      }}
    >
      {/* Year label */}
      <div className="text-sm text-slate-500 font-medium tabular-nums">{year}</div>

      {/* Summary title — first goal as bold headline */}
      {summaryTitle ? (
        editingIndex === 0 ? (
          <input
            type="text"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(0)
              if (e.key === 'Escape') cancelEdit()
            }}
            onBlur={() => saveEdit(0)}
            className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-2.5 py-1.5 text-lg font-bold text-white mt-1 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="group/title relative mt-1">
            <h3
              className={`text-lg font-bold tracking-tight text-white leading-tight cursor-pointer pr-5 ${titleExpanded ? '' : 'line-clamp-2'}`}
              onClick={(e) => { e.stopPropagation(); setTitleExpanded(!titleExpanded) }}
              onDoubleClick={(e) => { e.stopPropagation(); startEdit(0, summaryTitle) }}
            >
              {summaryTitle}
            </h3>
            <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover/title:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(0, summaryTitle) }}
                className="text-slate-600 hover:text-blue-400 transition-colors"
                title="Редактировать"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveGoal(0) }}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title="Удалить"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-1">
          <h3 className="text-base font-semibold tracking-tight text-slate-500 italic">Нет целей</h3>
          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">Какие цели на этот год?</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-4">
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${color.bar} rounded-full transition-all duration-500`}
            style={{ width: `${yearProgress.percent}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 mt-1.5">{statusLabel}</div>
      </div>

      {/* Expand to see all goals */}
      {goals.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 mt-3 transition-colors"
      >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Все цели ({goals.length})
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto chat-scrollbar">
          {goals.slice(1).map((goal, i) => {
            const index = i + 1
            return (
              <div key={index} className="group/goal flex items-start gap-2 text-sm">
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(index)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={() => saveEdit(index)}
                    className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${color.bg} ${color.border} border`} />
                    <span
                      className="text-slate-300 leading-snug flex-1 cursor-text hover:text-slate-100 transition-colors"
                      onClick={(e) => { e.stopPropagation(); startEdit(index, goal) }}
                    >
                      {goal}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveGoal(index) }}
                      className="text-slate-700 hover:text-red-400 opacity-0 group-hover/goal:opacity-100 transition-opacity text-xs flex-shrink-0"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add goal */}
      <div className="flex gap-1.5 mt-3">
        <input
          type="text"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="+ цель на год"
          className="flex-1 bg-slate-950/30 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
