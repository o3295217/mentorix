'use client'

import { useState, useEffect } from 'react'
import { getPeriodDates, getPeriodName, PeriodType } from '@/lib/dates'

interface DreamGoal {
  id: number
  goalText: string
  years: number
}

interface YearGoals {
  year: number
  goals: string[]
}

export default function GoalsPage() {
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [dreamText, setDreamText] = useState('')
  const [dreamYears, setDreamYears] = useState(5)

  // Состояния для годов
  const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([new Date().getFullYear()]))

  // Состояния для периодов внутри года
  const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  // Состояния для полей ввода новых целей
  const [newGoalInputs, setNewGoalInputs] = useState<Map<string, string>>(new Map())

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    loadDream()
  }, [])

  useEffect(() => {
    if (dreamGoal) {
      // Загружаем цели для всех годов в горизонте мечты
      const years = Array.from({ length: dreamGoal.years }, (_, i) => currentYear + i)
      years.forEach(year => loadYearGoals(year))

      // Автоматически загружаем цели для текущего квартала, месяца и недели
      const today = new Date()
      const currentMonth = today.getMonth()
      const currentQuarter = Math.floor(currentMonth / 3) + 1
      const quarterKey = `${currentYear}-Q${currentQuarter}`

      // Автоматически раскрыть текущий квартал
      setExpandedPeriods(prev => new Set(prev).add(quarterKey))

      // Загрузить квартал
      loadPeriodGoalsWithKey('quarter', new Date(currentYear, (currentQuarter - 1) * 3, 1))

      // Загрузить текущий месяц
      loadPeriodGoalsWithKey('month', new Date(currentYear, currentMonth, 1))

      // Загрузить текущую неделю
      loadPeriodGoalsWithKey('week', today)
    }
  }, [dreamGoal])

  const loadDream = async () => {
    try {
      const res = await fetch('/api/goals/dream')
      const data = await res.json()
      if (data) {
        setDreamGoal(data)
        setDreamText(data.goalText)
        setDreamYears(data.years)
      }
    } catch (error) {
      console.error('Error loading dream:', error)
    }
  }

  const loadYearGoals = async (year: number) => {
    try {
      const res = await fetch(`/api/goals/year?year=${year}`)
      const data = await res.json()
      setYearGoals(prev => new Map(prev).set(year, data.goals || []))
    } catch (error) {
      console.error(`Error loading goals for ${year}:`, error)
    }
  }

  const loadPeriodGoalsWithKey = async (periodType: PeriodType, date: Date) => {
    try {
      const { start } = getPeriodDates(date, periodType)
      const res = await fetch(`/api/goals/period?type=${periodType}&date=${start.toISOString()}`)
      const data = await res.json()

      let key = ''
      if (periodType === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        key = `${date.getFullYear()}-Q${quarter}`
      } else if (periodType === 'half_year') {
        const half = date.getMonth() < 6 ? 1 : 2
        key = `${date.getFullYear()}-H${half}`
      } else if (periodType === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else if (periodType === 'week') {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
        let current = new Date(firstDay)
        while (current.getDay() !== 1 && current <= date) {
          current.setDate(current.getDate() + 1)
        }

        let weekNum = 1
        while (current <= date) {
          current.setDate(current.getDate() + 7)
          if (current <= date) weekNum++
        }

        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${weekNum}`
      }

      if (key && data?.goals) {
        setPeriodGoals(prev => new Map(prev).set(key, data.goals))
      }
    } catch (error) {
      console.error(`Error loading period goals:`, error)
    }
  }

  const saveDream = async () => {
    setSaving(true)
    try {
      await fetch('/api/goals/dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: dreamText, years: dreamYears }),
      })
      await loadDream()
      showMessage('✅ Мечта сохранена!')
    } catch (error) {
      console.error('Error saving dream:', error)
      showMessage('❌ Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const saveYearGoals = async (year: number, goals: string[]) => {
    try {
      await fetch('/api/goals/year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, goals }),
      })
      showMessage(`✅ Цели на ${year} год сохранены!`)
    } catch (error) {
      console.error(`Error saving goals for ${year}:`, error)
      showMessage('❌ Ошибка при сохранении')
    }
  }

  const savePeriodGoals = async (periodType: PeriodType, date: Date, goals: string[], label: string) => {
    try {
      const { start, end } = getPeriodDates(date, periodType)
      await fetch('/api/goals/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodType,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          goals,
        }),
      })
      showMessage(`✅ ${label} сохранён`)
    } catch (error) {
      console.error(`Error saving period goals:`, error)
      showMessage('❌ Ошибка при сохранении')
    }
  }

  const addYearGoal = (year: number) => {
    const key = `year-${year}`
    const input = newGoalInputs.get(key) || ''
    if (!input.trim()) return

    const currentGoals = yearGoals.get(year) || []
    const updatedGoals = [...currentGoals, input.trim()]
    setYearGoals(prev => new Map(prev).set(year, updatedGoals))
    setNewGoalInputs(prev => new Map(prev).set(key, ''))
    saveYearGoals(year, updatedGoals)
  }

  const removeYearGoal = (year: number, index: number) => {
    const currentGoals = yearGoals.get(year) || []
    const updatedGoals = currentGoals.filter((_, i) => i !== index)
    setYearGoals(prev => new Map(prev).set(year, updatedGoals))
    saveYearGoals(year, updatedGoals)
  }

  const addPeriodGoal = (periodKey: string, periodType: PeriodType, date: Date, label: string) => {
    const input = newGoalInputs.get(periodKey) || ''
    if (!input.trim()) return

    const currentGoals = periodGoals.get(periodKey) || []
    const updatedGoals = [...currentGoals, input.trim()]
    setPeriodGoals(prev => new Map(prev).set(periodKey, updatedGoals))
    setNewGoalInputs(prev => new Map(prev).set(periodKey, ''))
    savePeriodGoals(periodType, date, updatedGoals, label)
  }

  const removePeriodGoal = (periodKey: string, index: number, periodType: PeriodType, date: Date, label: string) => {
    const currentGoals = periodGoals.get(periodKey) || []
    const updatedGoals = currentGoals.filter((_, i) => i !== index)
    setPeriodGoals(prev => new Map(prev).set(periodKey, updatedGoals))
    savePeriodGoals(periodType, date, updatedGoals, label)
  }

  const toggleYear = (year: number) => {
    const newExpanded = new Set(expandedYears)
    if (newExpanded.has(year)) {
      newExpanded.delete(year)
    } else {
      newExpanded.add(year)
    }
    setExpandedYears(newExpanded)
  }

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
  }

  const getYearDistance = (year: number) => year - currentYear

  const getDetailLevel = (year: number): 'month' | 'quarter' | 'half' | 'year' => {
    const distance = getYearDistance(year)
    if (distance === 0) return 'month'
    if (distance === 1) return 'quarter'
    if (distance <= 3) return 'half'
    return 'year'
  }

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Управление целями</h1>

      {/* Мечта */}
      <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
        <h2 className="text-2xl font-bold mb-4 text-purple-900">🎯 Мечта</h2>

        <div className="space-y-4">
          <div>
            <label className="block">
              <span className="text-gray-700 font-medium mb-2 block">Горизонт планирования (лет):</span>
              <select
                value={dreamYears}
                onChange={(e) => setDreamYears(parseInt(e.target.value))}
                className="input w-48"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => (
                  <option key={y} value={y}>{y} {y === 1 ? 'год' : y < 5 ? 'года' : 'лет'}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label className="block">
              <span className="text-gray-700 font-medium mb-2 block">
                Главная цель на {dreamYears} {dreamYears === 1 ? 'год' : dreamYears < 5 ? 'года' : 'лет'}:
              </span>
              <textarea
                value={dreamText}
                onChange={(e) => setDreamText(e.target.value)}
                className="textarea resize-y"
                placeholder="Например: Стать основателем и CEO успешной IT-компании с командой 50+ человек..."
                rows={8}
              />
            </label>
          </div>

          <button onClick={saveDream} disabled={saving} className="btn-primary">
            {saving ? 'Сохранение...' : 'Сохранить мечту'}
          </button>
        </div>
      </div>

      {/* Иерархическое дерево целей */}
      {dreamGoal && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">📊 План достижения мечты</h2>

          <div className="space-y-2">
            {Array.from({ length: dreamGoal.years }, (_, i) => {
              const year = currentYear + i
              const distance = getYearDistance(year)
              const isExpanded = expandedYears.has(year)
              const goals = yearGoals.get(year) || []
              const detailLevel = getDetailLevel(year)
              const yearKey = `year-${year}`

              return (
                <div key={year} className="border border-gray-200 rounded-lg">
                  {/* Заголовок года */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{isExpanded ? '📂' : '📁'}</span>
                      <span className="font-bold text-lg">
                        {year} {distance === 0 && '(текущий)'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {goals.length > 0 ? `${goals.length} ${goals.length === 1 ? 'цель' : 'целей'}` : 'Нет целей'}
                      </span>
                    </div>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                  </button>

                  {/* Содержимое года */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {/* Цели на год */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-3">Цели на {year} год:</h4>

                        {/* Поле добавления новой цели */}
                        <div className="mb-3 flex gap-2">
                          <input
                            type="text"
                            value={newGoalInputs.get(yearKey) || ''}
                            onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(yearKey, e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addYearGoal(year)
                              }
                            }}
                            placeholder="Добавить цель..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => addYearGoal(year)}
                            className="btn-primary"
                          >
                            Добавить
                          </button>
                        </div>

                        {/* Список целей */}
                        <div className="space-y-2">
                          {goals.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-4">
                              Добавьте цели на {year} год...
                            </p>
                          ) : (
                            goals.map((goal, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                              >
                                <span className="flex-1 text-sm">{goal}</span>
                                <button
                                  onClick={() => removeYearGoal(year, index)}
                                  className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                                  title="Удалить цель"
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Детализация по периодам */}
                      {detailLevel !== 'year' && (
                        <div className="border-t pt-4 space-y-2">
                          <h4 className="font-semibold text-gray-600 text-sm">Детализация:</h4>

                          {/* Кварталы для текущего и следующего года */}
                          {(detailLevel === 'month' || detailLevel === 'quarter') && (
                            <div className="pl-4 space-y-1">
                              {[1, 2, 3, 4].map(quarter => {
                                const quarterKey = `${year}-Q${quarter}`
                                const quarterGoals = periodGoals.get(quarterKey) || []
                                const isQuarterExpanded = expandedPeriods.has(quarterKey)
                                const quarterDate = new Date(year, (quarter - 1) * 3, 1)

                                return (
                                  <div key={quarterKey} className="border-l-2 border-gray-200 pl-3">
                                    <button
                                      onClick={() => {
                                        const newExpanded = new Set(expandedPeriods)
                                        if (newExpanded.has(quarterKey)) {
                                          newExpanded.delete(quarterKey)
                                        } else {
                                          newExpanded.add(quarterKey)
                                          loadPeriodGoalsWithKey('quarter', quarterDate)
                                        }
                                        setExpandedPeriods(newExpanded)
                                      }}
                                      className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2"
                                    >
                                      <span>{isQuarterExpanded ? '📂' : '📁'}</span>
                                      <span>Q{quarter} {year}</span>
                                      <span className="text-xs text-gray-500">
                                        ({quarterGoals.length} {quarterGoals.length === 1 ? 'цель' : 'целей'})
                                      </span>
                                    </button>

                                    {isQuarterExpanded && (
                                      <div className="mt-2 ml-4 space-y-3">
                                        {/* Поле добавления новой цели для квартала */}
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={newGoalInputs.get(quarterKey) || ''}
                                            onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(quarterKey, e.target.value))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${quarter} ${year}`)
                                              }
                                            }}
                                            placeholder={`Добавить цель на Q${quarter}...`}
                                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                          />
                                          <button
                                            onClick={() => addPeriodGoal(quarterKey, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                            className="btn-primary text-sm"
                                          >
                                            Добавить
                                          </button>
                                        </div>

                                        {/* Список целей квартала */}
                                        <div className="space-y-1">
                                          {quarterGoals.length === 0 ? (
                                            <p className="text-gray-400 text-xs text-center py-2">
                                              Нет целей на Q{quarter}...
                                            </p>
                                          ) : (
                                            quarterGoals.map((goal, index) => (
                                              <div
                                                key={index}
                                                className="flex items-center gap-2 p-1.5 rounded border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                                              >
                                                <span className="flex-1 text-xs">{goal}</span>
                                                <button
                                                  onClick={() => removePeriodGoal(quarterKey, index, 'quarter', quarterDate, `Q${quarter} ${year}`)}
                                                  className="text-red-500 hover:text-red-700 text-xs px-1"
                                                  title="Удалить цель"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {/* Месяцы внутри квартала для текущего года */}
                                        {detailLevel === 'month' && (
                                          <div className="border-t pt-2 space-y-2">
                                            {[0, 1, 2].map(monthOffset => {
                                              const month = (quarter - 1) * 3 + monthOffset
                                              const monthDate = new Date(year, month, 1)
                                              const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
                                              const monthGoals = periodGoals.get(monthKey) || []

                                              return (
                                                <div key={monthKey} className="border-l-2 border-gray-300 pl-3">
                                                  <div className="text-xs font-medium text-gray-600 mb-2">
                                                    📅 {monthNames[month]} ({monthGoals.length} {monthGoals.length === 1 ? 'цель' : 'целей'})
                                                  </div>

                                                  {/* Поле добавления цели для месяца */}
                                                  <div className="flex gap-1 mb-2">
                                                    <input
                                                      type="text"
                                                      value={newGoalInputs.get(monthKey) || ''}
                                                      onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(monthKey, e.target.value))}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          e.preventDefault()
                                                          addPeriodGoal(monthKey, 'month', monthDate, monthNames[month])
                                                        }
                                                      }}
                                                      placeholder={`Добавить цель...`}
                                                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    />
                                                    <button
                                                      onClick={() => addPeriodGoal(monthKey, 'month', monthDate, monthNames[month])}
                                                      className="btn-primary text-xs px-3 py-1.5"
                                                    >
                                                      +
                                                    </button>
                                                  </div>

                                                  {/* Список целей месяца */}
                                                  <div className="space-y-1">
                                                    {monthGoals.length === 0 ? (
                                                      <p className="text-gray-400 text-xs text-center py-1">
                                                        Нет целей...
                                                      </p>
                                                    ) : (
                                                      monthGoals.map((goal, index) => (
                                                        <div
                                                          key={index}
                                                          className="flex items-center gap-1 p-1 rounded border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                                                        >
                                                          <span className="flex-1 text-xs">{goal}</span>
                                                          <button
                                                            onClick={() => removePeriodGoal(monthKey, index, 'month', monthDate, monthNames[month])}
                                                            className="text-red-500 hover:text-red-700 text-xs px-1"
                                                            title="Удалить цель"
                                                          >
                                                            ✕
                                                          </button>
                                                        </div>
                                                      ))
                                                    )}
                                                  </div>

                                                  {/* Недели для текущего месяца */}
                                                  {month === new Date().getMonth() && year === currentYear && (
                                                    <div className="border-t mt-2 pt-1 space-y-1">
                                                      {(() => {
                                                        const today = new Date()
                                                        const weeks: Date[] = []
                                                        const firstDay = new Date(year, month, 1)
                                                        const lastDay = new Date(year, month + 1, 0)

                                                        let current = new Date(firstDay)
                                                        while (current.getDay() !== 1) {
                                                          current.setDate(current.getDate() + 1)
                                                        }

                                                        while (current <= lastDay) {
                                                          weeks.push(new Date(current))
                                                          current.setDate(current.getDate() + 7)
                                                        }

                                                        return weeks.map((weekStart, idx) => {
                                                          const weekEnd = new Date(weekStart)
                                                          weekEnd.setDate(weekEnd.getDate() + 6)
                                                          const weekKey = `${year}-${String(month + 1).padStart(2, '0')}-W${idx + 1}`
                                                          const weekGoals = periodGoals.get(weekKey) || []

                                                          return (
                                                            <div key={weekKey} className="border-l-2 border-gray-400 pl-2">
                                                              <div className="text-xs font-medium text-gray-500 mb-1">
                                                                📌 Неделя {idx + 1} ({weekStart.getDate()}-{weekEnd.getDate()}) - {weekGoals.length} {weekGoals.length === 1 ? 'цель' : 'целей'}
                                                              </div>

                                                              {/* Поле добавления цели для недели */}
                                                              <div className="flex gap-1 mb-1">
                                                                <input
                                                                  type="text"
                                                                  value={newGoalInputs.get(weekKey) || ''}
                                                                  onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(weekKey, e.target.value))}
                                                                  onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                      e.preventDefault()
                                                                      addPeriodGoal(weekKey, 'week', weekStart, `Неделя ${idx + 1}`)
                                                                    }
                                                                  }}
                                                                  placeholder="Добавить..."
                                                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                                />
                                                                <button
                                                                  onClick={() => addPeriodGoal(weekKey, 'week', weekStart, `Неделя ${idx + 1}`)}
                                                                  className="btn-primary text-xs px-3 py-1.5"
                                                                >
                                                                  +
                                                                </button>
                                                              </div>

                                                              {/* Список целей недели */}
                                                              <div className="space-y-1">
                                                                {weekGoals.length === 0 ? (
                                                                  <p className="text-gray-400 text-xs text-center py-1">
                                                                    Нет целей...
                                                                  </p>
                                                                ) : (
                                                                  weekGoals.map((goal, index) => (
                                                                    <div
                                                                      key={index}
                                                                      className="flex items-center gap-1 p-1 rounded border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                                                                    >
                                                                      <span className="flex-1 text-xs">{goal}</span>
                                                                      <button
                                                                        onClick={() => removePeriodGoal(weekKey, index, 'week', weekStart, `Неделя ${idx + 1}`)}
                                                                        className="text-red-500 hover:text-red-700 text-xs px-1"
                                                                        title="Удалить"
                                                                      >
                                                                        ✕
                                                                      </button>
                                                                    </div>
                                                                  ))
                                                                )}
                                                              </div>
                                                            </div>
                                                          )
                                                        })
                                                      })()}
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Полугодия для дальних лет */}
                          {detailLevel === 'half' && (
                            <div className="pl-4 space-y-1">
                              {[1, 2].map(half => {
                                const halfKey = `${year}-H${half}`
                                const halfGoals = periodGoals.get(halfKey) || []
                                const halfDate = new Date(year, (half - 1) * 6, 1)

                                return (
                                  <div key={halfKey} className="border-l-2 border-gray-200 pl-3">
                                    <div className="text-sm font-medium text-gray-700 mb-2">
                                      📋 H{half} {year} ({halfGoals.length} {halfGoals.length === 1 ? 'цель' : 'целей'})
                                    </div>

                                    {/* Поле добавления цели для полугодия */}
                                    <div className="flex gap-2 mb-2">
                                      <input
                                        type="text"
                                        value={newGoalInputs.get(halfKey) || ''}
                                        onChange={(e) => setNewGoalInputs(prev => new Map(prev).set(halfKey, e.target.value))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${year}`)
                                          }
                                        }}
                                        placeholder={`Добавить цель на H${half}...`}
                                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      />
                                      <button
                                        onClick={() => addPeriodGoal(halfKey, 'half_year', halfDate, `H${half} ${year}`)}
                                        className="btn-primary text-sm"
                                      >
                                        Добавить
                                      </button>
                                    </div>

                                    {/* Список целей полугодия */}
                                    <div className="space-y-1">
                                      {halfGoals.length === 0 ? (
                                        <p className="text-gray-400 text-xs text-center py-2">
                                          Нет целей на H{half}...
                                        </p>
                                      ) : (
                                        halfGoals.map((goal, index) => (
                                          <div
                                            key={index}
                                            className="flex items-center gap-2 p-1.5 rounded border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                                          >
                                            <span className="flex-1 text-xs">{goal}</span>
                                            <button
                                              onClick={() => removePeriodGoal(halfKey, index, 'half_year', halfDate, `H${half} ${year}`)}
                                              className="text-red-500 hover:text-red-700 text-xs px-1"
                                              title="Удалить цель"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 z-50">
          <p className="font-medium">{message}</p>
        </div>
      )}
    </div>
  )
}
