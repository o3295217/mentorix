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
      <div className="flex gap-3 px-1 snap-x snap-mandatory md:snap-none" style={{ minWidth: 'min-content' }}>
        {years.map(year => (
          <YearCard
            key={year}
            year={year}
            isSelected={year === selectedYear}
            isCurrent={year === currentYear}
            goals={yearGoals.get(year) || []}
            periodGoals={periodGoals}
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
        flex-shrink-0 w-64 sm:w-72 rounded-xl border p-3 sm:p-4 transition-all cursor-pointer snap-center
        ${isSelected
          ? 'border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20'
          : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'
        }
      `}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, textarea')) return
        onSelect()
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">{year}</h3>
          {isCurrent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">
              сейчас
            </span>
          )}
        </div>
        {goals.length > 0 && (
          <span className="text-xs text-gray-500 tabular-nums">{goals.length}</span>
        )}
      </div>

      {/* Goals list */}
      <div className="space-y-1 mb-3 max-h-40 overflow-y-auto chat-scrollbar">
        {goals.length === 0 && (
          <p className="text-xs text-gray-600 italic">Нет целей</p>
        )}
        {goals.map((goal, index) => (
          <div key={index} className="group/goal flex items-start gap-1.5 text-sm">
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
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                autoFocus
              />
            ) : (
              <>
                <span className="text-gray-500 mt-0.5 flex-shrink-0 text-xs">•</span>
                <span
                  className="text-gray-300 leading-snug flex-1 cursor-text hover:text-gray-100 transition-colors"
                  onClick={(e) => { e.stopPropagation(); startEdit(index, goal) }}
                >
                  {goal}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveGoal(index) }}
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover/goal:opacity-100 transition-opacity text-xs flex-shrink-0"
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
          className="flex-1 bg-transparent border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Quarters (collapsed) */}
      {totalQuarterGoals > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <button
            onClick={(e) => { e.stopPropagation(); setShowQuarters(!showQuarters) }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
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
                  <p className="text-gray-400 font-medium mb-0.5">Q{q.quarter}</p>
                  {q.goals.map((g, i) => (
                    <p key={i} className="text-gray-500 pl-3">• {g}</p>
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
