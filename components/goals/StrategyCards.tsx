'use client'

import { useState, useMemo } from 'react'
import { useInlineEdit } from '@/hooks/useInlineEdit'

interface StrategyCardsProps {
  years: number[]
  selectedYear: number
  onSelectYear: (year: number) => void
  currentYear: number
  yearGoals: Map<number, string[]>
  periodGoals: Map<string, string[]>
  onAddYearGoal: (year: number, text: string) => void
  onRemoveYearGoal: (year: number, index: number) => void
  onEditYearGoal: (year: number, index: number, text: string) => void
}

const YEAR_COLORS = [
  { border: 'border-blue-400/30', bg: 'bg-blue-400/10', text: 'text-blue-300', glow: 'rgba(59,130,246,0.08)' },
  { border: 'border-violet-400/30', bg: 'bg-violet-400/10', text: 'text-violet-300', glow: 'rgba(139,92,246,0.08)' },
  { border: 'border-emerald-400/30', bg: 'bg-emerald-400/10', text: 'text-emerald-300', glow: 'rgba(52,211,153,0.08)' },
  { border: 'border-amber-400/30', bg: 'bg-amber-400/10', text: 'text-amber-300', glow: 'rgba(251,191,36,0.08)' },
  { border: 'border-rose-400/30', bg: 'bg-rose-400/10', text: 'text-rose-300', glow: 'rgba(251,113,133,0.08)' },
]

export default function StrategyCards({
  years,
  selectedYear,
  onSelectYear,
  currentYear,
  yearGoals,
  periodGoals,
  onAddYearGoal,
  onRemoveYearGoal,
  onEditYearGoal,
}: StrategyCardsProps) {
  return (
    <div className="overflow-x-auto pb-2 -mx-1 scrollbar-hide">
      <div className="flex gap-4 px-1 snap-x snap-mandatory md:snap-none" style={{ minWidth: 'min-content' }}>
        {years.map((year, i) => (
          <YearCard
            key={year}
            year={year}
            isSelected={year === selectedYear}
            isCurrent={year === currentYear}
            goals={yearGoals.get(year) || []}
            periodGoals={periodGoals}
            color={YEAR_COLORS[i % YEAR_COLORS.length]}
            onSelect={() => onSelectYear(year)}
            onAddGoal={(text) => onAddYearGoal(year, text)}
            onRemoveGoal={(index) => onRemoveYearGoal(year, index)}
            onEditGoal={(index, text) => onEditYearGoal(year, index, text)}
          />
        ))}
      </div>
    </div>
  )
}

function YearCard({
  year,
  isSelected,
  isCurrent,
  goals,
  periodGoals,
  color,
  onSelect,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
}: {
  year: number
  isSelected: boolean
  isCurrent: boolean
  goals: string[]
  periodGoals: Map<string, string[]>
  color: typeof YEAR_COLORS[number]
  onSelect: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
}) {
  const [newGoal, setNewGoal] = useState('')
  const [showQuarters, setShowQuarters] = useState(false)
  const { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit } = useInlineEdit(onEditGoal)

  const quarterData = useMemo(() => {
    return [1, 2, 3, 4].map(q => {
      const key = `${year}-Q${q}`
      const qGoals = periodGoals.get(key) || []
      return { quarter: q, goals: qGoals, key }
    })
  }, [year, periodGoals])

  const totalQuarterGoals = quarterData.reduce((sum, q) => sum + q.goals.length, 0)

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal.trim())
      setNewGoal('')
    }
  }

  return (
    <div
      className={`
        flex-shrink-0 w-64 sm:w-72 rounded-[24px] border p-4 sm:p-5 transition-all cursor-pointer snap-center
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${color.border} ${color.bg}`}>
            <span className={`text-sm font-bold tabular-nums ${color.text}`}>{String(year).slice(-2)}</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white leading-none">{year}</h3>
            {isCurrent && (
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-blue-400">сейчас</span>
            )}
          </div>
        </div>
        {goals.length > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-semibold text-slate-400 tabular-nums">{goals.length}</span>
        )}
      </div>

      {/* Goals list */}
      <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto chat-scrollbar">
        {goals.length === 0 && (
          <p className="text-xs text-slate-600 italic">Нет целей</p>
        )}
        {goals.map((goal, index) => (
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
        ))}
      </div>

      {/* Add goal */}
      <div className="flex gap-1.5">
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

      {/* Quarters (collapsed) */}
      {totalQuarterGoals > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800/60">
          <button
            onClick={(e) => { e.stopPropagation(); setShowQuarters(!showQuarters) }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors w-full"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showQuarters ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Кварталы ({totalQuarterGoals})
          </button>
          {showQuarters && (
            <div className="mt-2 space-y-2">
              {quarterData.filter(q => q.goals.length > 0).map(q => (
                <div key={q.quarter} className="text-xs">
                  <p className="text-slate-400 font-medium mb-0.5">Q{q.quarter}</p>
                  {q.goals.map((g, i) => (
                    <p key={i} className="text-slate-500 pl-3">• {g}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
