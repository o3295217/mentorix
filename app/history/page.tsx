'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isToday } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry } from '@/lib/types'

interface MonthData {
  month: Date
  days: Date[]
  startDayOfWeek: number
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [monthsToShow, setMonthsToShow] = useState(3)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      // Получаем все записи (API возвращает все если нет from/to)
      const res = await fetch('/api/daily')
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

      {/* Календарная сетка */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map(({ month, days, startDayOfWeek }) => (
          <div key={month.toISOString()} className="card p-4">
            <h2 className="font-semibold mb-3 text-white">
              {format(month, 'LLLL yyyy', { locale: ru })}
            </h2>
            
            {/* Заголовки дней недели */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Дни месяца */}
            <div className="grid grid-cols-7 gap-1">
              {/* Пустые ячейки до начала месяца */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 sm:h-24"></div>
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
                    className={`h-20 sm:h-24 rounded-lg border transition-all hover:scale-105 flex flex-col ${
                      isTodayDate 
                        ? 'ring-2 ring-purple-500 border-purple-300' 
                        : 'border-gray-700'
                    } ${
                      isMatching ? 'ring-2 ring-yellow-400' : ''
                    } ${
                      entry 
                        ? 'bg-gray-900/80' 
                        : 'bg-gray-950'
                    }`}
                  >
                    {/* Номер дня */}
                    <div className="text-xs font-medium text-gray-400 p-1">
                      {format(day, 'd')}
                    </div>
                    
                    {/* Оценка по центру */}
                    <div className="flex-1 flex items-center justify-center">
                      {hasEvaluation && entry?.evaluation && (
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base ${getScoreColor(entry.evaluation.overallScore)}`}>
                          {entry.evaluation.overallScore}
                        </div>
                      )}
                      {entry && !hasEvaluation && (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-blue-500 text-white text-xs">
                          •••
                        </div>
                      )}
                    </div>
                    
                    {/* Индикаторы П Ф О */}
                    {entry && (
                      <div className="flex justify-center gap-1 text-xs pb-1">
                        <span className={hasPlan ? 'text-green-400' : 'text-gray-400'}>П</span>
                        <span className={hasFact ? 'text-green-400' : 'text-gray-400'}>Ф</span>
                        <span className={hasEvaluation ? 'text-green-400' : 'text-gray-400'}>О</span>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
