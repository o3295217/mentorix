'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface DateIndicators {
  [dateKey: string]: {
    hasPlan: boolean
    hasFact: boolean
    hasEvaluation: boolean
    dreamProgressScore?: number
  }
}

type DateIndicator = DateIndicators[string]

interface DateState {
  indicator?: DateIndicator
  isCurrentMonth: boolean
  isFuture: boolean
  isPast: boolean
  isSelected: boolean
  isToday: boolean
}

interface DatePickerWithIndicatorsProps {
  value: string // "yyyy-MM-dd"
  onChange: (value: string) => void
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

export default function DatePickerWithIndicators({ value, onChange }: DatePickerWithIndicatorsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(parseDateKey(value))
  const [indicators, setIndicators] = useState<DateIndicators>({})
  const pickerRef = useRef<HTMLDivElement>(null)

  // Memoized loadIndicators function
  const loadIndicators = useCallback(async () => {
    try {
      const monthStr = format(currentMonth, 'yyyy-MM')
      const res = await fetch(`/api/daily/indicators?month=${monthStr}`)
      if (!res.ok) {
        // Если не авторизован (или сессия истекла) — просто не показываем индикаторы
        if (res.status === 401) {
          setIndicators({})
          return
        }

        console.error('Failed to load indicators:', res.status)
        return
      }
      const data = await res.json()
      setIndicators(data)
    } catch (error) {
      console.error('Error loading indicators:', error)
    }
  }, [currentMonth])

  // Загрузка индикаторов при изменении месяца
  useEffect(() => {
    loadIndicators()
  }, [loadIndicators])

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDateSelect = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    onChange(dateStr)
    setIsOpen(false)
  }, [onChange])

  const toggleCalendar = useCallback(() => {
    setCurrentMonth(parseDateKey(value))
    setIsOpen((open) => !open)
  }, [value])

  const goToToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    handleDateSelect(today)
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: Date[] = []

    // Добавляем дни предыдущего месяца
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Понедельник = 0
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }

    // Добавляем дни текущего месяца
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    // Добавляем дни следующего месяца
    const lastDayOfWeek = lastDay.getDay() === 0 ? 6 : lastDay.getDay() - 1
    for (let i = 1; i < 7 - lastDayOfWeek; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }

  const getIndicatorForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return indicators[dateKey]
  }

  const getDateState = (date: Date): DateState => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateNoTime = new Date(date)
    dateNoTime.setHours(0, 0, 0, 0)

    return {
      indicator: getIndicatorForDate(date),
      isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
      isFuture: dateNoTime > today,
      isPast: dateNoTime < today,
      isSelected: dateStr === value && dateNoTime.getTime() !== today.getTime(),
      isToday: dateNoTime.getTime() === today.getTime(),
    }
  }

  const getEvaluationDotClass = (score?: number) => {
    if (score === undefined) return 'bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.8)]'
    if (score >= 7) return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.85)]'
    if (score >= 5) return 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]'
    return 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.85)]'
  }

  const renderDayMarkers = (date: Date) => {
    const state = getDateState(date)
    const { indicator } = state
    if (!indicator) return null

    const hasPlanWithoutEvaluation = !state.isFuture && indicator.hasPlan && !indicator.hasEvaluation
    const planBarClass = state.isPast ? 'bg-amber-400' : 'bg-blue-400'

    return (
      <span className="pointer-events-none absolute inset-0">
        {state.isFuture && indicator.hasPlan && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.85)]" />
        )}
        {hasPlanWithoutEvaluation && (
          <span className={`absolute bottom-1 left-2 right-2 h-0.5 rounded-full ${planBarClass}`} />
        )}
        {indicator.hasEvaluation && (
          <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${getEvaluationDotClass(indicator.dreamProgressScore)}`} />
        )}
      </span>
    )
  }

  type LegendSampleType = 'selected' | 'today' | 'evaluated' | 'waiting' | 'planned' | 'future'

  const renderLegendSample = (type: LegendSampleType) => {
    if (type === 'selected') {
      return <span className="h-4 w-5 rounded bg-blue-500" />
    }

    if (type === 'today') {
      return <span className="h-4 w-5 rounded border border-emerald-300" />
    }

    if (type === 'evaluated') {
      return <span className="h-2 w-2 rounded-full bg-emerald-400" />
    }

    if (type === 'planned') {
      return <span className="h-0.5 w-5 rounded-full bg-blue-400" />
    }

    if (type === 'waiting') {
      return <span className="h-0.5 w-5 rounded-full bg-amber-400" />
    }

    if (type === 'future') {
      return (
        <span className="relative h-4 w-5 rounded border border-slate-700">
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
        </span>
      )
    }

    return null
  }

  const renderLegendHeading = (label: string) => (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
      <span aria-hidden="true" />
      <span>{label}</span>
    </div>
  )

  const renderLegendItem = (type: LegendSampleType, label: string) => (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2">
      <span className="flex w-6 justify-center">
        {renderLegendSample(type)}
      </span>
      <span className="min-w-0 leading-tight">{label}</span>
    </div>
  )

  const getDayClassName = (date: Date) => {
    const state = getDateState(date)

    let className = 'relative flex h-10 w-10 cursor-pointer items-center justify-center rounded text-sm transition-colors '

    if (state.isSelected) {
      className += 'bg-blue-500 text-white font-bold '
    } else if (!state.isCurrentMonth) {
      className += 'text-gray-600 hover:bg-gray-800/60 '
    } else {
      className += 'hover:bg-gray-700 text-gray-100 '
    }

    if (state.isToday && !state.isSelected) {
      className += 'font-semibold text-white ring-1 ring-emerald-300/90 ring-offset-1 ring-offset-gray-900 '
    }

    return className
  }

  const days = getDaysInMonth()
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  return (
    <div ref={pickerRef} className="relative">
      {/* Input */}
      <input
        type="text"
        value={format(parseDateKey(value), 'd MMMM yyyy', { locale: ru })}
        onClick={toggleCalendar}
        readOnly
        className="input w-auto cursor-pointer"
      />

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-gray-900/80 border-2 border-gray-700 rounded-lg shadow-xl p-4 z-50 w-80">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-700 rounded text-gray-300">
              ↑
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentMonth)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentMonth(newDate)
              }}
              className="text-lg font-semibold text-white"
            >
              {format(currentMonth, 'LLLL yyyy', { locale: ru })} 
            </button>
            <button onClick={goToNextMonth} className="p-2 hover:bg-gray-700 rounded text-gray-300">
              ↓
            </button>
          </div>

          {/* Week days */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => (
              <div key={i} className={getDayClassName(date)} onClick={() => handleDateSelect(date)}>
                {date.getDate()}
                {renderDayMarkers(date)}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t border-gray-700 pt-4 text-sm">
            <button onClick={() => setIsOpen(false)} className="text-gray-400 transition-colors hover:text-gray-200">
              Закрыть
            </button>
            <button onClick={goToToday} className="text-blue-400 transition-colors hover:text-blue-300">
              Сегодня
            </button>
          </div>

          <div className="mt-3 border-t border-gray-700 pt-3 text-xs text-gray-400">
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <div className="space-y-2">
                {renderLegendHeading('День')}
                {renderLegendItem('selected', 'Выбранный')}
                {renderLegendItem('today', 'Сегодня')}
                {renderLegendItem('evaluated', 'Оценён')}
              </div>

              <div className="space-y-2">
                {renderLegendHeading('План')}
                {renderLegendItem('planned', 'План сегодня')}
                {renderLegendItem('future', 'Будущий план')}
                {renderLegendItem('waiting', 'Ждёт оценки')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
