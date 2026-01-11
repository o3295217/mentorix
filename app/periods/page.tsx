'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import { ru } from 'date-fns/locale'

interface PeriodEvaluation {
  id: number
  periodType: string
  periodStart: string
  periodEnd: string
  dreamProgressScore: number
  overallScore: number
  createdAt: string
}

export default function PeriodsPage() {
  const [evaluations, setEvaluations] = useState<PeriodEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<{
    type: 'week' | 'month' | 'quarter' | 'year' | 'custom'
    start: Date
    end: Date
  } | null>(null)

  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    fetchEvaluations()
  }, [])

  const fetchEvaluations = async () => {
    try {
      const res = await fetch('/api/periods')
      if (!res.ok) {
        console.error('Failed to load evaluations:', res.status)
        return
      }
      const data = await res.json()
      setEvaluations(data)
    } catch (error) {
      console.error('Error fetching evaluations:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectQuickPeriod = (type: 'week' | 'month' | 'quarter' | 'year') => {
    const today = new Date()
    let start: Date
    let end: Date

    switch (type) {
      case 'week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'quarter':
        start = startOfQuarter(today)
        end = endOfQuarter(today)
        break
      case 'year':
        start = startOfYear(today)
        end = endOfYear(today)
        break
    }

    setSelectedPeriod({ type, start, end })
  }

  const selectCustomPeriod = () => {
    if (!customStart || !customEnd) {
      alert('Укажите даты начала и конца периода')
      return
    }

    const start = new Date(customStart)
    const end = new Date(customEnd)

    if (start > end) {
      alert('Дата начала должна быть раньше даты конца')
      return
    }

    setSelectedPeriod({ type: 'custom', start, end })
  }

  const createEvaluation = async () => {
    if (!selectedPeriod) return

    setCreating(true)
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

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create evaluation')
      }

      const newEvaluation = await res.json()
      alert('Оценка периода создана!')
      setSelectedPeriod(null)
      setCustomStart('')
      setCustomEnd('')
      fetchEvaluations()

      // Redirect to evaluation page
      window.location.href = `/periods/${newEvaluation.id}`
    } catch (error) {
      console.error('Error creating evaluation:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setCreating(false)
    }
  }

  const getPeriodLabel = (type: string) => {
    const labels: Record<string, string> = {
      week: '📅 Неделя',
      month: '📆 Месяц',
      quarter: '📊 Квартал',
      year: '🗓️ Год',
      custom: '🔧 Произвольный',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Периодические оценки</h1>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← На главную
        </Link>
      </div>

      {/* Period Selection */}
      <div className="card bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 border-2 border-blue-200 dark:border-slate-600">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Создать новую оценку периода</h2>

        {/* Quick Period Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => selectQuickPeriod('week')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedPeriod?.type === 'week'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <div className="text-2xl mb-1">📅</div>
            <div className="font-semibold text-gray-900 dark:text-white">Неделя</div>
          </button>

          <button
            onClick={() => selectQuickPeriod('month')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedPeriod?.type === 'month'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <div className="text-2xl mb-1">📆</div>
            <div className="font-semibold text-gray-900 dark:text-white">Месяц</div>
          </button>

          <button
            onClick={() => selectQuickPeriod('quarter')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedPeriod?.type === 'quarter'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <div className="text-2xl mb-1">📊</div>
            <div className="font-semibold text-gray-900 dark:text-white">Квартал</div>
          </button>

          <button
            onClick={() => selectQuickPeriod('year')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedPeriod?.type === 'year'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
          >
            <div className="text-2xl mb-1">🗓️</div>
            <div className="font-semibold text-gray-900 dark:text-white">Год</div>
          </button>
        </div>

        {/* Custom Period Selection */}
        <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Произвольный период</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Начало</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Конец</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={selectCustomPeriod}
                className="btn-secondary w-full"
              >
                Выбрать
              </button>
            </div>
          </div>
        </div>

        {/* Selected Period Display */}
        {selectedPeriod && (
          <div className="mt-4 p-4 bg-white dark:bg-slate-700 rounded-lg border-2 border-green-400 dark:border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Выбранный период:</p>
                <p className="font-semibold text-lg text-gray-900 dark:text-white">
                  {getPeriodLabel(selectedPeriod.type)} | {format(selectedPeriod.start, 'd MMM yyyy', { locale: ru })} - {format(selectedPeriod.end, 'd MMM yyyy', { locale: ru })}
                </p>
              </div>
              <button
                onClick={createEvaluation}
                disabled={creating}
                className="btn-primary"
              >
                {creating ? 'Создаю...' : 'Создать оценку'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Previous Evaluations List */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">История оценок</h2>

        {evaluations.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Оценок периодов пока нет</p>
            <p className="text-sm">Создайте первую оценку выше</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluations.map((evaluation) => (
              <Link
                key={evaluation.id}
                href={`/periods/${evaluation.id}`}
                className="block p-4 bg-white dark:bg-slate-700 rounded-lg border-2 border-gray-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg text-gray-900 dark:text-white">{getPeriodLabel(evaluation.periodType)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(evaluation.periodStart), 'd MMM', { locale: ru })} - {format(new Date(evaluation.periodEnd), 'd MMM yyyy', { locale: ru })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Создано: {format(new Date(evaluation.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Прогресс к мечте</div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {evaluation.dreamProgressScore.toFixed(1)}/10
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Overall: {evaluation.overallScore.toFixed(1)}/10
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
