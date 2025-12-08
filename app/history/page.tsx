'use client'

import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry } from '@/lib/types'

export default function HistoryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    loadEntries()
  }, [days])

  const loadEntries = async () => {
    try {
      const to = new Date()
      const from = subDays(to, days)

      const res = await fetch(`/api/daily?from=${from.toISOString()}&to=${to.toISOString()}`)
      if (!res.ok) {
        console.error('Failed to load entries:', res.status)
        return
      }
      const data = await res.json()
      setEntries(data)
    } catch (error) {
      console.error('Error loading entries:', error)
    } finally {
      setLoading(false)
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 7) return 'bg-green-100 text-green-800 border-green-300'
    if (score >= 5) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">История</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input w-auto">
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
          <option value={60}>60 дней</option>
          <option value={90}>90 дней</option>
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">Записей пока нет</p>
          <Link href="/daily" className="btn-primary inline-block">
            Создать первую запись
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const date = new Date(entry.date)
            const hasEvaluation = !!entry.evaluation

            return (
              <Link
                key={entry.id}
                href={hasEvaluation ? `/evaluation/${format(date, 'yyyy-MM-dd')}` : `/daily`}
                className="card hover:shadow-lg transition-shadow block"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">
                      {format(date, 'd MMMM yyyy, EEEE', { locale: ru })}
                    </h3>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{entry.planText ? '✅ План' : '❌ План'}</span>
                      <span>{entry.factText ? '✅ Факт' : '❌ Факт'}</span>
                      <span>{hasEvaluation ? '✅ Оценка' : '❌ Оценка'}</span>
                    </div>
                  </div>

                  {hasEvaluation && entry.evaluation && (
                    <div
                      className={`px-6 py-3 rounded-lg border-2 ${getScoreColor(entry.evaluation.overallScore)}`}
                    >
                      <p className="text-sm font-medium">Оценка</p>
                      <p className="text-3xl font-bold">{entry.evaluation.overallScore}</p>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
