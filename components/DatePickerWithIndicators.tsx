'use client'

import { useState, useEffect, useRef } from 'react'
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

interface DatePickerWithIndicatorsProps {
  value: string // "yyyy-MM-dd"
  onChange: (value: string) => void
}

export default function DatePickerWithIndicators({ value, onChange }: DatePickerWithIndicatorsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date(value))
  const [indicators, setIndicators] = useState<DateIndicators>({})
  const pickerRef = useRef<HTMLDivElement>(null)

  // Загрузка индикаторов при изменении месяца
  useEffect(() => {
    loadIndicators()
  }, [currentMonth])

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

  const loadIndicators = async () => {
    try {
      const monthStr = format(currentMonth, 'yyyy-MM')
      const res = await fetch(`/api/daily/indicators?month=${monthStr}`)
      if (!res.ok) {
        console.error('Failed to load indicators:', res.status)
        return
      }
      const data = await res.json()
      setIndicators(data)
    } catch (error) {
      console.error('Error loading indicators:', error)
    }
  }

  const handleDateSelect = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    onChange(dateStr)
    setIsOpen(false)
  }

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

  const renderIndicatorDot = (date: Date) => {
    const indicator = getIndicatorForDate(date)
    if (!indicator) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateNoTime = new Date(date)
    dateNoTime.setHours(0, 0, 0, 0)
    const isPast = dateNoTime < today
    const isFuture = dateNoTime > today

    // Будущие даты с планом = зелёная точка
    if (isFuture && indicator.hasPlan) {
      return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full"></span>
    }

    // Прошедшие даты с выполненным планом = синяя обводка (показываем через CSS класс)
    // Прошедшие даты без факта = красная точка
    if (isPast && indicator.hasPlan) {
      if (indicator.hasFact) {
        // Синяя обводка добавится через className
        return null
      } else {
        // Красная точка = просрочено
        return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
      }
    }

    return null
  }

  const getDayClassName = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const isSelected = dateStr === value
    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
    const indicator = getIndicatorForDate(date)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateNoTime = new Date(date)
    dateNoTime.setHours(0, 0, 0, 0)
    const isPast = dateNoTime < today

    let className = 'relative w-10 h-10 flex items-center justify-center rounded cursor-pointer text-sm '

    if (isSelected) {
      className += 'bg-blue-500 text-white font-bold '
    } else if (isToday) {
      className += 'bg-blue-100 font-semibold '
    } else if (!isCurrentMonth) {
      className += 'text-gray-400 '
    } else {
      className += 'hover:bg-gray-100 '
    }

    // Синяя обводка для прошедших дат с выполненным планом
    if (isPast && indicator?.hasPlan && indicator?.hasFact) {
      className += 'ring-2 ring-blue-400 '
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
        value={format(new Date(value), 'd MMMM yyyy', { locale: ru })}
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        className="input w-auto cursor-pointer"
      />

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 z-50 w-80">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded">
              ↑
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentMonth)
                newDate.setMonth(newDate.getMonth() - 1)
                setCurrentMonth(newDate)
              }}
              className="text-lg font-semibold"
            >
              {format(currentMonth, 'LLLL yyyy', { locale: ru })} ▼
            </button>
            <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded">
              ↓
            </button>
          </div>

          {/* Week days */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, i) => (
              <div key={i} className={getDayClassName(date)} onClick={() => handleDateSelect(date)}>
                {date.getDate()}
                {renderIndicatorDot(date)}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-sm">
            <button onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline">
              Удалить
            </button>
            <button onClick={goToToday} className="text-blue-600 hover:underline">
              Сегодня
            </button>
          </div>

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>Запланировано</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 ring-2 ring-blue-400 rounded"></span>
              <span>Оценено</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
