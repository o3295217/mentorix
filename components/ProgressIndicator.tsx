'use client'

import Link from 'next/link'

interface ProgressIndicatorProps {
  effectiveDays: number
  elapsedDays: number
  evaluatedDays: number
  currentStreak: number
  progressPercent: number
  targetDays: number
  currentSpeed?: number
  userName?: string
}

export default function ProgressIndicator({
  effectiveDays,
  elapsedDays,
  evaluatedDays,
  progressPercent,
  targetDays,
  currentSpeed = 0,
  userName = '',
}: ProgressIndicatorProps) {
  const targetYears = targetDays / 365
  const remainingDays = Math.max(0, targetDays - effectiveDays)
  const regularity = elapsedDays > 0 ? evaluatedDays / elapsedDays : 0
  const quality = currentSpeed / 10
  const realRate = regularity * quality
  const yearsToGoal = realRate > 0 ? (remainingDays / realRate) / 365 : Infinity
  const displayName = userName || 'Вы'
  const progressWidth = Math.min(100, progressPercent)
  const regularityPercent = Math.round(regularity * 100)

  const formatDuration = (years: number) => {
    if (years === Infinity || years > 100) return 'нет прогноза'
    if (years < 1) {
      const months = Math.max(1, Math.round(years * 12))
      return `${months} мес.`
    }
    return `${(years >= 10 ? Math.round(years) : Math.round(years * 10) / 10).toString()} лет`
  }

  const getStatus = () => {
    if (yearsToGoal === Infinity) {
      return {
        tone: 'Нет устойчивого темпа',
        hint: 'Сначала нужна регулярность оценённых дней.',
        accent: 'text-rose-300',
        pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        bar: 'from-rose-500 via-orange-400 to-amber-300',
      }
    }
    if (yearsToGoal <= targetYears * 1.1) {
      return {
        tone: 'Темп близок к плану',
        hint: 'Задача — удержать ритм.',
        accent: 'text-emerald-300',
        pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        bar: 'from-emerald-500 via-teal-400 to-cyan-300',
      }
    }
    if (yearsToGoal <= targetYears * 1.7) {
      return {
        tone: 'Темп ниже плана',
        hint: 'Нужно чаще доводить день до оценки.',
        accent: 'text-amber-300',
        pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        bar: 'from-amber-500 via-orange-400 to-yellow-300',
      }
    }
    return {
      tone: 'Прогноз сильно отстаёт',
      hint: 'Картина говорит о редких или слабых рабочих днях.',
      accent: 'text-rose-300',
      pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      bar: 'from-rose-500 via-red-400 to-orange-300',
    }
  }

  const status = getStatus()
  const primaryLever = regularity < 0.6 ? 'регулярность' : 'качество дней'
  const pacePercent = (realRate * 100).toFixed(1)

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
      <div className="relative flex flex-col h-full">
        {/* Заголовок */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10">
              <svg className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Прогресс к мечте</div>
              <h2 className="text-lg font-semibold tracking-tight text-white">{status.tone}</h2>
            </div>
          </div>
          <Link
            href="/progress"
            className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:border-sky-500/40 hover:text-sky-200"
          >
            Аналитика →
          </Link>
        </div>

        {/* Прогноз + Progress bar */}
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 space-y-3">
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${status.pill}`}>
            {primaryLever} — главный рычаг
          </div>
          <p className="text-[15px] text-slate-300 leading-7">
            При текущем темпе {displayName} придёт к цели через{' '}
            <span className={`font-semibold ${status.accent}`}>{formatDuration(yearsToGoal)}</span>.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{effectiveDays.toFixed(1)} из {targetDays} эфф. дней</span>
              <span className="font-medium text-slate-300">{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div className={`h-full rounded-full bg-gradient-to-r ${status.bar} transition-all duration-500`} style={{ width: `${progressWidth}%` }} />
            </div>
          </div>
        </div>

        {/* 3 метрики */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Регулярность</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-cyan-300">{regularityPercent}%</div>
            <div className="text-[11px] text-slate-500">{evaluatedDays}/{elapsedDays} дн.</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Качество</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-amber-300">{currentSpeed.toFixed(1)}<span className="text-sm text-slate-500">/10</span></div>
            <div className="text-[11px] text-slate-500">за 7 дней</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Темп</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300">{pacePercent}%</div>
            <div className="text-[11px] text-slate-500">эфф./кал.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
