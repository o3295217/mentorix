'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isToday, differenceInCalendarDays, isAfter } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry, DreamGoal } from '@/lib/types'

interface MonthData {
  month: Date
  days: Date[]
  startDayOfWeek: number
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthsToShow, setMonthsToShow] = useState(3)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const [entriesRes, dreamRes] = await Promise.all([
        fetch('/api/daily'),
        fetch('/api/goals/dream'),
      ])

      if (!entriesRes.ok) {
        console.error('Failed to load entries:', entriesRes.status)
        return
      }

      const entriesData = await entriesRes.json()
      setEntries(entriesData)

      if (dreamRes.ok) {
        const dreamData = await dreamRes.json()
        setDreamGoal(dreamData)
      }
    } catch (error) {
      console.error('Error loading entries:', error)
    } finally {
      setLoading(false)
    }
  }

  // Генерируем месяцы для отображения
  const months = useMemo((): MonthData[] => {
    const result: MonthData[] = []
    const now = new Date()
    
    for (let i = 0; i < monthsToShow; i++) {
      const month = subMonths(now, i)
      const start = startOfMonth(month)
      const end = endOfMonth(month)
      const days = eachDayOfInterval({ start, end })
      const startDayOfWeek = getDay(start) === 0 ? 6 : getDay(start) - 1 // Понедельник = 0
      
      result.push({ month, days, startDayOfWeek })
    }
    
    return result
  }, [monthsToShow])

  // Создаём карту дата -> запись для быстрого поиска
  const entriesMap = useMemo(() => {
    const map = new Map<string, DailyEntry>()
    entries.forEach(entry => {
      const dateKey = format(new Date(entry.date), 'yyyy-MM-dd')
      map.set(dateKey, entry)
    })
    return map
  }, [entries])

  // Фильтрация по поиску
  const matchingDates = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()
    
    const query = searchQuery.toLowerCase()
    const matching = new Set<string>()
    
    entries.forEach(entry => {
      const dateKey = format(new Date(entry.date), 'yyyy-MM-dd')
      const planText = entry.planText?.toLowerCase() || ''
      
      if (planText.includes(query) || dateKey.includes(query)) {
        matching.add(dateKey)
      }
    })
    
    return matching
  }, [entries, searchQuery])

  // Статистика использования
  const usageStats = useMemo(() => {
    if (!dreamGoal && entries.length === 0) return null

    const entryDates = entries.map((entry) => new Date(entry.date)).sort((a, b) => a.getTime() - b.getTime())
    const fallbackStartDate = entryDates[0] || new Date()
    const startDate = dreamGoal?.createdAt ? new Date(dreamGoal.createdAt) : fallbackStartDate
    const today = new Date()
    const entriesUntilToday = entries.filter((entry) => !isAfter(new Date(entry.date), today))
    const futurePlannedDays = entries.filter(
      (entry) => !!entry.planText && isAfter(new Date(entry.date), today)
    ).length
    const calendarDays = Math.max(1, differenceInCalendarDays(today, startDate) + 1)
    const plannedDays = entriesUntilToday.filter((entry) => !!entry.planText).length
    const evaluatedDays = entriesUntilToday.filter((entry) => !!entry.evaluation).length
    const usagePercent = Math.round((plannedDays / calendarDays) * 100)

    return { startDate, calendarDays, plannedDays, evaluatedDays, futurePlannedDays, usagePercent }
  }, [dreamGoal, entries])

  function getScoreColor(score: number): string {
    if (score >= 7) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="font-bold text-white">История</h1>
        
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Поиск по задачам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-48"
          />
          
          <div className="flex gap-1">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setMonthsToShow(n)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${ monthsToShow === n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {n} мес
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span>≥ 7 баллов</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>5-6 баллов</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>&lt; 5 баллов</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span>Нет оценки</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">П Ф О = План / Факт / Оценка</span>
        </div>
      </div>

      {/* Статистика использования */}
      {usageStats && (
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Старт:</span>
            <span className="text-white font-medium">{format(usageStats.startDate, 'd MMMM yyyy', { locale: ru })}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Дней прошло:</span>
            <span className="text-white font-medium">{usageStats.calendarDays}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Спланировано:</span>
            <span className="text-white font-medium">{usageStats.plannedDays}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Оценено:</span>
            <span className="text-white font-medium">{usageStats.evaluatedDays}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Впереди в плане:</span>
            <span className="text-white font-medium">{usageStats.futurePlannedDays}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Использование:</span>
            <span className={`font-bold ${
              usageStats.usagePercent >= 80 ? 'text-green-400' :
              usageStats.usagePercent >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>{usageStats.usagePercent}%</span>
          </div>
        </div>
      )}

      {/* Календарная сетка */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {months.map(({ month, days, startDayOfWeek }, index) => {
          // Градиент: текущий месяц светлый, каждый следующий на тон темнее
          // Компоненты RGB уменьшаются равномерно от светлого к тёмному
          const r = Math.max(10, 26 - index * 3)
          const g = Math.max(14, 31 - index * 3)
          const b = Math.max(20, 45 - index * 4)
          return (
          <div key={month.toISOString()} className="rounded-2xl p-4" style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}>
            <h2 className="text-base font-medium mb-2 text-white capitalize">
              {format(month, 'LLLL yyyy', { locale: ru })}
            </h2>
            
            {/* Заголовки дней недели */}
            <div className="grid grid-cols-7">
              {weekDays.map(day => (
                <div key={day} className="text-center text-[11px] font-medium text-gray-500 py-1.5">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Дни месяца */}
            <div className="grid grid-cols-7">
              {/* Пустые ячейки до начала месяца */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-[72px] border-t border-gray-800/60"></div>
              ))}
              
              {/* Дни */}
              {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const entry = entriesMap.get(dateKey)
                const hasEvaluation = !!entry?.evaluation
                const hasPlan = !!entry?.planText
                const hasFact = entry?.selectedTasksJson && JSON.parse(entry.selectedTasksJson).length > 0
                const isMatching = matchingDates.has(dateKey)
                const isTodayDate = isToday(day)
                
                return (
                  <Link
                    key={dateKey}
                    href={hasEvaluation ? `/evaluation/${dateKey}` : `/daily?date=${dateKey}`}
                    className={`h-[72px] border-t border-gray-800/60 flex flex-col transition-colors hover:bg-gray-800/40 ${
                      isMatching ? 'bg-yellow-500/10' : ''
                    }`}
                  >
                    {/* Номер дня */}
                    <div className="flex justify-center pt-1">
                      <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                        isTodayDate
                          ? 'bg-blue-500 text-white font-bold'
                          : 'text-gray-400'
                      }`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    
                    {/* Оценка по центру */}
                    <div className="flex-1 flex items-center justify-center">
                      {hasEvaluation && entry?.evaluation && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${getScoreColor(entry.evaluation.overallScore)}`}>
                          {entry.evaluation.overallScore}
                        </div>
                      )}
                      {entry && !hasEvaluation && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-500/80 text-white text-[10px]">
                          •••
                        </div>
                      )}
                    </div>
                    
                    {/* Индикаторы П Ф О */}
                    {entry && (
                      <div className="flex justify-center gap-0.5 text-[10px] pb-0.5">
                        <span className={hasPlan ? 'text-green-400' : 'text-gray-600'}>П</span>
                        <span className={hasFact ? 'text-green-400' : 'text-gray-600'}>Ф</span>
                        <span className={hasEvaluation ? 'text-green-400' : 'text-gray-600'}>О</span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
