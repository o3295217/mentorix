'use client'

import { useEffect, useRef, useState } from 'react'
import { format, addDays } from 'date-fns'

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

/** Ключ чипа-переключателя действия для одной задачи. */
export type ChipKey = 'tomorrow' | 'custom' | 'backlog' | 'completed' | 'skip'

/** Текущий выбор действия по одной строке-задаче. */
export interface RowSelection {
  chip: ChipKey
  /** Дата в формате yyyy-MM-dd, актуальна только при chip === 'custom'. */
  customDate?: string
}

export const CHIP_CONFIG: { key: ChipKey; label: string }[] = [
  { key: 'tomorrow', label: 'Завтра' },
  { key: 'custom', label: 'Другая дата' },
  { key: 'backlog', label: 'В задачи' },
  { key: 'completed', label: 'Выполнено' },
  { key: 'skip', label: 'Пропустить' },
]

/** Дефолт для новой строки — «Завтра», чтобы типовой сценарий закрывался одним кликом. */
export function getDefaultRowSelection(): RowSelection {
  return { chip: 'tomorrow' }
}

export function getInitialSelections(tasks: UncompletedTask[]): Record<number, RowSelection> {
  const initial: Record<number, RowSelection> = {}
  tasks.forEach(task => {
    initial[task.id] = getDefaultRowSelection()
  })
  return initial
}

/** «Другая дата» без выбранной даты — невалидный выбор; остальные чипы валидны всегда. */
export function isRowSelectionValid(selection: RowSelection | undefined): boolean {
  if (!selection) return false
  if (selection.chip === 'custom') return Boolean(selection.customDate)
  return true
}

export function areAllSelectionsValid(
  tasks: UncompletedTask[],
  selections: Record<number, RowSelection>,
): boolean {
  return tasks.every(task => isRowSelectionValid(selections[task.id]))
}

export function buildTaskAction(selection: RowSelection, tomorrow: string): TaskAction {
  switch (selection.chip) {
    case 'tomorrow':
      return { type: 'transfer', date: tomorrow }
    case 'custom':
      return { type: 'transfer', date: selection.customDate || tomorrow }
    case 'backlog':
      return { type: 'backlog' }
    case 'completed':
      return { type: 'completed' }
    case 'skip':
      return { type: 'skip' }
  }
}

export function buildDecisions(
  tasks: UncompletedTask[],
  selections: Record<number, RowSelection>,
  tomorrow: string,
): TaskDecision[] {
  return tasks.map(task => ({
    taskId: task.id,
    taskText: task.taskText,
    action: buildTaskAction(selections[task.id] ?? getDefaultRowSelection(), tomorrow),
  }))
}

/** Массовое действие «Все: завтра / в задачи» — сбрасывает выбор всех строк на один чип. */
export function applyBulkChip(
  tasks: UncompletedTask[],
  chip: 'tomorrow' | 'backlog',
): Record<number, RowSelection> {
  const next: Record<number, RowSelection> = {}
  tasks.forEach(task => {
    next[task.id] = { chip }
  })
  return next
}

interface Props {
  tasks: UncompletedTask[]
  currentDate: string
  onComplete: (decisions: TaskDecision[]) => void | Promise<void>
  onCancel: () => void
}

export default function UncompletedTasksModal({ tasks, currentDate, onComplete, onCancel }: Props) {
  const [selections, setSelections] = useState<Record<number, RowSelection>>(() => getInitialSelections(tasks))
  const [isProcessing, setIsProcessing] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const tomorrow = format(addDays(new Date(currentDate), 1), 'yyyy-MM-dd')
  const allValid = areAllSelectionsValid(tasks, selections)

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

  const setRowChip = (taskId: number, chip: ChipKey) => {
    setSelections(prev => {
      const previous = prev[taskId]
      const customDate = chip === 'custom' ? previous?.customDate : undefined
      return { ...prev, [taskId]: { chip, customDate } }
    })
  }

  const setRowCustomDate = (taskId: number, date: string) => {
    setSelections(prev => ({ ...prev, [taskId]: { chip: 'custom', customDate: date } }))
  }

  const handleBulkChip = (chip: 'tomorrow' | 'backlog') => {
    setSelections(applyBulkChip(tasks, chip))
  }

  const handleSubmit = async () => {
    if (!allValid || isProcessing) return
    const result = buildDecisions(tasks, selections, tomorrow)
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
        className="uncompleted-modal-panel flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-gray-900/95 shadow-xl outline-none"
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

        {/* Bulk actions */}
        <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-gray-700 px-3 py-2 text-xs text-gray-400 sm:px-4">
          <span>Все:</span>
          <button
            type="button"
            onClick={() => handleBulkChip('tomorrow')}
            disabled={isProcessing}
            className="rounded text-blue-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            завтра
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => handleBulkChip('backlog')}
            disabled={isProcessing}
            className="rounded text-blue-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            в задачи
          </button>
        </div>

        {/* Task list */}
        <div className="min-h-0 flex-1 divide-y divide-gray-800 overflow-y-auto overscroll-contain px-3 sm:px-4">
          {tasks.map(task => {
            const selection = selections[task.id] ?? getDefaultRowSelection()
            return (
              <div key={task.id} className="py-2.5">
                <p className="break-words text-sm text-gray-100">
                  {task.taskText}
                </p>
                {task.transferCount && task.transferCount >= 3 && (
                  <p className="mt-0.5 text-xs text-amber-400">
                    Переносится {task.transferCount}-й раз. Может разбить на шаги?
                  </p>
                )}

                <div
                  className="mt-1.5 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={`Действие для задачи «${task.taskText}»`}
                >
                  {CHIP_CONFIG.map(chip => {
                    const isSelected = selection.chip === chip.key
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setRowChip(task.id, chip.key)}
                        disabled={isProcessing}
                        aria-pressed={isSelected}
                        className={`rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? 'border-blue-400/50 bg-blue-500/20 text-blue-300'
                            : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>

                {selection.chip === 'custom' && (
                  <div className="mt-1.5">
                    <input
                      type="date"
                      disabled={isProcessing}
                      value={selection.customDate ?? ''}
                      onChange={(e) => setRowCustomDate(task.id, e.target.value)}
                      min={tomorrow}
                      className="min-h-9 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white"
                      aria-label={`Дата переноса задачи «${task.taskText}»`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-gray-700 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="min-h-11 rounded-lg px-4 py-2 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
          >
            Отмена
          </button>
          <div className="sm:order-2 sm:flex-1 sm:px-3">
            {isProcessing && <p className="text-sm text-blue-300" role="status" aria-live="polite">Обрабатываем решения…</p>}
            {!isProcessing && submitError && <p className="text-sm text-red-300" role="alert">{submitError}</p>}
          </div>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!allValid || isProcessing}
            className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:order-3"
          >
            {isProcessing ? 'Обработка…' : `Применить (${tasks.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
