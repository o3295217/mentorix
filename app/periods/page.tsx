'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import type { PaginatedResponse } from '@/lib/types'

interface PeriodEvaluation {
  id: number
  periodType: string
  periodStart: string
  periodEnd: string
  dreamProgressScore: number
  overallScore: number
  createdAt: string
}

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom'

const PERIOD_OPTIONS: Array<{
  type: Exclude<PeriodType, 'custom'>
  label: string
  eyebrow: string
  accentClass: string
}> = [
  {
    type: 'week',
    label: 'Неделя',
    eyebrow: '7 дней фокуса',
    accentClass: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  },
  {
    type: 'month',
    label: 'Месяц',
    eyebrow: 'шире паттерны',
    accentClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
  {
    type: 'quarter',
    label: 'Квартал',
    eyebrow: 'стратегический срез',
    accentClass: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  },
  {
    type: 'year',
    label: 'Год',
    eyebrow: 'большая траектория',
    accentClass: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200',
  },
]

function getPeriodLabel(type: string) {
  const labels: Record<string, string> = {
    week: 'Неделя',
    month: 'Месяц',
    quarter: 'Квартал',
    year: 'Год',
    custom: 'Произвольный период',
  }

  return labels[type] || type
}

function getPeriodDateRange(type: Exclude<PeriodType, 'custom'>) {
  const today = new Date()

  switch (type) {
    case 'week':
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      }
    case 'month':
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      }
    case 'quarter':
      return {
        start: startOfQuarter(today),
        end: endOfQuarter(today),
      }
    case 'year':
      return {
        start: startOfYear(today),
        end: endOfYear(today),
      }
  }
}

function formatPeriodRange(start: Date, end: Date) {
  return `${format(start, 'd MMM yyyy', { locale: ru })} - ${format(end, 'd MMM yyyy', { locale: ru })}`
}

function formatEvaluationRange(start: string, end: string) {
  return `${format(new Date(start), 'd MMM', { locale: ru })} - ${format(new Date(end), 'd MMM yyyy', { locale: ru })}`
}

function formatDaysWord(days: number) {
  const mod10 = days % 10
  const mod100 = days % 100

  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

function getScoreTone(score: number) {
  if (score >= 8) {
    return {
      textClass: 'text-emerald-200',
      ringClass: 'border-emerald-400/20 bg-emerald-500/10',
      glowClass: 'from-emerald-500/16 to-transparent',
    }
  }

  if (score >= 6) {
    return {
      textClass: 'text-amber-200',
      ringClass: 'border-amber-400/20 bg-amber-500/10',
      glowClass: 'from-amber-500/16 to-transparent',
    }
  }

  return {
    textClass: 'text-rose-200',
    ringClass: 'border-rose-400/20 bg-rose-500/10',
    glowClass: 'from-rose-500/16 to-transparent',
  }
}

function SummaryPill({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm backdrop-blur-md ${className || 'border-white/10 bg-white/[0.04] text-gray-200'}`}>
      <span className="font-semibold text-white">{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  )
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.56),rgba(15,23,42,0.22))] p-5 backdrop-blur-md sm:p-6 ${className}`}>
      {children}
    </section>
  )
}

export default function PeriodsPage() {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<PeriodEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<{
    type: PeriodType
    start: Date
    end: Date
  } | null>(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    fetchEvaluations()
  }, [])

  useEffect(() => {
    if (!message && !errorMessage) return

    const timer = window.setTimeout(() => {
      setMessage('')
      setErrorMessage('')
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [message, errorMessage])

  const fetchEvaluations = async () => {
    try {
      const res = await fetch('/api/periods')
      if (!res.ok) {
        setErrorMessage('Не удалось загрузить историю периодов.')
        return
      }

      const data = await res.json() as PaginatedResponse<PeriodEvaluation>
      setEvaluations(data.items)
    } catch (error) {
      console.error('Error fetching evaluations:', error)
      setErrorMessage('Не удалось загрузить историю периодов.')
    } finally {
      setLoading(false)
    }
  }

  const selectQuickPeriod = (type: Exclude<PeriodType, 'custom'>) => {
    const { start, end } = getPeriodDateRange(type)
    setSelectedPeriod({ type, start, end })
    setErrorMessage('')
  }

  const selectCustomPeriod = () => {
    if (!customStart || !customEnd) {
      setErrorMessage('Укажите даты начала и конца периода.')
      return
    }

    const start = new Date(customStart)
    const end = new Date(customEnd)

    if (start > end) {
      setErrorMessage('Дата начала должна быть раньше даты конца.')
      return
    }

    setSelectedPeriod({ type: 'custom', start, end })
    setErrorMessage('')
  }

  const createEvaluation = async () => {
    if (!selectedPeriod) return

    setCreating(true)
    setErrorMessage('')

    try {
      const res = await fetch('/api/evaluate-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType: selectedPeriod.type,
          periodStart: selectedPeriod.start.toISOString(),
          periodEnd: selectedPeriod.end.toISOString(),
        }),
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(payload?.error || 'Не удалось создать оценку периода.')
      }

      setMessage('Оценка периода создана. Открываю отчёт.')
      setSelectedPeriod(null)
      setCustomStart('')
      setCustomEnd('')
      await fetchEvaluations()
      router.push(`/periods/${payload.id}`)
    } catch (error) {
      console.error('Error creating evaluation:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось создать оценку периода.')
    } finally {
      setCreating(false)
    }
  }

  const selectedDays = selectedPeriod
    ? differenceInCalendarDays(selectedPeriod.end, selectedPeriod.start) + 1
    : 0

  const latestEvaluation = evaluations[0] || null
  const averageDreamScore = evaluations.length > 0
    ? (evaluations.reduce((sum, evaluation) => sum + evaluation.dreamProgressScore, 0) / evaluations.length).toFixed(1)
    : null

  const historyByType = useMemo(() => {
    return PERIOD_OPTIONS.map((option) => ({
      ...option,
      count: evaluations.filter((evaluation) => evaluation.periodType === option.type).length,
    }))
  }, [evaluations])

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1 opacity-35" />
        <div className="landing-orb landing-orb-2 opacity-30" />
        <div className="landing-orb landing-orb-3 opacity-25" />
        <div className="absolute inset-0 landing-grid opacity-[0.03]" />
      </div>

      <div className="relative z-10 space-y-5">
        <SectionCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Ретроспектива</div>
              <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
                <h1 className="text-3xl font-semibold tracking-tight text-white">Периоды</h1>
                <div className="flex flex-wrap gap-2">
                  <SummaryPill label="в истории" value={evaluations.length} />
                  {latestEvaluation && (
                    <SummaryPill
                      label="последний прогресс"
                      value={`${latestEvaluation.dreamProgressScore.toFixed(1)}/10`}
                      className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    />
                  )}
                  {averageDreamScore && (
                    <SummaryPill
                      label="средний прогресс"
                      value={`${averageDreamScore}/10`}
                      className="border-sky-500/20 bg-sky-500/10 text-sky-200"
                    />
                  )}
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                Здесь собираются недельные, месячные и более широкие срезы. Выбираете период, строите оценку и сразу переходите в разбор паттернов, перекосов и реального прогресса к мечте.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link href="/progress" className="text-sm font-medium text-gray-400 transition hover:text-white">
                К прогрессу
              </Link>
            </div>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Новый срез</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Создать оценку периода</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Быстрые варианты покрывают текущую неделю, месяц, квартал и год. Если нужен свой диапазон, соберите его ниже вручную.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PERIOD_OPTIONS.map((option) => {
                const isSelected = selectedPeriod?.type === option.type
                const range = getPeriodDateRange(option.type)

                return (
                  <button
                    key={option.type}
                    onClick={() => selectQuickPeriod(option.type)}
                    className={`rounded-[24px] border p-4 text-left transition ${
                      isSelected
                        ? 'border-white/18 bg-white/[0.08] shadow-[0_18px_50px_rgba(15,23,42,0.25)]'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${option.accentClass}`}>
                      {option.eyebrow}
                    </div>
                    <div className="mt-4 text-lg font-semibold text-white">{option.label}</div>
                    <div className="mt-1 text-sm text-gray-400">{formatPeriodRange(range.start, range.end)}</div>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Произвольный период</div>
                  <div className="mt-1 text-sm leading-6 text-gray-400">
                    Подходит для спринта, командировки, сложной недели или любого нестандартного отрезка.
                  </div>
                </div>
                <button
                  onClick={selectCustomPeriod}
                  className="self-start rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  Выбрать период
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm text-gray-400">Начало</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-gray-400">Конец</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Предпросмотр</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Что будет оценено</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              В отчёт попадут только те дни, где уже есть дневная запись и AI-оценка. Если внутри диапазона пусто, система скажет об этом сразу.
            </p>

            {selectedPeriod ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/[0.07] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">{getPeriodLabel(selectedPeriod.type)}</div>
                      <div className="mt-2 text-xl font-semibold text-white">{formatPeriodRange(selectedPeriod.start, selectedPeriod.end)}</div>
                    </div>
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-200">
                      {selectedDays} {formatDaysWord(selectedDays)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Формат</div>
                    <div className="mt-2 text-base font-medium text-white">{getPeriodLabel(selectedPeriod.type)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Охват</div>
                    <div className="mt-2 text-base font-medium text-white">{selectedDays} {formatDaysWord(selectedDays)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Результат</div>
                    <div className="mt-2 text-base font-medium text-white">Полный отчёт по периоду</div>
                  </div>
                </div>

                <button
                  onClick={createEvaluation}
                  disabled={creating}
                  className="w-full rounded-[24px] bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Собираю оценку периода...' : 'Создать оценку'}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-gray-500">
                Выберите быстрый период или задайте свой диапазон. Справа сразу появится итоговый срез перед запуском оценки.
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {errorMessage}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">История</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Готовые оценки периодов</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Сюда складываются уже собранные отчёты. Можно быстро открыть последний, сравнить типы периодов и вернуться к любому прошлому срезу.
              </p>
            </div>

            {latestEvaluation && (
              <Link href={`/periods/${latestEvaluation.id}`} className="text-sm font-medium text-gray-400 transition hover:text-white">
                Открыть последний отчёт
              </Link>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {historyByType.map((item) => (
              <div key={item.type} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${item.accentClass}`}>
                <span className="font-semibold text-white">{item.count}</span>
                <span>{item.label.toLowerCase()}</span>
              </div>
            ))}
          </div>

          {evaluations.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <div className="text-lg font-medium text-white">Пока нет ни одной периодической оценки</div>
              <div className="mt-2 text-sm text-gray-500">Начните сверху с недели или месяца, чтобы увидеть первый цельный срез динамики.</div>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {evaluations.map((evaluation) => {
                const dreamTone = getScoreTone(evaluation.dreamProgressScore)
                const overallTone = getScoreTone(evaluation.overallScore)

                return (
                  <Link
                    key={evaluation.id}
                    href={`/periods/${evaluation.id}`}
                    className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.48),rgba(15,23,42,0.2))] p-5 transition hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(15,23,42,0.56),rgba(15,23,42,0.24))]"
                  >
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${dreamTone.glowClass} opacity-70`} />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{getPeriodLabel(evaluation.periodType)}</div>
                        <div className="mt-2 text-xl font-semibold text-white">{formatEvaluationRange(evaluation.periodStart, evaluation.periodEnd)}</div>
                        <div className="mt-2 text-sm text-gray-500">
                          Собрано {format(new Date(evaluation.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-500 transition group-hover:text-white">Открыть</div>
                    </div>

                    <div className="relative z-10 mt-5 grid grid-cols-2 gap-3">
                      <div className={`rounded-2xl border p-4 ${dreamTone.ringClass}`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Прогресс к мечте</div>
                        <div className={`mt-2 text-3xl font-semibold ${dreamTone.textClass}`}>
                          {evaluation.dreamProgressScore.toFixed(1)}
                          <span className="ml-1 text-base font-normal text-gray-400">/10</span>
                        </div>
                      </div>
                      <div className={`rounded-2xl border p-4 ${overallTone.ringClass}`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Общий темп</div>
                        <div className={`mt-2 text-3xl font-semibold ${overallTone.textClass}`}>
                          {evaluation.overallScore.toFixed(1)}
                          <span className="ml-1 text-base font-normal text-gray-400">/10</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </SectionCard>

        {message && (
          <div role="status" aria-live="polite" className="app-fixed-status fixed z-50 rounded-2xl border border-emerald-500/20 bg-gray-950/90 p-4 shadow-lg backdrop-blur-sm">
            <p className="font-medium text-emerald-100">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
