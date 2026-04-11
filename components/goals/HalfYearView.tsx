'use client'

import { useState, useMemo } from 'react'
import { Goal } from '@/lib/types'

interface HalfYearViewProps {
  year: number
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  onAddPeriodGoal: (key: string, text: string) => void
  onRemovePeriodGoal: (key: string, index: number) => void
  onEditPeriodGoal: (key: string, index: number, text: string) => void
  currentYear?: number
}

const H_COLORS = [
  { accent: 'from-sky-500 to-indigo-500', bg: 'bg-sky-400/10', border: 'border-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400' },
  { accent: 'from-rose-500 to-pink-500', bg: 'bg-rose-400/10', border: 'border-rose-400/30', text: 'text-rose-300', dot: 'bg-rose-400' },
]

const H_QUARTERS = [
  ['Q1', 'Q2'],
  ['Q3', 'Q4'],
]

const H_MONTHS = [
  ['Янв — Июн'],
  ['Июл — Дек'],
]

export default function HalfYearView({
  year,
  periodGoals,
  trackedGoals,
  onAddPeriodGoal,
  onRemovePeriodGoal,
  onEditPeriodGoal,
  currentYear,
}: HalfYearViewProps) {
  const now = new Date()
  const nowYear = currentYear ?? now.getFullYear()
  const nowHalf = now.getMonth() < 6 ? 1 : 2

  const halves = useMemo(() => {
    return [1, 2].map(h => {
      const key = `${year}-H${h}`
      const goals = periodGoals.get(key) || []
      const total = goals.length
      const completed = goals.filter(g =>
        trackedGoals.find(t => t.periodKey === key && t.text === g && t.completed)
      ).length
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      return { h, key, goals, total, completed, percent }
    })
  }, [year, periodGoals, trackedGoals])

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        Полугодия {year}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {halves.map((hd, i) => (
          <HalfYearCard
            key={hd.h}
            half={hd.h}
            periodKey={hd.key}
            goals={hd.goals}
            total={hd.total}
            completed={hd.completed}
            percent={hd.percent}
            color={H_COLORS[i]}
            quarters={H_QUARTERS[i]}
            months={H_MONTHS[i]}
            isPast={year < nowYear || (year === nowYear && hd.h < nowHalf)}
            onAdd={(text) => onAddPeriodGoal(hd.key, text)}
            onRemove={(index) => onRemovePeriodGoal(hd.key, index)}
            onEdit={(index, text) => onEditPeriodGoal(hd.key, index, text)}
          />
        ))}
      </div>
    </div>
  )
}

function HalfYearCard({
  half,
  periodKey: _periodKey,
  goals,
  total,
  completed,
  percent,
  color,
  quarters,
  months,
  isPast,
  onAdd,
  onRemove,
  onEdit,
}: {
  half: number
  periodKey: string
  goals: string[]
  total: number
  completed: number
  percent: number
  color: typeof H_COLORS[number]
  quarters: string[]
  months: string[]
  isPast: boolean
  onAdd: (text: string) => void
  onRemove: (index: number) => void
  onEdit: (index: number, text: string) => void
}) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [collapsed, setCollapsed] = useState(isPast && goals.length === 0)

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAdd(newGoal.trim())
      setNewGoal('')
    }
  }

  const startEdit = (index: number, text: string) => {
    setEditingIndex(index)
    setEditingText(text)
  }

  const saveEdit = (index: number) => {
    if (editingText.trim() && editingText.trim() !== goals[index]) {
      onEdit(index, editingText.trim())
    }
    setEditingIndex(null)
  }

  if (collapsed) {
    return (
      <div
        className="rounded-[20px] border border-slate-800/60 px-4 py-2.5 transition-all hover:border-slate-700 cursor-pointer opacity-60 hover:opacity-80"
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))' }}
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${color.accent}`} />
            <span className="text-sm font-bold text-slate-500">H{half}</span>
            <span className="text-xs text-slate-600">{months[0]} · {quarters.join(', ')}</span>
          </div>
          <span className="text-[10px] text-slate-600">развернуть</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-slate-800 p-4 transition-all hover:border-slate-700"
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${color.accent}`} />
          <span className="text-sm font-bold text-white">H{half}</span>
        </div>
        <span className="text-xs text-slate-500">{months[0]} · {quarters.join(', ')}</span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${color.accent} rounded-full transition-all duration-500`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {completed}/{total} — {percent}%
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {goals.length === 0 && (
        <p className="text-[11px] text-slate-600 italic mb-1">Разбейте годовые цели по полугодиям</p>
      )}

      {/* Goals list */}
      <div className="space-y-1 mb-2 max-h-28 overflow-y-auto chat-scrollbar">
        {goals.map((goal, index) => (
          <div key={index} className="group/hg flex items-start gap-1.5 text-xs">
            {editingIndex === index ? (
              <textarea
                value={editingText}
                onChange={(e) => { setEditingText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(index) }
                  if (e.key === 'Escape') setEditingIndex(null)
                }}
                onBlur={() => saveEdit(index)}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                rows={1}
                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none overflow-hidden"
                autoFocus
              />
            ) : (
              <>
                <span className={`mt-[3px] h-1.5 w-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
                <span
                  className="text-slate-300 leading-snug flex-1 cursor-text hover:text-slate-100 transition-colors"
                  onClick={() => startEdit(index, goal)}
                >
                  {goal}
                </span>
                <button
                  onClick={() => onRemove(index)}
                  className="text-slate-700 hover:text-red-400 opacity-0 group-hover/hg:opacity-100 transition-opacity flex-shrink-0"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add goal */}
      <textarea
        value={newGoal}
        onChange={(e) => { setNewGoal(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
        placeholder={`+ цель H${half}`}
        rows={1}
        className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors resize-none overflow-hidden"
      />
    </div>
  )
}
