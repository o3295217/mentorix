'use client'

import { useState, useMemo } from 'react'
import { Goal } from '@/lib/types'

interface QuarterViewProps {
  year: number
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  onAddPeriodGoal: (key: string, text: string) => void
  onRemovePeriodGoal: (key: string, index: number) => void
  onEditPeriodGoal: (key: string, index: number, text: string) => void
}

const Q_COLORS = [
  { accent: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  { accent: 'from-violet-500 to-fuchsia-500', bg: 'bg-violet-400/10', border: 'border-violet-400/30', text: 'text-violet-300', dot: 'bg-violet-400' },
  { accent: 'from-amber-500 to-orange-500', bg: 'bg-amber-400/10', border: 'border-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400' },
  { accent: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
]

const Q_MONTHS = [
  ['Янв', 'Фев', 'Мар'],
  ['Апр', 'Май', 'Июн'],
  ['Июл', 'Авг', 'Сен'],
  ['Окт', 'Ноя', 'Дек'],
]

export default function QuarterView({
  year,
  periodGoals,
  trackedGoals,
  onAddPeriodGoal,
  onRemovePeriodGoal,
  onEditPeriodGoal,
}: QuarterViewProps) {
  const quarters = useMemo(() => {
    return [1, 2, 3, 4].map(q => {
      const key = `${year}-Q${q}`
      const goals = periodGoals.get(key) || []
      const total = goals.length
      const completed = goals.filter(g =>
        trackedGoals.find(t => t.periodKey === key && t.text === g && t.completed)
      ).length
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      return { q, key, goals, total, completed, percent }
    })
  }, [year, periodGoals, trackedGoals])

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        Кварталы {year}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quarters.map((qd, i) => (
          <QuarterCard
            key={qd.q}
            quarter={qd.q}
            periodKey={qd.key}
            goals={qd.goals}
            total={qd.total}
            completed={qd.completed}
            percent={qd.percent}
            color={Q_COLORS[i]}
            months={Q_MONTHS[i]}
            onAdd={(text) => onAddPeriodGoal(qd.key, text)}
            onRemove={(index) => onRemovePeriodGoal(qd.key, index)}
            onEdit={(index, text) => onEditPeriodGoal(qd.key, index, text)}
          />
        ))}
      </div>
    </div>
  )
}

function QuarterCard({
  quarter,
  periodKey: _periodKey,
  goals,
  total,
  completed,
  percent,
  color,
  months,
  onAdd,
  onRemove,
  onEdit,
}: {
  quarter: number
  periodKey: string
  goals: string[]
  total: number
  completed: number
  percent: number
  color: typeof Q_COLORS[number]
  months: string[]
  onAdd: (text: string) => void
  onRemove: (index: number) => void
  onEdit: (index: number, text: string) => void
}) {
  const [newGoal, setNewGoal] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

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
          <span className="text-sm font-bold text-white">Q{quarter}</span>
        </div>
        <span className="text-[10px] text-slate-500">{months.join(' · ')}</span>
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
        <p className="text-[11px] text-slate-600 italic mb-1">Разбейте годовые цели по кварталам</p>
      )}

      {/* Goals list */}
      <div className="space-y-1 mb-2 max-h-28 overflow-y-auto chat-scrollbar">
        {goals.map((goal, index) => (
          <div key={index} className="group/qg flex items-start gap-1.5 text-xs">
            {editingIndex === index ? (
              <input
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(index)
                  if (e.key === 'Escape') setEditingIndex(null)
                }}
                onBlur={() => saveEdit(index)}
                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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
                  className="text-slate-700 hover:text-red-400 opacity-0 group-hover/qg:opacity-100 transition-opacity flex-shrink-0"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add goal */}
      <input
        type="text"
        value={newGoal}
        onChange={(e) => setNewGoal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder={`+ цель Q${quarter}`}
        className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
      />
    </div>
  )
}
