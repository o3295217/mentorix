'use client'

// Всплывающее напоминание «цели прошлого месяца не закрыты».
// Показывается разово при входе (sessionStorage), закрывается крестиком.
// Действия: перенос цели в неделю текущего месяца или все цели — в раздел задач.

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '@/lib/fetch-json'
import { formatWeekRange, getMonthWeeks, MonthWeek } from '@/lib/goals-utils'
import { formatMonthGenitive, CarryoverItem } from '@/lib/carryover'

const DISMISS_KEY = 'carryover-notice-dismissed'

interface CarryoverData {
  month: string
  items: CarryoverItem[]
}

type Decision = {
  text: string
  fromKey: string
  action: { type: 'week'; weekKey: string } | { type: 'backlog' }
}

export default function CarryoverNotice() {
  const [data, setData] = useState<CarryoverData | null>(null)
  const [weeks, setWeeks] = useState<MonthWeek[]>([])
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return
    } catch {
      // sessionStorage недоступен — показываем без запоминания
    }
    let cancelled = false
    fetchJson<CarryoverData>('/api/goals/carryover')
      .then(res => {
        if (cancelled || !res?.items?.length) return
        const now = new Date()
        setWeeks(getMonthWeeks(now.getFullYear(), now.getMonth()))
        setData(res)
      })
      .catch(() => {
        // Напоминание не критично — молча пропускаем
      })
    return () => { cancelled = true }
  }, [])

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setData(null)
  }, [])

  useEffect(() => {
    if (!data) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [data, dismiss])

  const sendDecisions = useCallback(async (decisions: Decision[]): Promise<boolean> => {
    try {
      await fetchJson('/api/goals/carryover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      })
      return true
    } catch (error) {
      console.error('Carryover decision failed:', error)
      return false
    }
  }, [])

  const moveToWeek = useCallback(async (item: CarryoverItem, weekKey: string) => {
    setProcessing(prev => new Set(prev).add(item.text))
    const ok = await sendDecisions([{ text: item.text, fromKey: item.fromKey, action: { type: 'week', weekKey } }])
    setProcessing(prev => {
      const next = new Set(prev)
      next.delete(item.text)
      return next
    })
    if (ok) {
      setData(prev => {
        if (!prev) return prev
        const items = prev.items.filter(i => i.text !== item.text)
        return items.length > 0 ? { ...prev, items } : null
      })
    }
  }, [sendDecisions])

  const moveAllToBacklog = useCallback(async () => {
    if (!data) return
    setBulkProcessing(true)
    const ok = await sendDecisions(
      data.items.map(item => ({ text: item.text, fromKey: item.fromKey, action: { type: 'backlog' as const } }))
    )
    setBulkProcessing(false)
    if (ok) setData(null)
  }, [data, sendDecisions])

  if (!data) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Цели прошлого месяца не закрыты">
      <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-amber-500/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.99))] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Цели прошлого месяца не закрыты</h2>
            <p className="mt-1 text-sm text-gray-400">
              Осталось из {formatMonthGenitive(data.month)}: {data.items.length}. Перенеси кнопками на неделю текущего месяца или отправь все в раздел задач.
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            aria-label="Закрыть напоминание"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {data.items.map(item => {
            const isProcessing = processing.has(item.text)
            return (
              <div key={`${item.fromKey}:${item.text}`} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm leading-6 text-gray-100 [overflow-wrap:anywhere]">{item.text}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.fromType === 'week' ? `неделя ${item.fromKey.split('-W')[1]} прошлого месяца` : 'цель месяца'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5" aria-label={`Перенести «${item.text}» на неделю`}>
                  <span className="mr-1 text-xs text-gray-500">в неделю:</span>
                  {weeks.map(week => (
                    <button
                      key={week.key}
                      type="button"
                      disabled={isProcessing || bulkProcessing}
                      title={formatWeekRange(week)}
                      aria-label={`Перенести «${item.text}» на неделю ${week.num} (${formatWeekRange(week)})`}
                      onClick={() => moveToWeek(item, week.key)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-sm font-medium text-gray-200 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {week.num}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            disabled={bulkProcessing || processing.size > 0}
            onClick={moveAllToBacklog}
            className="min-h-11 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkProcessing ? 'Переношу…' : 'Все — в раздел задач'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Позже
          </button>
        </div>
      </div>
    </div>
  )
}
