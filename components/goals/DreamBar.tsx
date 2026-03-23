'use client'

import { useState, useEffect } from 'react'
import { DreamGoal } from '@/lib/types'
import { formatHorizon } from '@/lib/dates'

interface DreamBarProps {
  dreamGoal: DreamGoal | null
  onSave: (text: string, months: number | null) => Promise<void>
  progress: { total: number; completed: number; percent: number }
  isSetup: boolean
  onSetupComplete: () => void
  onOpenChat: () => void
}

const HORIZON_PRESETS = [
  { months: 3, label: '3 мес' },
  { months: 6, label: '6 мес' },
  { months: 12, label: '1 год' },
  { months: 24, label: '2 года' },
  { months: 36, label: '3 года' },
  { months: 60, label: '5 лет' },
  { months: 120, label: '10 лет' },
]

export default function DreamBar({ dreamGoal, onSave, progress, isSetup, onSetupComplete, onOpenChat }: DreamBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [text, setText] = useState('')
  const [months, setMonths] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (dreamGoal) {
      setText(dreamGoal.goalText)
      setMonths(dreamGoal.months)
    }
  }, [dreamGoal])

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await onSave(text, months)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // State 0: No dream
  if (!dreamGoal && !isEditing) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border-2 border-dashed border-slate-700 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.08),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-8 md:p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 mb-5">
          <svg className="h-7 w-7 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-2">Напиши свою мечту</h2>
        <p className="text-sm text-slate-400 leading-6 max-w-md mx-auto mb-6">
          С чего начинается любой великий путь? С мечты. Опиши, чего хочешь достичь — и мы построим план от этой точки.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-400"
        >
          Создать мечту
        </button>
      </div>
    )
  }

  // Edit / Create mode
  if (isEditing || !dreamGoal) {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-blue-500/30 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 mb-3">
          {dreamGoal ? 'Редактировать мечту' : 'Твоя мечта'}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-4 py-3 border border-slate-700 rounded-2xl bg-slate-950/50 text-[15px] text-slate-200 leading-7 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
          rows={3}
          placeholder="Например: Построить международную IT-компанию и жить у океана..."
          autoFocus
        />
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Горизонт:</span>
            {HORIZON_PRESETS.map((p) => (
              <button
                key={p.months}
                onClick={() => setMonths(p.months)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  months === p.months
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={months ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '')
                  if (raw === '') { setMonths(null); return }
                  const v = parseInt(raw, 10)
                  if (v >= 1 && v <= 360) setMonths(v)
                  else if (v === 0) setMonths(null)
                }}
                className="w-14 px-2 py-1 rounded-full text-xs font-semibold text-center bg-slate-800 text-slate-200 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                placeholder="—"
              />
              <span className="text-xs text-slate-500">мес</span>
            </div>
          </div>
          <div className="flex-1" />
          {dreamGoal && (
            <button
              onClick={() => { setIsEditing(false); setText(dreamGoal.goalText); setMonths(dreamGoal.months) }}
              className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/80 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Отмена
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>
    )
  }

  // State 1: Setup mode
  if (isSetup) {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
                <svg className="h-5 w-5 star-shimmer" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Вектор</div>
                <h2 className="text-lg font-semibold tracking-tight text-white">Твоя мечта</h2>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
            <p className="text-[15px] text-slate-200 font-medium leading-7">&ldquo;{dreamGoal.goalText}&rdquo;</p>
          </div>
          <div className="mt-3 text-sm font-medium text-amber-400/70">
            {dreamGoal.months ? `Горизонт: ${formatHorizon(dreamGoal.months)}` : ''}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border-2 border-dashed border-slate-700 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-8 text-center">
          <h3 className="text-lg font-semibold tracking-tight text-white mb-2">Готов планировать?</h3>
          <p className="text-sm text-slate-400 leading-6 max-w-md mx-auto mb-8">
            Разложи мечту на годы, кварталы и месяцы — сам или с помощью ИОН
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={onSetupComplete}
              className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/80 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
              Заполню сам
            </button>
            <button
              onClick={() => { onSetupComplete(); onOpenChat() }}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-blue-400 gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              ИОН поможет
            </button>
          </div>
        </div>
      </div>
    )
  }

  // State 2: Compact bar (collapsed/expanded read-only)
  return (
    <div
      className="group relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.06),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] px-6 py-4 transition hover:border-slate-700 shadow-[0_18px_60px_rgba(2,6,23,0.20)]"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
          <svg className="h-5 w-5 star-shimmer" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Вектор</div>
          <p className={`text-[15px] text-slate-200 font-medium leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
            {dreamGoal.goalText}
          </p>
        </div>
        {!isExpanded && progress.total > 0 && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-amber-300">{progress.percent}%</span>
          </div>
        )}
        {!isExpanded && dreamGoal.months && (
          <div className="text-sm font-medium text-amber-400/70 flex-shrink-0">
            {formatHorizon(dreamGoal.months, true)}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); setIsExpanded(false) }}
          className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-slate-800/60"
        >
          <svg
            className="w-4 h-4"
            fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
          </svg>
        </button>
      </div>
      {isExpanded && progress.total > 0 && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800/60">
          <div className="text-sm font-medium text-amber-400/70">{dreamGoal.months ? `Горизонт: ${formatHorizon(dreamGoal.months)}` : ''}</div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-amber-300">{progress.percent}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
