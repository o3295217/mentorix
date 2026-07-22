'use client'

import { useState, useMemo } from 'react'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { Goal, YearGoalItem } from '@/lib/types'

interface StrategyCardsProps {
  years: number[]
  horizonLabel?: string | null
  hasArchive?: boolean
  selectedYear: number
  onSelectYear: (year: number) => void
  currentYear: number
  yearGoals: Map<number, YearGoalItem[]>
  trackedGoals: Goal[]
  yearEvaluations: Record<number, { avg: number; count: number }>
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
  horizonLabel,
  hasArchive = false,
  selectedYear,
  onSelectYear,
  currentYear,
  yearGoals,
  trackedGoals,
  yearEvaluations,
  onAddYearGoal,
  onRemoveYearGoal,
  onEditYearGoal,
}: StrategyCardsProps) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
        Стратегические цели{horizonLabel ? ` (${horizonLabel}${hasArchive ? ' + архив' : ''})` : hasArchive ? ' (архив)' : ''}
      </div>
      <div className="overflow-x-auto pb-2 -mx-1 scrollbar-hide">
        <div className="flex gap-4 px-1 pr-16 snap-x snap-mandatory md:snap-none" style={{ minWidth: 'min-content' }}>
          {years.map((year, i) => (
            <YearCard
              key={year}
              year={year}
              isSelected={year === selectedYear}
              isPast={year < currentYear}
              yearOffset={year - currentYear}
              goals={yearGoals.get(year) || []}
              trackedGoals={trackedGoals}
              evalData={yearEvaluations[year]}
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
  isPast,
  yearOffset,
  goals,
  trackedGoals,
  evalData,
  color,
  onSelect,
  onAddGoal,
  onRemoveGoal,
  onEditGoal,
}: {
  year: number
  isSelected: boolean
  isPast: boolean
  yearOffset: number
  goals: YearGoalItem[]
  trackedGoals: Goal[]
  evalData?: { avg: number; count: number }
  color: typeof YEAR_COLORS[number]
  onSelect: () => void
  onAddGoal: (text: string) => void
  onRemoveGoal: (index: number) => void
  onEditGoal: (index: number, text: string) => void
}) {
  // Перспективный эффект: текущий год — полный, прошлые и будущие уменьшаются и тускнеют
  const BASE_WIDTH = 256
  const cardWidth = yearOffset < 0
    ? Math.round(BASE_WIDTH * 0.80)               // прошлый: -20%
    : Math.round(BASE_WIDTH * Math.max(0.70, 1 - yearOffset * 0.05))  // будущие: -5% за каждый год
  const cardOpacity = yearOffset < 0
    ? 0.46                                        // прошлый: как дальний будущий год, без лишнего затемнения
    : yearOffset === 0
      ? 1                                         // текущий: полная яркость
      : Math.max(0.38, 1 - yearOffset * 0.18)    // будущие: -18% за каждый год
  const [newGoal, setNewGoal] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [titleExpanded, setTitleExpanded] = useState(false)
  const { editingIndex, editingText, setEditingText, startEdit, cancelEdit, saveEdit } = useInlineEdit(onEditGoal)

  // Weighted progress: tasks decomposed from year goals (via rootYearGoalId) + daily AI evaluation
  const yearProgress = useMemo(() => {
    const PERIOD_WEIGHT: Record<string, number> = {
      half_year: 8,
      quarter: 4,
      month: 2,
      week: 1,
    }
    const yearGoalIds = new Set(goals.map(g => g.id))
    const relevantGoals = trackedGoals.filter(t =>
      t.rootYearGoalId &&
      yearGoalIds.has(t.rootYearGoalId)
    )
    const total = relevantGoals.length
    const completed = total > 0 ? relevantGoals.filter(t => t.completed).length : 0
    let taskPercent = 0
    if (total > 0) {
      let totalWeight = 0
      let completedWeight = 0
      for (const g of relevantGoals) {
        const w = PERIOD_WEIGHT[g.periodType] ?? 1
        totalWeight += w
        if (g.completed) completedWeight += w
      }
      taskPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0
    }

    // Daily AI evaluation: effective days (score/10 each) as % of elapsed days in year
    const hasEval = evalData && evalData.count > 0
    let evalPercent = 0
    if (hasEval) {
      const effectiveDays = evalData.count * evalData.avg / 10
      const now = new Date()
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year + 1, 0, 1)
      const totalDaysInYear = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000)
      const daysElapsed = year < now.getFullYear()
        ? totalDaysInYear
        : year === now.getFullYear()
          ? Math.max(1, Math.floor((now.getTime() - yearStart.getTime()) / 86400000) + 1)
          : 1
      evalPercent = Math.min(100, Math.round((effectiveDays / daysElapsed) * 100))
    }

    // Combined progress: tasks have max weight (70%), eval supplements (30%)
    let percent: number
    if (total > 0 && hasEval) {
      percent = Math.round(taskPercent * 0.7 + evalPercent * 0.3)
    } else if (hasEval) {
      percent = evalPercent
    } else {
      percent = taskPercent
    }

    return { total, completed, percent, taskPercent, evalPercent: hasEval ? evalPercent : null }
  }, [goals, trackedGoals, evalData])

  // Status label
  const statusLabel = goals.length === 0
    ? (yearProgress.total > 0 ? `${yearProgress.total} подцелей` : (yearProgress.evalPercent !== null ? `${yearProgress.percent}% по оценкам` : (isPast ? 'не заполнено' : 'запланировано')))
    : yearProgress.total === 0 && yearProgress.evalPercent === null
      ? (isPast ? 'не заполнено' : 'запланировано')
      : yearProgress.percent === 100
        ? 'выполнено'
        : `${yearProgress.percent}% выполнено`

  // Summary: first goal as title or year only
  const summaryTitle = goals.length > 0 ? goals[0].text : null

  const handleAdd = () => {
    if (newGoal.trim()) {
      onAddGoal(newGoal.trim())
      setNewGoal('')
    }
  }

  return (
    <div
      className={`
        flex-shrink-0 rounded-[24px] border p-4 transition-all cursor-pointer snap-center
        ${isSelected
          ? isPast
            ? 'border-slate-600/50 ring-1 ring-slate-500/20 shadow-[0_18px_60px_rgba(15,23,42,0.20)]'
            : 'border-blue-500/40 ring-1 ring-blue-500/20 shadow-[0_18px_60px_rgba(59,130,246,0.12)]'
          : isPast
            ? 'border-slate-800/60 hover:border-slate-700/60'
            : 'border-slate-800 hover:border-slate-700'
        }
      `}
      style={{
        width: cardWidth,
        opacity: cardOpacity,
        background: isPast
          ? 'linear-gradient(180deg, rgba(15,23,42,0.82), rgba(2,6,23,0.92))'
          : `radial-gradient(circle at top left, ${color.glow}, transparent 50%), linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))`,
        transition: 'opacity 0.2s',
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button, textarea')) return
        onSelect()
      }}
    >
      {/* Year label */}
      <div className={`text-sm font-medium tabular-nums ${isPast ? 'text-slate-600' : 'text-slate-500'}`}>{year}</div>

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
            className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:text-lg"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="goal-action-surface mt-1 min-w-0">
            <h3
              className={`break-words text-lg font-bold leading-tight tracking-tight [overflow-wrap:anywhere] ${isPast ? 'text-slate-300' : 'text-white'} ${titleExpanded ? '' : 'line-clamp-2'}`}
              onClick={(e) => { e.stopPropagation(); setTitleExpanded(!titleExpanded) }}
              onDoubleClick={(e) => { e.stopPropagation(); startEdit(0, summaryTitle) }}
            >
              {summaryTitle}
            </h3>
            <div className="goal-hover-actions mt-1 flex flex-wrap justify-end gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); startEdit(0, summaryTitle) }}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:h-8 lg:w-8"
                title="Редактировать"
                aria-label={`Редактировать цель «${summaryTitle}»`}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveGoal(0) }}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:h-8 lg:w-8"
                title="Удалить"
                aria-label={`Удалить цель «${summaryTitle}»`}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-1">
          <h3 className={`text-base font-semibold tracking-tight italic ${isPast ? 'text-slate-600' : 'text-slate-500'}`}>Нет целей</h3>
          <p className={`text-[11px] mt-1 leading-relaxed ${isPast ? 'text-slate-700' : 'text-slate-600'}`}>Какие цели на этот год?</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-4">
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${isPast ? 'bg-slate-600' : `bg-gradient-to-r ${color.bar}`} rounded-full transition-all duration-500`}
            style={{ width: `${yearProgress.percent}%` }}
          />
        </div>
        <div className={`text-xs mt-1.5 ${isPast ? 'text-slate-600' : 'text-slate-500'}`}>{statusLabel}</div>
      </div>

      {/* Expand to see all goals */}
      {goals.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="mt-3 flex min-h-11 w-full items-center gap-1 rounded-lg px-2 text-left text-xs text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:w-auto lg:px-0 lg:text-[11px]"
          aria-expanded={expanded}
          aria-controls={`year-goals-${year}`}
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Все цели ({goals.length})
        </button>
      )}

      {expanded && (
        <div id={`year-goals-${year}`} className="chat-scrollbar mt-2 max-h-48 space-y-1.5 overflow-y-auto">
          {goals.slice(1).map((goal, i) => {
            const index = i + 1
            return (
              <div key={goal.id} className="goal-action-surface flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
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
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2 text-base text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 lg:text-sm"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className={`mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full border ${color.bg} ${color.border}`} />
                    <span
                      className="min-w-0 flex-1 break-words py-1.5 leading-snug text-slate-300 transition-colors [overflow-wrap:anywhere] hover:text-slate-100"
                      onClick={(e) => { e.stopPropagation(); startEdit(index, goal.text) }}
                    >
                      {goal.text}
                    </span>
                    <div className="goal-hover-actions flex basis-full flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(index, goal.text) }}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-sm text-slate-500 transition-colors hover:bg-slate-800 hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:h-8 lg:w-8"
                        aria-label={`Редактировать цель «${goal.text}»`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveGoal(index) }}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 lg:h-8 lg:w-8"
                        aria-label={`Удалить цель «${goal.text}»`}
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add goal */}
      <div className="mt-3 flex min-w-0 gap-1.5">
        <input
          type="text"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="+ цель на год"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 text-base text-slate-300 placeholder-slate-600 transition-colors focus:border-slate-600 focus:outline-none lg:text-xs"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
