'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { addDays, addMonths, format } from 'date-fns'
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
  /** id выпадающего календаря — переопределить при нескольких экземплярах на странице */
  calendarId?: string
  value: string // "yyyy-MM-dd"
  onChange: (value: string) => void
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

export default function DatePickerWithIndicators({ value, onChange, calendarId = 'daily-date-picker-calendar' }: DatePickerWithIndicatorsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(parseDateKey(value))
  const [indicators, setIndicators] = useState<DateIndicators>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [focusedDateKey, setFocusedDateKey] = useState(value)
  const pickerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dayButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const focusFrameRef = useRef<number | null>(null)

  // Загрузка индикаторов при изменении месяца
  useEffect(() => {
    const controller = new AbortController()
    const monthStr = format(currentMonth, 'yyyy-MM')

    setIndicators({})
    setLoadError('')
    setIsLoading(true)

    void (async () => {
      try {
        const res = await fetch(`/api/daily/indicators?month=${monthStr}`, { signal: controller.signal })
        if (!res.ok) {
          // Если не авторизован (или сессия истекла) — просто не показываем индикаторы.
          if (res.status === 401) return
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json() as DateIndicators
        if (!controller.signal.aborted) setIndicators(data)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Error loading indicators:', error)
        setLoadError('Не удалось загрузить отметки календаря')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [currentMonth])

  const cancelFocusFrame = useCallback(() => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current)
      focusFrameRef.current = null
    }
  }, [])

  const restoreTriggerFocus = useCallback(() => {
    cancelFocusFrame()
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null
      triggerRef.current?.focus()
    })
  }, [cancelFocusFrame])

  const closeCalendar = useCallback((restoreFocus = true) => {
    setIsOpen(false)
    if (restoreFocus) restoreTriggerFocus()
  }, [restoreTriggerFocus])

  useEffect(() => {
    if (!isOpen) return
    cancelFocusFrame()
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null
      dayButtonRefs.current.get(focusedDateKey)?.focus()
    })
    return cancelFocusFrame
  }, [cancelFocusFrame, currentMonth, focusedDateKey, isOpen])

  useEffect(() => cancelFocusFrame, [cancelFocusFrame])

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        closeCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeCalendar])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeCalendar()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeCalendar, isOpen])

  const handleDateSelect = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    onChange(dateStr)
    closeCalendar()
  }, [closeCalendar, onChange])

  const toggleCalendar = useCallback(() => {
    if (isOpen) {
      closeCalendar(false)
      return
    }
    const selectedDate = parseDateKey(value)
    setIndicators({})
    setLoadError('')
    setIsLoading(true)
    setCurrentMonth(selectedDate)
    setFocusedDateKey(value)
    setIsOpen(true)
  }, [closeCalendar, isOpen, value])

  const goToToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    handleDateSelect(today)
  }

  const showMonth = (date: Date) => {
    setIndicators({})
    setLoadError('')
    setIsLoading(true)
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setFocusedDateKey(format(date, 'yyyy-MM-dd'))
  }

  const goToPreviousMonth = () => {
    showMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    showMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
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
      isCurrentMonth: date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear(),
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
    <div className="type-caption grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 font-medium uppercase tracking-wide">
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

    // Роль — «подпись даты» (как «подписи времени» в шкале), поэтому type-secondary,
    // а не type-body: цвет ниже переопределяется по состоянию дня (выбран/сегодня/чужой месяц).
    let className = 'relative flex h-11 min-w-0 w-full cursor-pointer items-center justify-center rounded type-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 '

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

  const getDayAccessibleName = (date: Date) => {
    const state = getDateState(date)
    const markerLabels: string[] = []
    if (state.indicator?.hasPlan) markerLabels.push('есть план')
    if (state.indicator?.hasEvaluation) {
      markerLabels.push(state.indicator.dreamProgressScore === undefined
        ? 'день оценён'
        : `день оценён, прогресс ${state.indicator.dreamProgressScore} из 10`)
    }
    const dateLabel = format(date, 'd MMMM yyyy, EEEE', { locale: ru })
    return markerLabels.length > 0 ? `${dateLabel}. ${markerLabels.join(', ')}` : dateLabel
  }

  const moveGridFocus = (date: Date) => {
    const nextKey = format(date, 'yyyy-MM-dd')
    if (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear()) {
      showMonth(date)
    } else {
      setFocusedDateKey(nextKey)
    }
  }

  const handleDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let nextDate: Date | null = null
    if (event.key === 'ArrowLeft') nextDate = addDays(date, -1)
    else if (event.key === 'ArrowRight') nextDate = addDays(date, 1)
    else if (event.key === 'ArrowUp') nextDate = addDays(date, -7)
    else if (event.key === 'ArrowDown') nextDate = addDays(date, 7)
    else if (event.key === 'PageUp') nextDate = addMonths(date, event.shiftKey ? -12 : -1)
    else if (event.key === 'PageDown') nextDate = addMonths(date, event.shiftKey ? 12 : 1)
    else if (event.key === 'Home') {
      const mondayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
      nextDate = addDays(date, -mondayIndex)
    } else if (event.key === 'End') {
      const mondayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
      nextDate = addDays(date, 6 - mondayIndex)
    }

    if (!nextDate) return
    event.preventDefault()
    moveGridFocus(nextDate)
  }

  const days = getDaysInMonth()
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  return (
    <div ref={pickerRef} className="relative w-auto min-w-0 flex-shrink-0">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleCalendar}
        className="input type-body flex min-h-11 w-auto min-w-0 cursor-pointer items-center justify-between gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={calendarId}
        aria-haspopup="dialog"
      >
        <span className="min-w-0 truncate">{format(parseDateKey(value), 'd MMMM yyyy', { locale: ru })}</span>
        <span aria-hidden="true" className="flex-shrink-0 text-gray-400">▾</span>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          id={calendarId}
          role="dialog"
          aria-label="Выбор даты"
          className="daily-date-picker-dialog fixed left-1/2 z-50 w-screen max-w-[22rem] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-lg border-2 border-gray-700 bg-gray-900/95 p-0 shadow-xl sm:w-[22rem] sm:p-2 lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:translate-x-0 lg:overflow-visible lg:overscroll-auto lg:p-4"
        >
          {/* Header */}
          <div className="mb-2 flex items-center justify-between px-1 pt-1 sm:mb-4 sm:px-0 sm:pt-0">
            <button type="button" onClick={goToPreviousMonth} className="flex h-11 min-w-11 items-center justify-center rounded text-gray-300 hover:bg-gray-700" aria-label="Предыдущий месяц">
              ↑
            </button>
            <h2 id="daily-date-picker-month" className="type-card-title min-w-0 flex-1 px-1 text-center" aria-live="polite">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </h2>
            <button type="button" onClick={goToNextMonth} className="flex h-11 min-w-11 items-center justify-center rounded text-gray-300 hover:bg-gray-700" aria-label="Следующий месяц">
              ↓
            </button>
          </div>

          <div className="type-caption min-h-5 px-1 text-center sm:px-0" aria-live="polite" aria-atomic="true">
            {isLoading && <span className="text-gray-400" role="status">Загрузка отметок…</span>}
            {!isLoading && loadError && <span className="text-red-300" role="alert">{loadError}</span>}
          </div>

          {/* Week days */}
          <div className="mb-1 grid grid-cols-7 gap-0 sm:mb-2 sm:gap-1">
            {weekDays.map((day) => (
              <div key={day} className="type-caption text-center font-semibold">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-0 sm:gap-1" role="grid" aria-labelledby="daily-date-picker-month">
            {days.map((date) => {
              const dateKey = format(date, 'yyyy-MM-dd')
              const todayKey = format(new Date(), 'yyyy-MM-dd')
              return (
              <div key={dateKey} role="gridcell" aria-selected={dateKey === value} className="min-w-0">
                <button
                  ref={(node) => {
                    if (node) dayButtonRefs.current.set(dateKey, node)
                    else dayButtonRefs.current.delete(dateKey)
                  }}
                  type="button"
                  className={getDayClassName(date)}
                  onClick={() => handleDateSelect(date)}
                  onFocus={() => setFocusedDateKey(dateKey)}
                  onKeyDown={(event) => handleDayKeyDown(event, date)}
                  tabIndex={dateKey === focusedDateKey ? 0 : -1}
                  aria-label={getDayAccessibleName(date)}
                  aria-current={dateKey === todayKey ? 'date' : undefined}
                >
                  {date.getDate()}
                  {renderDayMarkers(date)}
                </button>
              </div>
              )
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-gray-700 px-1 py-1 text-sm sm:mt-4 sm:px-0 sm:pb-0 sm:pt-4">
            <button type="button" onClick={() => closeCalendar()} className="min-h-11 rounded px-3 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200">
              Закрыть
            </button>
            <button type="button" onClick={goToToday} className="min-h-11 rounded px-3 text-blue-400 transition-colors hover:bg-gray-800 hover:text-blue-300">
              Сегодня
            </button>
          </div>

          <div className="type-caption border-t border-gray-700 px-2 py-2 sm:mt-3 sm:px-0 sm:pb-0 sm:pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-5">
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
