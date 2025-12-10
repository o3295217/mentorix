'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ForecastResponse } from '@/lib/prompts/types'

interface ForecastApiResponse {
  forecast: ForecastResponse
  metadata: {
    basePeriod: {
      type: string
      start: string
      end: string
      daysCount: number
    }
    horizon: {
      type: string
      start?: string
      end?: string
      goalsCount: number
    }
    dream: {
      goal: string
      years: number
    }
  }
}

export default function ForecastPage() {
  // База для анализа (прошлое)
  const [basePeriodType, setBasePeriodType] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month')
  const [basePeriodStart, setBasePeriodStart] = useState('')
  const [basePeriodEnd, setBasePeriodEnd] = useState('')

  // Горизонт прогноза (будущее)
  const [forecastHorizon, setForecastHorizon] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month')
  const [horizonStart, setHorizonStart] = useState('')
  const [horizonEnd, setHorizonEnd] = useState('')

  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<ForecastApiResponse | null>(null)

  // Автоматически установить базовый период при загрузке
  useEffect(() => {
    selectBasePeriod('month')
    selectHorizonPeriod('month')
  }, [])

  const selectBasePeriod = (type: 'week' | 'month' | 'quarter' | 'year' | 'custom') => {
    setBasePeriodType(type)

    if (type === 'custom') {
      // Для custom не меняем даты - пользователь сам выберет
      return
    }

    const today = new Date()
    let start: Date
    const end: Date = today

    switch (type) {
      case 'week':
        start = subDays(today, 7)
        break
      case 'month':
        start = subDays(today, 30)
        break
      case 'quarter':
        start = subDays(today, 90)
        break
      case 'year':
        start = subDays(today, 365)
        break
    }

    setBasePeriodStart(format(start, 'yyyy-MM-dd'))
    setBasePeriodEnd(format(end, 'yyyy-MM-dd'))
  }

  const selectHorizonPeriod = (type: 'week' | 'month' | 'quarter' | 'year' | 'custom') => {
    setForecastHorizon(type)

    if (type === 'custom') {
      // Для custom не меняем даты - пользователь сам выберет
      return
    }

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

    setHorizonStart(format(start, 'yyyy-MM-dd'))
    setHorizonEnd(format(end, 'yyyy-MM-dd'))
  }

  const generateForecast = async () => {
    if (!basePeriodStart || !basePeriodEnd) {
      alert('Выберите базовый период для анализа')
      return
    }

    if (!horizonStart || !horizonEnd) {
      alert('Выберите период для прогноза')
      return
    }

    setLoading(true)
    try {
      const body: {
        basePeriodType: string
        basePeriodStart: string
        basePeriodEnd: string
        forecastHorizon: string
        horizonStart: string
        horizonEnd: string
      } = {
        basePeriodType,
        basePeriodStart,
        basePeriodEnd,
        forecastHorizon,
        horizonStart,
        horizonEnd,
      }

      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate forecast')
      }

      const data = await res.json()
      setForecast(data)
    } catch (error) {
      console.error('Error generating forecast:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      'низкий': 'bg-green-100 text-green-800 border-green-300',
      'средний': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'высокий': 'bg-red-100 text-red-800 border-red-300',
    }
    return colors[risk] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getImpactColor = (impact: string) => {
    const colors: Record<string, string> = {
      'позитивный': 'border-green-500',
      'негативный': 'border-red-500',
      'нейтральный': 'border-gray-400',
    }
    return colors[impact] || 'border-gray-400'
  }

  const getProbabilityColor = (probability: string) => {
    const colors: Record<string, string> = {
      'низкая': 'text-gray-600',
      'средняя': 'text-yellow-600',
      'высокая': 'text-red-600',
    }
    return colors[probability] || 'text-gray-600'
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Прогнозы и предсказания</h1>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← На главную
        </Link>
      </div>

      {/* Описание новой логики */}
      <div className="card bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900 border-2 border-indigo-200 dark:border-indigo-700">
        <h2 className="text-xl font-bold mb-3">🔮 Как работает прогноз</h2>
        <div className="space-y-2 text-sm">
          <p><strong>1️⃣ БАЗА ДЛЯ АНАЛИЗА (прошлое):</strong> Система анализирует ваш план vs факт за выбранный период, чтобы понять реальное качество выполнения задач.</p>
          <p><strong>2️⃣ ГОРИЗОНТ ПРОГНОЗА (будущее):</strong> На основе анализа строится прогноз: выполните ли вы цели периода (неделя/месяц/квартал/год) или достигнете мечты.</p>
          <p><strong>3️⃣ ЧЕСТНАЯ ОЦЕНКА:</strong> Прогноз основан не на скорах, а на реальном качестве выполнения задач из вашего плана и факта.</p>
        </div>
      </div>

      {/* Настройки прогноза */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 border-2 border-purple-200 dark:border-purple-700">
        <h2 className="text-2xl font-bold mb-4">Настройки прогноза</h2>

        {/* База для анализа */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">📊 База для анализа (прошлое)</label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Выберите период, за который система проанализирует ваши план/факт и качество выполнения</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <button
              onClick={() => selectBasePeriod('week')}
              className={`p-3 rounded-lg border-2 transition-all ${
                basePeriodType === 'week'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              📅 Неделя
            </button>
            <button
              onClick={() => selectBasePeriod('month')}
              className={`p-3 rounded-lg border-2 transition-all ${
                basePeriodType === 'month'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              📆 Месяц
            </button>
            <button
              onClick={() => selectBasePeriod('quarter')}
              className={`p-3 rounded-lg border-2 transition-all ${
                basePeriodType === 'quarter'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              📊 Квартал
            </button>
            <button
              onClick={() => selectBasePeriod('year')}
              className={`p-3 rounded-lg border-2 transition-all ${
                basePeriodType === 'year'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              🗓️ Год
            </button>
            <button
              onClick={() => selectBasePeriod('custom')}
              className={`p-3 rounded-lg border-2 transition-all ${
                basePeriodType === 'custom'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              📝 Свой период
            </button>
          </div>

          {/* Кастомные даты для базового периода */}
          {basePeriodType === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Дата начала</label>
                <input
                  type="date"
                  value={basePeriodStart}
                  onChange={(e) => setBasePeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Дата окончания</label>
                <input
                  type="date"
                  value={basePeriodEnd}
                  onChange={(e) => setBasePeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {basePeriodStart && basePeriodEnd && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Период: {format(new Date(basePeriodStart), 'd MMM yyyy', { locale: ru })} — {format(new Date(basePeriodEnd), 'd MMM yyyy', { locale: ru })}
            </p>
          )}
        </div>

        {/* Горизонт прогноза */}
        <div className="mb-6">
          <label className="block font-semibold mb-2">🎯 Горизонт прогноза (будущее)</label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Выберите, на какой период строить прогноз</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <button
              onClick={() => selectHorizonPeriod('week')}
              className={`p-3 rounded-lg border-2 transition-all ${
                forecastHorizon === 'week'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
            >
              📅 Неделя
            </button>
            <button
              onClick={() => selectHorizonPeriod('month')}
              className={`p-3 rounded-lg border-2 transition-all ${
                forecastHorizon === 'month'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
            >
              📆 Месяц
            </button>
            <button
              onClick={() => selectHorizonPeriod('quarter')}
              className={`p-3 rounded-lg border-2 transition-all ${
                forecastHorizon === 'quarter'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
            >
              📊 Квартал
            </button>
            <button
              onClick={() => selectHorizonPeriod('year')}
              className={`p-3 rounded-lg border-2 transition-all ${
                forecastHorizon === 'year'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
            >
              🗓️ Год
            </button>
            <button
              onClick={() => selectHorizonPeriod('custom')}
              className={`p-3 rounded-lg border-2 transition-all ${
                forecastHorizon === 'custom'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-purple-400'
              }`}
            >
              📝 Свой период
            </button>
          </div>

          {/* Кастомные даты для горизонта прогноза */}
          {forecastHorizon === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Дата начала</label>
                <input
                  type="date"
                  value={horizonStart}
                  onChange={(e) => setHorizonStart(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Дата окончания</label>
                <input
                  type="date"
                  value={horizonEnd}
                  onChange={(e) => setHorizonEnd(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {horizonStart && horizonEnd && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Период: {format(new Date(horizonStart), 'd MMM yyyy', { locale: ru })} — {format(new Date(horizonEnd), 'd MMM yyyy', { locale: ru })}
            </p>
          )}
        </div>

        {/* Кнопка генерации */}
        <button
          onClick={generateForecast}
          disabled={loading}
          className="btn-primary w-full text-lg"
        >
          {loading ? 'Генерирую прогноз...' : '🔮 Сгенерировать прогноз'}
        </button>
      </div>

      {/* Результаты прогноза */}
      {forecast && (
        <div className="space-y-6">
          {/* Метаданные */}
          <div className="card bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-3">ℹ️ Информация о прогнозе</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">База для анализа</p>
                <p className="font-bold">
                  {forecast.metadata.basePeriod.type} ({forecast.metadata.basePeriod.daysCount} дней)
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(forecast.metadata.basePeriod.start), 'd MMM yyyy', { locale: ru })} — {format(new Date(forecast.metadata.basePeriod.end), 'd MMM yyyy', { locale: ru })}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-1">Горизонт прогноза</p>
                <p className="font-bold">
                  {forecast.metadata.horizon.type} ({forecast.metadata.horizon.goalsCount} целей)
                </p>
                {forecast.metadata.horizon.start && forecast.metadata.horizon.end && (
                  <p className="text-xs text-gray-500">
                    {format(new Date(forecast.metadata.horizon.start), 'd MMM yyyy', { locale: ru })} — {format(new Date(forecast.metadata.horizon.end), 'd MMM yyyy', { locale: ru })}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 dark:text-gray-400 mb-1">Мечта</p>
                <p className="font-bold">{forecast.metadata.dream.goal}</p>
                <p className="text-xs text-gray-500">{forecast.metadata.dream.years} лет</p>
              </div>
            </div>
          </div>

          {/* Качество выполнения (базовый период) */}
          <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900 dark:to-cyan-900 border-2 border-blue-300 dark:border-blue-700">
            <h2 className="text-2xl font-bold mb-4">📊 Анализ качества выполнения</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Всего задач</p>
                <p className="text-3xl font-bold text-blue-600">
                  {forecast.forecast.executionQuality.totalTasksCompleted}/{forecast.forecast.executionQuality.totalTasksPlanned}
                </p>
                <p className="text-xs text-gray-500">{forecast.forecast.executionQuality.completionRate}% выполнено</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Стратегических</p>
                <p className="text-3xl font-bold text-purple-600">
                  {forecast.forecast.executionQuality.strategicTasksCompleted}/{forecast.forecast.executionQuality.strategicTasksPlanned}
                </p>
                <p className="text-xs text-gray-500">{forecast.forecast.executionQuality.strategicCompletionRate}% выполнено</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Средний Dream Progress</p>
                <p className="text-3xl font-bold text-green-600">
                  {forecast.forecast.executionQuality.avgDreamProgress.toFixed(1)}/10
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Тренд</p>
                <p className="text-2xl font-bold text-orange-600">
                  {forecast.forecast.executionQuality.trend === 'растет' && '📈'}
                  {forecast.forecast.executionQuality.trend === 'стабильно' && '➡️'}
                  {forecast.forecast.executionQuality.trend === 'падает' && '📉'}
                  {' '}{forecast.forecast.executionQuality.trend}
                </p>
              </div>
            </div>
            {forecast.forecast.executionQuality.patterns.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Выявленные паттерны</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {forecast.forecast.executionQuality.patterns.map((pattern) => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Паттерны поведения */}
          {forecast.forecast.behaviorPatterns.length > 0 && (
            <div className="card bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900 dark:to-emerald-900 border-2 border-teal-300 dark:border-teal-700">
              <h2 className="text-2xl font-bold mb-4">🧠 Паттерны поведения</h2>
              <div className="space-y-3">
                {forecast.forecast.behaviorPatterns.map((pattern) => (
                  <div key={pattern.pattern} className={`bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 ${getImpactColor(pattern.impact)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{pattern.pattern}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        pattern.impact === 'позитивный' ? 'bg-green-100 text-green-800' :
                        pattern.impact === 'негативный' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pattern.impact}
                      </span>
                    </div>
                    {pattern.recommendation && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">💡 {pattern.recommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Прогноз по целям горизонта */}
          {forecast.forecast.goalForecasts.length > 0 && (
            <div className="card bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 border-2 border-purple-300 dark:border-purple-700">
              <h2 className="text-2xl font-bold mb-4">🎯 Прогноз по целям горизонта</h2>
              <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Общая вероятность выполнения всех целей</p>
                <p className="text-4xl font-bold text-purple-600">{forecast.forecast.overallProbability}%</p>
              </div>
              <div className="space-y-4">
                {forecast.forecast.goalForecasts.map((goal) => (
                  <div key={goal.goal} className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg flex-1">{goal.goal}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-purple-600">{goal.probability}%</span>
                        <span className={`text-xs px-3 py-1 rounded-full border-2 ${getRiskColor(goal.risk)}`}>
                          {goal.risk} риск
                        </span>
                      </div>
                    </div>
                    {goal.threats.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-red-600 mb-1">⚠️ Угрозы:</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {goal.threats.map((threat, j) => (
                            <li key={j} className="text-gray-700 dark:text-gray-300">{threat}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="bg-green-50 dark:bg-green-900 p-3 rounded border-l-4 border-green-500">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">💡 Рекомендация:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{goal.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Прогноз достижения мечты */}
          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900 dark:to-orange-900 border-2 border-yellow-300 dark:border-yellow-700">
            <h2 className="text-2xl font-bold mb-4">🌟 Прогноз достижения мечты</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Расчетное время (при текущем темпе)</p>
                <p className="text-4xl font-bold text-orange-600">
                  {forecast.forecast.dreamForecast.estimatedYears.toFixed(1)} лет
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Идет по плану?</p>
                <p className={`text-4xl font-bold ${forecast.forecast.dreamForecast.onTrack ? 'text-green-600' : 'text-red-600'}`}>
                  {forecast.forecast.dreamForecast.onTrack ? '✅ Да' : '❌ Нет'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Прогресс в год (текущий темп)</p>
                <p className="text-3xl font-bold text-blue-600">
                  {forecast.forecast.dreamForecast.progressPerYear.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Требуется для достижения вовремя</p>
                <p className="text-3xl font-bold text-purple-600">
                  {forecast.forecast.dreamForecast.requiredProgressPerYear.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Разрыв между текущим и требуемым темпом</p>
              <p className={`text-3xl font-bold mb-3 ${forecast.forecast.dreamForecast.gap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {forecast.forecast.dreamForecast.gap > 0 ? '-' : '+'}{Math.abs(forecast.forecast.dreamForecast.gap).toFixed(1)}%
              </p>
              <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded border-l-4 border-blue-500">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">🔧 Необходимые корректировки:</p>
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{forecast.forecast.dreamForecast.adjustmentNeeded}</p>
              </div>
            </div>
          </div>

          {/* Сценарии "что если" */}
          {forecast.forecast.whatIfScenarios.length > 0 && (
            <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900 dark:to-blue-900 border-2 border-indigo-300 dark:border-indigo-700">
              <h2 className="text-2xl font-bold mb-4">🤔 Сценарии "Что если?"</h2>
              <div className="space-y-3">
                {forecast.forecast.whatIfScenarios.map((scenario) => (
                  <div key={scenario.scenario} className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-indigo-500">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg flex-1">{scenario.scenario}</h3>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getProbabilityColor(scenario.probability)}`}>
                        {scenario.probability} вероятность
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300">{scenario.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Критические риски */}
          {forecast.forecast.criticalRisks.length > 0 && (
            <div className="card bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900 dark:to-orange-900 border-2 border-red-300 dark:border-red-700">
              <h2 className="text-2xl font-bold mb-4 text-red-700 dark:text-red-300">⚠️ Критические риски</h2>
              <div className="space-y-2">
                {forecast.forecast.criticalRisks.map((risk) => (
                  <div key={risk} className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-red-500 flex items-start gap-3">
                    <span className="text-2xl">🚨</span>
                    <p className="flex-1 text-gray-800 dark:text-gray-200">{risk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ключевые рекомендации */}
          {forecast.forecast.keyRecommendations.length > 0 && (
            <div className="card bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900 dark:to-teal-900 border-2 border-green-300 dark:border-green-700">
              <h2 className="text-2xl font-bold mb-4">💡 Ключевые рекомендации</h2>
              <div className="space-y-3">
                {forecast.forecast.keyRecommendations.map((rec, i) => (
                  <div key={rec} className="bg-white dark:bg-gray-800 p-4 rounded-lg flex items-start gap-3 border-l-4 border-green-500">
                    <span className="text-2xl font-bold text-green-600">{i + 1}.</span>
                    <p className="flex-1 text-lg text-gray-800 dark:text-gray-200">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Резюме */}
          <div className="card bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-2 border-gray-300 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4">📝 Резюме прогноза</h2>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg">
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-800 dark:text-gray-200">{forecast.forecast.summary}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
