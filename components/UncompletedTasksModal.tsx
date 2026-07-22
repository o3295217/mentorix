'use client'

import { useEffect, useRef, useState } from 'react'
import { format, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'

export interface UncompletedTask {
  id: number
  taskText: string
  transferCount?: number // сколько раз уже переносилась
}

export type TaskAction = 
  | { type: 'transfer'; date: string }
  | { type: 'backlog' }
  | { type: 'completed' }
  | { type: 'skip' }

export interface TaskDecision {
  taskId: number
  taskText: string
  action: TaskAction
}

interface Props {
  tasks: UncompletedTask[]
  currentDate: string
  onComplete: (decisions: TaskDecision[]) => void | Promise<void>
  onCancel: () => void
}

export default function UncompletedTasksModal({ tasks, currentDate, onComplete, onCancel }: Props) {
  const [decisions, setDecisions] = useState<Record<number, TaskAction>>({})
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [customDate, setCustomDate] = useState<Record<number, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const tomorrow = format(addDays(new Date(currentDate), 1), 'yyyy-MM-dd')
  const allResolved = tasks.every(task => decisions[task.id] !== undefined)

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()

    return () => {
      triggerRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const body = document.body
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const previousStyles = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }

    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.overflow = previousStyles.overflow
      body.style.overscrollBehavior = previousStyles.overscrollBehavior
      body.style.position = previousStyles.position
      body.style.top = previousStyles.top
      body.style.width = previousStyles.width
      window.scrollTo(scrollX, scrollY)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isProcessing) return
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('hidden'))

      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isProcessing, onCancel])

  const setAction = (taskId: number, action: TaskAction) => {
    setDecisions(prev => ({ ...prev, [taskId]: action }))
    setExpandedTask(null)
  }

  const handleSubmit = async () => {
    if (!allResolved || isProcessing) return
    const result: TaskDecision[] = tasks.map(task => ({
      taskId: task.id,
      taskText: task.taskText,
      action: decisions[task.id]!,
    }))
    setSubmitError('')
    setIsProcessing(true)
    try {
      await onComplete(result)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось обработать решения. Попробуйте ещё раз.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTransferAll = () => {
    const newDecisions: Record<number, TaskAction> = {}
    tasks.forEach(task => {
      newDecisions[task.id] = { type: 'transfer', date: tomorrow }
    })
    setDecisions(newDecisions)
  }

  const getActionLabel = (action: TaskAction | undefined) => {
    if (!action) return '—'
    switch (action.type) {
      case 'transfer': return `→ ${format(new Date(action.date), 'd MMM', { locale: ru })}`
      case 'backlog': return ' В задачи'
      case 'completed': return ' Выполнено'
      case 'skip': return 'Пропустить'
    }
  }

  return (
    <div
      className="uncompleted-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isProcessing) onCancel()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="uncompleted-modal-title"
        aria-describedby="uncompleted-modal-description"
        aria-busy={isProcessing}
        tabIndex={-1}
        className="uncompleted-modal-panel flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-gray-900/95 shadow-xl outline-none"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start gap-2 border-b border-gray-700 p-3 sm:p-4">
          <div className="min-w-0 flex-1">
          <h2 id="uncompleted-modal-title" className="text-xl font-bold text-white">
             Невыполненные задачи
          </h2>
          <p id="uncompleted-modal-description" className="mt-1 text-sm text-gray-400">
            Что делать с задачами, которые не были выполнены?
          </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl text-gray-400 transition-colors hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Закрыть окно невыполненных задач"
          >
            ×
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex-shrink-0 border-b border-gray-700 bg-gray-700/50 p-3 sm:p-4">
          <button
            type="button"
            onClick={handleTransferAll}
            disabled={isProcessing}
            className="min-h-11 rounded-lg bg-blue-900/30 px-3 py-2 text-blue-300 transition hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
             Все на завтра
          </button>
        </div>

        {/* Task list */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {tasks.map(task => (
            <div 
              key={task.id}
              className="bg-gray-700/50 rounded-lg p-3"
            >
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="break-words text-sm text-white">
                    {task.taskText}
                  </p>
                  {task.transferCount && task.transferCount >= 3 && (
                    <p className="text-xs text-amber-400 mt-1">
                       Переносится {task.transferCount}-й раз. Может разбить на шаги?
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs text-gray-400">
                    {getActionLabel(decisions[task.id])}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const decision = decisions[task.id]
                  const isTransferTomorrow = decision?.type === 'transfer' && decision.date === tomorrow
                  const isTransferOtherDate = decision?.type === 'transfer' && decision.date !== tomorrow
                  return (
                    <>
                       <button
                          type="button"
                          onClick={() => setAction(task.id, { type: 'transfer', date: tomorrow })}
                          disabled={isProcessing}
                         className={`min-h-11 rounded px-3 py-2 text-sm transition sm:text-xs ${isTransferTomorrow ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                         aria-pressed={isTransferTomorrow}
                      >
                         Завтра
                      </button>

                       <button
                          type="button"
                          onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                          disabled={isProcessing}
                         className={`min-h-11 rounded px-3 py-2 text-sm transition sm:text-xs ${isTransferOtherDate ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                         aria-expanded={expandedTask === task.id}
                         aria-controls={`uncompleted-date-${task.id}`}
                      >
                         Другая дата
                      </button>
                    </>
                  )
                })()}

                <button
                  type="button"
                  onClick={() => setAction(task.id, { type: 'backlog' })}
                  disabled={isProcessing}
                  className={`min-h-11 rounded px-3 py-2 text-sm transition sm:text-xs ${ decisions[task.id]?.type === 'backlog' ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  aria-pressed={decisions[task.id]?.type === 'backlog'}
                >
                   В задачи
                </button>

                <button
                  type="button"
                  onClick={() => setAction(task.id, { type: 'completed' })}
                  disabled={isProcessing}
                  className={`min-h-11 rounded px-3 py-2 text-sm transition sm:text-xs ${ decisions[task.id]?.type === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  aria-pressed={decisions[task.id]?.type === 'completed'}
                >
                   Выполнено
                </button>

                <button
                  type="button"
                  onClick={() => setAction(task.id, { type: 'skip' })}
                  disabled={isProcessing}
                  className={`min-h-11 rounded px-3 py-2 text-sm transition sm:text-xs ${ decisions[task.id]?.type === 'skip' ? 'bg-gray-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  aria-pressed={decisions[task.id]?.type === 'skip'}
                >
                  Пропустить
                </button>
              </div>

              {/* Date picker */}
              {expandedTask === task.id && (
                <div id={`uncompleted-date-${task.id}`} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="date"
                    disabled={isProcessing}
                    value={customDate[task.id] || tomorrow}
                    onChange={(e) => setCustomDate(prev => ({ ...prev, [task.id]: e.target.value }))}
                    min={tomorrow}
                    className="min-h-11 min-w-0 rounded border border-gray-700 bg-gray-700 px-2 py-2 text-base text-white sm:text-sm"
                    aria-label={`Дата переноса задачи «${task.taskText}»`}
                  />
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setAction(task.id, { type: 'transfer', date: customDate[task.id] || tomorrow })
                    }}
                    className="min-h-11 rounded bg-blue-500 px-3 py-2 text-sm text-white transition hover:bg-blue-600 sm:text-xs"
                  >
                    Выбрать
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-gray-700 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="sm:order-2 sm:flex-1">
            {isProcessing && <p className="text-sm text-blue-300" role="status" aria-live="polite">Обрабатываем решения…</p>}
            {!isProcessing && submitError && <p className="text-sm text-red-300" role="alert">{submitError}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="min-h-11 rounded-lg px-4 py-2 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
          >
            Отмена
          </button>
          <div className="flex flex-col gap-2 sm:order-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm text-gray-400">
              {Object.keys(decisions).length}/{tasks.length} задач
            </span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!allResolved || isProcessing}
              className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {isProcessing
                ? 'Обработка…'
                : allResolved
                  ? 'Продолжить оценку'
                  : 'Выберите действие для каждой задачи'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
