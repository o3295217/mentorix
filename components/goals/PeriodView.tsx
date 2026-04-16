'use client'

import { useState, useMemo } from 'react'
import { Goal } from '@/lib/types'
import { resolvePeriodMeta } from '@/lib/goals-utils'
import type { PeriodType } from '@/lib/goals-utils'

interface PeriodViewProps {
  variant: 'quarter' | 'half_year'
  year: number
  periodGoals: Map<string, string[]>
  trackedGoals: Goal[]
  addPeriodGoal: (key: string, periodType: PeriodType, date: Date, label: string, text: string) => void
  removePeriodGoal: (key: string, index: number, periodType: PeriodType, date: Date, label: string) => void
  editPeriodGoal: (key: string, index: number, periodType: PeriodType, date: Date, label: string, text: string) => void
  currentYear?: number
}

type ColorDef = { accent: string; bg: string; border: string; text: string; dot: string }

const Q_COLORS: ColorDef[] = [
  { accent: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  { accent: 'from-violet-500 to-fuchsia-500', bg: 'bg-violet-400/10', border: 'border-violet-400/30', text: 'text-violet-300', dot: 'bg-violet-400' },
  { accent: 'from-amber-500 to-orange-500', bg: 'bg-amber-400/10', border: 'border-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400' },
  { accent: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
]

const H_COLORS: ColorDef[] = [
  { accent: 'from-sky-500 to-indigo-500', bg: 'bg-sky-400/10', border: 'border-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400' },
  { accent: 'from-rose-500 to-pink-500', bg: 'bg-rose-400/10', border: 'border-rose-400/30', text: 'text-rose-300', dot: 'bg-rose-400' },
]

const CONFIGS = {
  quarter: {
    count: 4,
    colors: Q_COLORS,
    title: 'Кварталы',
    gridCols: 'grid-cols-2 md:grid-cols-4',
    emptyHint: 'Разбейте годовые цели по кварталам',
    keyPrefix: 'Q',
    label: (i: number) => `Q${i}`,
    subtitle: (i: number) => {
      const months = [['Янв', 'Фев', 'Мар'], ['Апр', 'Май', 'Июн'], ['Июл', 'Авг', 'Сен'], ['Окт', 'Ноя', 'Дек']]
      return months[i - 1].join(' · ')
    },
    getKey: (year: number, i: number) => `${year}-Q${i}`,
    isPast: (i: number, year: number, nowYear: number, now: Date) =>
      year < nowYear || (year === nowYear && i < Math.floor(now.getMonth() / 3) + 1),
  },
  half_year: {
    count: 2,
    colors: H_COLORS,
    title: 'Полугодия',
    gridCols: 'grid-cols-1 md:grid-cols-2',
    emptyHint: 'Разбейте годовые цели по полугодиям',
    keyPrefix: 'H',
    label: (i: number) => `H${i}`,
    subtitle: (i: number) => {
      const data = [
        { months: 'Янв — Июн', quarters: 'Q1, Q2' },
        { months: 'Июл — Дек', quarters: 'Q3, Q4' },
      ]
      const d = data[i - 1]
      return `${d.months} · ${d.quarters}`
    },
    getKey: (year: number, i: number) => `${year}-H${i}`,
    isPast: (i: number, year: number, nowYear: number, now: Date) =>
      year < nowYear || (year === nowYear && i < (now.getMonth() < 6 ? 1 : 2)),
  },
} as const

export default function PeriodView({
  variant,
  year,
  periodGoals,
  trackedGoals,
  addPeriodGoal,
  removePeriodGoal,
  editPeriodGoal,
  currentYear,
}: PeriodViewProps) {
  const cfg = CONFIGS[variant]
  const now = new Date()
  const nowYear = currentYear ?? now.getFullYear()

  const items = useMemo(() => {
    return Array.from({ length: cfg.count }, (_, idx) => {
      const i = idx + 1
      const key = cfg.getKey(year, i)
      const goals = periodGoals.get(key) || []
      const total = goals.length
      const completed = goals.filter(g =>
        trackedGoals.find(t => t.periodKey === key && t.text === g && t.completed)
      ).length
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0
      return { i, key, goals, total, completed, percent }
    })
  }, [year, periodGoals, trackedGoals, cfg])

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        {cfg.title} {year}
      </div>
      <div className={`grid ${cfg.gridCols} gap-3`}>
        {items.map((item, idx) => (
          <PeriodCard
            key={item.i}
            label={cfg.label(item.i)}
            subtitle={cfg.subtitle(item.i)}
            goals={item.goals}
            total={item.total}
            completed={item.completed}
            percent={item.percent}
            color={cfg.colors[idx]}
            emptyHint={cfg.emptyHint}
            isPast={cfg.isPast(item.i, year, nowYear, now)}
            onAdd={(text) => {
              const m = resolvePeriodMeta(item.key)
              if (m) addPeriodGoal(item.key, m.periodType, m.date, m.label, text)
            }}
            onRemove={(index) => {
              const m = resolvePeriodMeta(item.key)
              if (m) removePeriodGoal(item.key, index, m.periodType, m.date, m.label)
            }}
            onEdit={(index, text) => {
              const m = resolvePeriodMeta(item.key)
              if (m) editPeriodGoal(item.key, index, m.periodType, m.date, m.label, text)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function PeriodCard({
  label,
  subtitle,
  goals,
  total,
  completed,
  percent,
  color,
  emptyHint,
  isPast,
  onAdd,
  onRemove,
  onEdit,
}: {
  label: string
  subtitle: string
  goals: string[]
  total: number
  completed: number
  percent: number
  color: ColorDef
  emptyHint: string
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
            <span className="text-sm font-bold text-slate-500">{label}</span>
            <span className="text-xs text-slate-600">{subtitle}</span>
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
          <span className="text-sm font-bold text-white">{label}</span>
        </div>
        <span className="text-xs text-slate-500">{subtitle}</span>
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
        <p className="text-[11px] text-slate-600 italic mb-1">{emptyHint}</p>
      )}

      {/* Goals list */}
      <div className="space-y-1 mb-2 max-h-28 overflow-y-auto chat-scrollbar">
        {goals.map((goal, index) => (
          <div key={index} className="group/pg flex items-start gap-1.5 text-xs">
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
                  className="text-slate-700 hover:text-red-400 opacity-0 group-hover/pg:opacity-100 transition-opacity flex-shrink-0"
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
        placeholder={`+ цель ${label}`}
        rows={1}
        className="w-full bg-slate-950/30 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors resize-none overflow-hidden"
      />
    </div>
  )
}
