'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, isToday, differenceInCalendarDays, isAfter } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { DailyEntry, DreamGoal, PaginatedResponse } from '@/lib/types'
import { safeParseJson } from '@/lib/safe-json'

interface MonthData {
  month: Date
  days: Date[]
  startDayOfWeek: number
}

interface CompletedWorkItem {
  id: number
  date: string
  type: string
  text: string
  category: string | null
  goalLink: string | null
}

interface FactsResponse {
  items: CompletedWorkItem[]
  stats: {
    total: number
    byType: Record<string, number>
    byCategory: Record<string, number>
  }
  limit: number
  offset: number
}

type TabType = 'calendar' | 'achievements'

export default function HistoryPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthsToShow, setMonthsToShow] = useState(3)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('calendar')

  // Сделано
  const [factsData, setFactsData] = useState<FactsResponse | null>(null)
  const [factsPeriod, setFactsPeriod] = useState<'week' | 'month' | 'custom' | 'all'>('week')
  const [factsType, setFactsType] = useState<'all' | 'task' | 'goal'>('all')
  const [factsLoading, setFactsLoading] = useState(false)
  const [factsFrom, setFactsFrom] = useState('')
  const [factsTo, setFactsTo] = useState('')

  useEffect(() => {
    loadEntries()
  }, [monthsToShow])

  const loadEntries = async () => {
    try {
      setLoading(true)
      const today = new Date()
      const from = startOfMonth(subMonths(today, monthsToShow - 1))
      const to = endOfMonth(today)
      const entriesData: DailyEntry[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          from: format(from, 'yyyy-MM-dd'),
          to: format(to, 'yyyy-MM-dd'),
          limit: '100',
          offset: String(offset),
        })
        const entriesRes = await fetch(`/api/daily?${params}`)

        if (!entriesRes.ok) {
          console.error('Failed to load entries:', entriesRes.status)
          break
        }

        const page = await entriesRes.json() as PaginatedResponse<DailyEntry>
        entriesData.push(...page.items)
        hasMore = page.hasMore
        offset += page.limit
      }

      const dreamRes = await fetch('/api/goals/dream')
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

  const loadFacts = useCallback(async () => {
    setFactsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (factsPeriod === 'custom' && factsFrom && factsTo) {
        params.set('period', 'all')
        params.set('from', factsFrom)
        params.set('to', factsTo)
      } else {
        params.set('period', factsPeriod === 'custom' ? 'all' : factsPeriod)
      }
      if (factsType !== 'all') params.set('type', factsType)
      const res = await fetch(`/api/facts?${params}`)
      if (res.ok) {
        setFactsData(await res.json())
      }
    } catch (error) {
      console.error('Error loading facts:', error)
    } finally {
      setFactsLoading(false)
    }
  }, [factsPeriod, factsType, factsFrom, factsTo])

  useEffect(() => {
    if (activeTab === 'achievements') {
      loadFacts()
    }
  }, [activeTab, loadFacts])

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
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-white">История</h1>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'calendar' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Календарь
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'achievements' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Сделано
            </button>
          </div>
        </div>
        
        {activeTab === 'calendar' && (
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
        )}
      </div>

      {activeTab === 'achievements' ? (
        <AchievementsTab
          factsData={factsData}
          factsLoading={factsLoading}
          factsPeriod={factsPeriod}
          setFactsPeriod={setFactsPeriod}
          factsType={factsType}
          setFactsType={setFactsType}
          factsFrom={factsFrom}
          setFactsFrom={setFactsFrom}
          factsTo={factsTo}
          setFactsTo={setFactsTo}
        />
      ) : (
      <>


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
                const hasFact = safeParseJson<string[]>(entry?.selectedTasksJson, []).length > 0
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
      </>
      )}
    </div>
  )
}

// ==================== Компонент вкладки «Сделано» ====================

function AchievementsTab({
  factsData,
  factsLoading,
  factsPeriod,
  setFactsPeriod,
  factsType,
  setFactsType,
  factsFrom,
  setFactsFrom,
  factsTo,
  setFactsTo,
}: {
  factsData: FactsResponse | null
  factsLoading: boolean
  factsPeriod: 'week' | 'month' | 'custom' | 'all'
  setFactsPeriod: (v: 'week' | 'month' | 'custom' | 'all') => void
  factsType: 'all' | 'task' | 'goal'
  setFactsType: (v: 'all' | 'task' | 'goal') => void
  factsFrom: string
  setFactsFrom: (v: string) => void
  factsTo: string
  setFactsTo: (v: string) => void
}) {
  const periodLabels = { week: 'Неделя', month: 'Месяц', custom: 'Период', all: 'Всё время' }
  const typeLabels = { all: 'Все', task: 'Задачи', goal: 'Цели' }
  const typeColors: Record<string, string> = {
    task: 'bg-blue-500/20 text-blue-400',
    goal: 'bg-green-500/20 text-green-400',
    extra: 'bg-purple-500/20 text-purple-400',
    habit: 'bg-yellow-500/20 text-yellow-400',
  }
  const catColors: Record<string, string> = {
    'стратегические': 'text-orange-400',
    'операционные': 'text-blue-400',
    'привычки': 'text-yellow-400',
    'созвоны': 'text-purple-400',
  }

  // Группировка по датам
  const groupedByDate = useMemo(() => {
    if (!factsData) return []
    const groups = new Map<string, CompletedWorkItem[]>()
    for (const item of factsData.items) {
      const dateKey = format(new Date(item.date), 'yyyy-MM-dd')
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey)!.push(item)
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [factsData])

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-1">
          {(Object.entries(periodLabels) as [typeof factsPeriod, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFactsPeriod(key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                factsPeriod === key ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(Object.entries(typeLabels) as [typeof factsType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFactsType(key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                factsType === key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Выбор дат для кастомного периода */}
      {factsPeriod === 'custom' && (
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-gray-400">С:</label>
          <input
            type="date"
            value={factsFrom}
            onChange={(e) => setFactsFrom(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
          />
          <label className="text-sm text-gray-400">По:</label>
          <input
            type="date"
            value={factsTo}
            onChange={(e) => setFactsTo(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
          />
        </div>
      )}

      {/* Статистика */}
      {factsData && !factsLoading && (
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Всего:</span>
            <span className="text-white font-bold text-lg">{factsData.stats.total}</span>
          </div>
          {Object.entries(factsData.stats.byType).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-xs ${typeColors[type] || 'bg-gray-700 text-gray-400'}`}>
                {type === 'task' ? 'Задачи' : type === 'goal' ? 'Цели' : type === 'extra' ? 'Сверх плана' : type}
              </span>
              <span className="text-white font-medium">{count}</span>
            </div>
          ))}
          <span className="text-gray-600">|</span>
          {Object.entries(factsData.stats.byCategory).map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className={`text-xs ${catColors[cat] || 'text-gray-400'}`}>{cat}</span>
              <span className="text-white font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Загрузка */}
      {factsLoading && (
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      )}

      {/* Список по датам */}
      {!factsLoading && factsData && groupedByDate.length === 0 && (
        <div className="text-center py-8 text-gray-500">Нет выполненных задач за выбранный период</div>
      )}

      {!factsLoading && groupedByDate.map(([dateKey, items]) => (
        <div key={dateKey} className="rounded-xl bg-gray-800/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              {format(new Date(dateKey), 'd MMMM yyyy, EEEE', { locale: ru })}
            </h3>
            <span className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'задача' : items.length < 5 ? 'задачи' : 'задач'}</span>
          </div>
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <span className={`px-1.5 py-0.5 rounded text-[10px] mt-0.5 flex-shrink-0 ${typeColors[item.type] || 'bg-gray-700 text-gray-400'}`}>
                  {item.type === 'task' ? 'задача' : item.type === 'goal' ? 'цель' : item.type === 'extra' ? 'сверх плана' : item.type}
                </span>
                <span className="text-white">{item.text}</span>
                {item.category && (
                  <span className={`text-[10px] ml-auto flex-shrink-0 ${catColors[item.category] || 'text-gray-500'}`}>
                    {item.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
