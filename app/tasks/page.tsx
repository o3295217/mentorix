'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { DailyEntry, OpenTask, PaginatedResponse } from '@/lib/types'
import { parseDateParam } from '@/lib/dates'
import { areTasksSimilar } from '@/lib/task-match'
import { expectOk, fetchJson, getFetchErrorMessage } from '@/lib/fetch-json'
import { safeParseJson } from '@/lib/safe-json'

type TaskType = OpenTask['taskType']

interface TaskTone {
  eyebrow: string
  title: string
  description: string
  sectionCountClass: string
  itemClass: string
  badgeClass: string
  accentButtonClass: string
}

const TASK_TONES: Record<TaskType, TaskTone> = {
  strategic: {
    eyebrow: 'Стратегический слой',
    title: 'Стратегические задачи',
    description: 'Длинные ходы и обязательства, которые держат траекторию.',
    sectionCountClass: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200',
    itemClass: 'border-fuchsia-500/15 bg-fuchsia-500/[0.05]',
    badgeClass: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200',
    accentButtonClass: 'text-fuchsia-300 hover:bg-fuchsia-500/10 hover:text-fuchsia-200',
  },
  operational: {
    eyebrow: 'Операционный слой',
    title: 'Операционные задачи',
    description: 'Текущие рабочие дела, договорённости и обязательные хвосты.',
    sectionCountClass: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
    itemClass: 'border-sky-500/15 bg-sky-500/[0.05]',
    badgeClass: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
    accentButtonClass: 'text-sky-300 hover:bg-sky-500/10 hover:text-sky-200',
  },
  personal: {
    eyebrow: 'Входящий список',
    title: 'Входящие задачи',
    description: 'Всё, что ещё не разобрано: личное, рабочее, бытовое и любые хвосты.',
    sectionCountClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    itemClass: 'border-emerald-500/15 bg-emerald-500/[0.05]',
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    accentButtonClass: 'text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200',
  },
}

function formatTaskDate(date: string) {
  return format(parseDateParam(date), 'd MMM yyyy', { locale: ru })
}

function formatPlanStatus(planDate: string, today: string) {
  return planDate === today
    ? 'В плане сегодня'
    : `В плане ${format(parseDateParam(planDate), 'd MMM', { locale: ru })}`
}

function formatTaskWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) return 'задача'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'задачи'
  return 'задач'
}

function getArchiveStatusMeta(status?: OpenTask['archiveStatus']) {
  if (status === 'paused') {
    return {
      cardClass: 'bg-amber-500/[0.05] border-amber-400/15',
      buttonClass: 'text-gray-200 hover:text-white',
      indicatorClass: 'text-amber-200/80',
      lineClass: 'bg-amber-300/25',
      iconClass: 'border-amber-300/30 bg-amber-400/10 text-amber-200',
      label: 'На паузе',
    }
  }

  return {
    cardClass: 'bg-emerald-500/[0.06] border-emerald-400/15',
    buttonClass: 'text-gray-500 hover:text-gray-300',
    indicatorClass: 'text-emerald-200/80',
    lineClass: 'bg-emerald-300/25',
    iconClass: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
    label: 'Выполнено',
  }
}

function SummaryPill({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm backdrop-blur-md ${className || 'border-white/10 bg-white/[0.04] text-gray-200'}`}>
      <span className="font-semibold text-white">{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-4 py-4 text-sm text-gray-600">
      {text}
    </div>
  )
}

type TaskCardState = {
  today: string
  inPlanDate?: string
  tone: TaskTone
  closeRequested: boolean
  deleteRequested: boolean
}

type TaskCardActions = {
  addToPlan: (task: OpenTask) => void
  requestClose: (taskId: number) => void
  cancelClose: () => void
  confirmClose: (taskId: number) => void
  requestDelete: (taskId: number) => void
  cancelDelete: () => void
  confirmDelete: (taskId: number) => void
  saveEdit: (taskId: number, newText: string) => Promise<void>
}

type TaskSectionState = {
  today: string
  tasksInPlan: Record<number, string>
  hideInPlan: boolean
  confirmCloseId: number | null
  confirmDeleteId: number | null
}

function TaskCard({
  task,
  state,
  actions,
}: {
  task: OpenTask
  state: TaskCardState
  actions: TaskCardActions
}) {
  const { today, inPlanDate, tone, closeRequested, deleteRequested } = state
  const { addToPlan, requestClose, cancelClose, confirmClose, requestDelete, cancelDelete, confirmDelete, saveEdit } = actions
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(task.taskText)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === task.taskText) { setIsEditing(false); return }
    setSaving(true)
    await saveEdit(task.id, trimmed)
    setSaving(false)
    setIsEditing(false)
  }

  return (
    <div className={`group animate-fade-in-up rounded-2xl border p-4 ${tone.itemClass}`}>
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {inPlanDate && (
              <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-200">
                {formatPlanStatus(inPlanDate, today)}
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                autoFocus
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
                className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[15px] leading-6 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditText(task.taskText) }}
                  className="rounded-full px-3 py-1 text-xs font-medium text-gray-400 transition hover:text-white"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[15px] leading-6 text-gray-100">{task.taskText}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{formatTaskDate(task.originDate)}</p>

          {closeRequested ? (
            <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs">
              <span className="text-green-200">Закрыть?</span>
              <button onClick={() => confirmClose(task.id)} className="rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-green-500">Да</button>
              <button onClick={cancelClose} className="rounded-full px-1.5 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-white/5">Нет</button>
            </div>
          ) : deleteRequested ? (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs">
              <span className="text-red-200">Удалить?</span>
              <button onClick={() => confirmDelete(task.id)} className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-500">Да</button>
              <button onClick={cancelDelete} className="rounded-full px-1.5 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-white/5">Нет</button>
            </div>
          ) : (
            <div className={`flex items-center gap-1 transition-opacity duration-150 ${isEditing ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
              {!inPlanDate && (
                <button
                  title="В план"
                  onClick={() => addToPlan(task)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-green-500/15 hover:text-green-400"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                    <path d="M5 8h6M8 5v6" />
                  </svg>
                </button>
              )}

              <button
                title="Закрыть задачу"
                onClick={() => requestClose(task.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/8 hover:text-gray-200"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </button>

              <button
                title="Изменить"
                onClick={() => { setIsEditing(true); setEditText(task.taskText) }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-white/8 hover:text-gray-200"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 2.5a1.5 1.5 0 0 1 2.5 1.5L5 13l-3 1 1-3 8.5-8.5Z" />
                </svg>
              </button>

              <button
                title="Удалить"
                onClick={() => requestDelete(task.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-red-500/15 hover:text-red-400"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskSection({
  type,
  tasks,
  totalCount,
  state,
  actions,
  headerContent,
}: {
  type: TaskType
  tasks: OpenTask[]
  totalCount: number
  state: TaskSectionState
  actions: TaskCardActions
  headerContent?: ReactNode
}) {
  const { today, tasksInPlan, hideInPlan, confirmCloseId, confirmDeleteId } = state
  const tone = TASK_TONES[type]
  const hiddenCount = Math.max(totalCount - tasks.length, 0)

  return (
    <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.52),rgba(15,23,42,0.22))] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{tone.eyebrow}</div>
        </div>
        <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tone.sectionCountClass}`}>
          {totalCount} {formatTaskWord(totalCount)}
        </div>
      </div>

      <h2 className="mt-2 text-xl font-semibold text-white">{tone.title}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-400">{tone.description}</p>

      {hideInPlan && hiddenCount > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-500">
          {hiddenCount} {hiddenCount === 1 ? 'уже стоит' : 'уже стоят'} в плане на сегодня и временно скрыт{hiddenCount === 1 ? '' : 'ы'}.
        </div>
      )}

      {headerContent && <div className="mt-4">{headerContent}</div>}

      <div className="mt-5 space-y-3">
        {tasks.length === 0 ? (
          <EmptyState
            text={
              totalCount > 0 && hideInPlan
                ? 'В этом разделе сейчас всё уже раскидано в сегодняшний план.'
                : 'Пока пусто.'
            }
          />
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              state={{
                today,
                inPlanDate: tasksInPlan[task.id],
                tone,
                closeRequested: confirmCloseId === task.id,
                deleteRequested: confirmDeleteId === task.id,
              }}
              actions={actions}
            />
          ))
        )}
      </div>
    </section>
  )
}

function ClosedTaskCard({ task, onReopen }: { task: OpenTask; onReopen: (taskId: number) => void }) {
  const statusMeta = getArchiveStatusMeta(task.archiveStatus)
  const isPaused = task.archiveStatus === 'paused'

  return (
    <div className={`rounded-2xl border p-4 ${statusMeta.cardClass}`}>
      <p className="text-[15px] leading-6 text-gray-300">{task.taskText}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {task.closedAt ? format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru }) : ''}
        </span>
        <div className="flex items-center gap-2">
          <span
            title={statusMeta.label}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${statusMeta.iconClass}`}
          >
            {isPaused ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <rect x="4" y="3" width="3" height="10" rx="1" />
                <rect x="9" y="3" width="3" height="10" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" aria-hidden="true">
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <button
            onClick={() => onReopen(task.id)}
            title="Вернуть в активные"
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition hover:bg-white/10 ${statusMeta.iconClass}`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current" aria-hidden="true">
              <path d="M3 8a5 5 0 1 0 1.5-3.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 4.5V8h3.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function ClosedTaskSection({ type, tasks, onReopen }: { type: TaskType; tasks: OpenTask[]; onReopen: (taskId: number) => void }) {
  const tone = TASK_TONES[type]

  return (
    <section className="rounded-[24px] bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.06))] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-gray-600">Архив</div>
          <h3 className="mt-2 text-base font-semibold text-gray-200">{tone.title}</h3>
        </div>
        <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium opacity-75 ${tone.sectionCountClass}`}>
          {tasks.length}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <EmptyState text="Архив пуст." />
        ) : (
          tasks.map((task) => <ClosedTaskCard key={task.id} task={task} onReopen={onReopen} />)
        )}
      </div>
    </section>
  )
}

export default function TasksPage() {
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([])
  const [closedTasks, setClosedTasks] = useState<OpenTask[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [tasksInPlan, setTasksInPlan] = useState<Record<number, string>>({})
  const [hideInPlan, setHideInPlan] = useState(true)
  const [showDateModal, setShowDateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<OpenTask | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)
  const [newPersonalTask, setNewPersonalTask] = useState('')
  const archiveRef = useRef<HTMLElement>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  const showTaskMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
  }

  const loadTasks = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      const [openData, closedData, daily] = await Promise.all([
        fetchJson<OpenTask[]>('/api/tasks/open'),
        fetchJson<PaginatedResponse<OpenTask>>('/api/tasks/closed?limit=100'),
        fetchJson<DailyEntry | null>(`/api/daily?date=${today}`),
      ])

      setOpenTasks(openData)
      setClosedTasks(closedData.items)

      if (daily && openData.length > 0) {
        const planText = daily?.planText || ''
        const planTasks = planText.split('\n').filter((task: string) => task.trim())

        const extraTasks = safeParseJson<string[]>(daily?.extraTasksJson, [])

        const allPlanTasks = [...planTasks, ...extraTasks]
        const inPlanMap: Record<number, string> = {}

        for (const task of openData) {
          const isInPlan = allPlanTasks.some((planTask: string) => areTasksSimilar(task.taskText, planTask))
          if (isInPlan) {
            inPlanMap[task.id] = today
          }
        }

        setTasksInPlan(inPlanMap)
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
      showTaskMessage(`Ошибка загрузки задач: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    } finally {
      setLoading(false)
    }
  }

  const editTask = async (taskId: number, newText: string) => {
    try {
      const updatedTask = await fetchJson<OpenTask>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskText: newText }),
      })
      setOpenTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...updatedTask } : task))
    } catch (error) {
      console.error('Error editing task:', error)
      showTaskMessage(`Ошибка редактирования: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const closeTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/close`, { method: 'POST' })
      await expectOk(res)

      const closedTask = openTasks.find((task) => task.id === taskId)
      if (closedTask) {
        setOpenTasks((prev) => prev.filter((task) => task.id !== taskId))
        setClosedTasks((prev) => [{ ...closedTask, isClosed: true, archiveStatus: 'completed', closedAt: new Date().toISOString() }, ...prev])
        setTasksInPlan((prev) => {
          const updated = { ...prev }
          delete updated[taskId]
          return updated
        })
        showTaskMessage('Задача закрыта')
      }
    } catch (error) {
      console.error('Error closing task:', error)
      showTaskMessage(`Ошибка закрытия: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const reopenTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/reopen`, { method: 'POST' })
      await expectOk(res)

      const reopenedTask = closedTasks.find((task) => task.id === taskId)
      if (reopenedTask) {
        setClosedTasks((prev) => prev.filter((task) => task.id !== taskId))
        setOpenTasks((prev) => [{ ...reopenedTask, isClosed: false, archiveStatus: null, closedAt: undefined }, ...prev])
        showTaskMessage('Задача возвращена')
      }
    } catch (error) {
      console.error('Error reopening task:', error)
      showTaskMessage(`Ошибка возврата: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const deleteTask = async (taskId: number, isClosed: boolean = false) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/delete`, { method: 'DELETE' })
      await expectOk(res)

      if (isClosed) {
        setClosedTasks((prev) => prev.filter((task) => task.id !== taskId))
      } else {
        setOpenTasks((prev) => prev.filter((task) => task.id !== taskId))
      }

      setTasksInPlan((prev) => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })

      showTaskMessage('Задача удалена')
    } catch (error) {
      console.error('Error deleting task:', error)
      showTaskMessage(`Ошибка удаления: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const openDateModal = (task: OpenTask) => {
    setSelectedTask(task)
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setShowDateModal(true)
  }

  const addToPlan = async () => {
    if (!selectedTask) return

    try {
      const daily = await fetchJson<DailyEntry | null>(`/api/daily?date=${selectedDate}`)
      const currentPlan = daily?.planText || ''
      const planTasks = currentPlan ? currentPlan.split('\n').filter((task: string) => task.trim()) : []

      const currentExtraTasks = safeParseJson<string[]>(daily?.extraTasksJson, [])

      const existsInPlan = planTasks.some((task: string) => areTasksSimilar(task, selectedTask.taskText))
      const existsInExtra = currentExtraTasks.some((task) => areTasksSimilar(task, selectedTask.taskText))

      if (existsInPlan || existsInExtra) {
        showTaskMessage('Похожая задача уже есть в плане на этот день')
        setShowDateModal(false)
        return
      }

      const newPlanText = currentPlan ? `${currentPlan}\n${selectedTask.taskText}` : selectedTask.taskText

      await fetchJson<DailyEntry>('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          planText: newPlanText,
        }),
      })

      setTasksInPlan((prev) => ({ ...prev, [selectedTask.id]: selectedDate }))

      const dateLabel = selectedDate === format(new Date(), 'yyyy-MM-dd')
        ? 'сегодня'
        : format(parseDateParam(selectedDate), 'd MMM', { locale: ru })

      showTaskMessage(`Добавлено в план на ${dateLabel}`)
      setShowDateModal(false)
    } catch (error) {
      console.error('Error adding task to plan:', error)
      showTaskMessage(`Ошибка при добавлении в план: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const addIncomingTask = async () => {
    const text = newPersonalTask.trim()
    if (!text) return

    try {
      const newTask = await fetchJson<OpenTask>('/api/tasks/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskText: text,
          taskType: 'personal',
          originDate: format(new Date(), 'yyyy-MM-dd'),
        }),
      })

      setOpenTasks((prev) => [newTask, ...prev])
      setNewPersonalTask('')
      showTaskMessage('Задача добавлена')
    } catch (error) {
      console.error('Error adding task:', error)
      showTaskMessage(`Ошибка при добавлении задачи: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    }
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const inPlanTodayCount = Object.values(tasksInPlan).filter((date) => date === today).length
  const filteredOpen = hideInPlan ? openTasks.filter((task) => tasksInPlan[task.id] !== today) : openTasks

  const strategicTotal = openTasks.filter((task) => task.taskType === 'strategic')
  const operationalTotal = openTasks.filter((task) => task.taskType === 'operational')
  const personalTotal = openTasks.filter((task) => task.taskType === 'personal')

  const strategicOpen = filteredOpen.filter((task) => task.taskType === 'strategic')
  const operationalOpen = filteredOpen.filter((task) => task.taskType === 'operational')
  const personalOpen = filteredOpen.filter((task) => task.taskType === 'personal')

  const strategicClosed = closedTasks.filter((task) => task.taskType === 'strategic')
  const operationalClosed = closedTasks.filter((task) => task.taskType === 'operational')
  const personalClosed = closedTasks.filter((task) => task.taskType === 'personal')

  const taskSectionState: TaskSectionState = {
    today,
    tasksInPlan,
    hideInPlan,
    confirmCloseId,
    confirmDeleteId,
  }

  const taskSectionActions: TaskCardActions = {
    addToPlan: openDateModal,
    requestClose: setConfirmCloseId,
    cancelClose: () => setConfirmCloseId(null),
    confirmClose: (taskId) => {
      closeTask(taskId)
      setConfirmCloseId(null)
    },
    requestDelete: setConfirmDeleteId,
    cancelDelete: () => setConfirmDeleteId(null),
    confirmDelete: (taskId) => {
      deleteTask(taskId)
      setConfirmDeleteId(null)
    },
    saveEdit: editTask,
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-lg text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1 opacity-40" />
        <div className="landing-orb landing-orb-2 opacity-35" />
        <div className="landing-orb landing-orb-3 opacity-30" />
        <div className="absolute inset-0 landing-grid opacity-[0.03]" />
      </div>

      <div className="relative z-10 space-y-5">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.58),rgba(15,23,42,0.22))] p-5 backdrop-blur-md sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Контур задач</div>
              <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
                <h1 className="text-3xl font-semibold tracking-tight text-white">Задачи</h1>
                <div className="flex flex-wrap gap-2">
                  <SummaryPill label="открыто" value={openTasks.length} />
                  <SummaryPill label="стратегических" value={strategicTotal.length} className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200" />
                  <SummaryPill label="операционных" value={operationalTotal.length} className="border-sky-500/20 bg-sky-500/10 text-sky-200" />
                  <SummaryPill label="входящих" value={personalTotal.length} className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200" />
                  {inPlanTodayCount > 0 && (
                    <button
                      onClick={() => setHideInPlan((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 transition hover:bg-sky-500/20"
                    >
                      {hideInPlan ? `в плане ${inPlanTodayCount}` : `показаны ${inPlanTodayCount} из плана`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {closedTasks.length > 0 && (
                <button
                  onClick={() => {
                    const opening = !showClosed
                    setShowClosed(opening)
                    if (opening) {
                      setTimeout(() => archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }
                  }}
                  className="text-sm font-medium text-gray-400 transition hover:text-white"
                >
                  {showClosed ? `Скрыть архив (${closedTasks.length})` : `Показать архив (${closedTasks.length})`}
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Здесь держится весь незакрытый контур: входящие задачи, стратегические обязательства и операционные хвосты, пока они не разложены по дням или не закрыты.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[0.8fr_1fr_1.35fr]">
            <TaskSection
              type="personal"
              tasks={personalOpen}
              totalCount={personalTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
              headerContent={
                <div className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={newPersonalTask}
                      onChange={(event) => setNewPersonalTask(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && addIncomingTask()}
                      placeholder="Что нужно не забыть?"
                      className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={addIncomingTask}
                      disabled={!newPersonalTask.trim()}
                      className="self-start rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              }
            />

            <TaskSection
              type="strategic"
              tasks={strategicOpen}
              totalCount={strategicTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
            />

            <TaskSection
              type="operational"
              tasks={operationalOpen}
              totalCount={operationalTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
            />
        </div>

        {filteredOpen.length === 0 && openTasks.length > 0 && hideInPlan && (
          <section className="rounded-[26px] border border-sky-500/15 bg-sky-500/[0.05] px-5 py-6 text-sm text-sky-100 backdrop-blur-md">
            Все открытые задачи уже стоят в плане на сегодня. Можно временно показать их кнопкой в хедере.
          </section>
        )}

        {closedTasks.length > 0 && showClosed && (
          <section ref={archiveRef} className="animate-fade-in-up rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.32),rgba(15,23,42,0.12))] p-5 backdrop-blur-md sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-gray-600">Архив</div>
                <h2 className="mt-2 text-xl font-semibold text-gray-200">Закрытые задачи</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">Здесь лежат закрытые задачи. Выполненные подсвечены мягким зелёным, и любую можно вернуть обратно в активный контур.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="inline-flex items-center rounded-full bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-300">
                  {closedTasks.length} в архиве
                </div>
                <button
                  onClick={() => setShowClosed(false)}
                  className="text-sm font-medium text-gray-500 transition hover:text-white"
                >
                  Скрыть архив
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 items-start xl:grid-cols-3">
              <ClosedTaskSection type="strategic" tasks={strategicClosed} onReopen={reopenTask} />
              <ClosedTaskSection type="operational" tasks={operationalClosed} onReopen={reopenTask} />
              <ClosedTaskSection type="personal" tasks={personalClosed} onReopen={reopenTask} />
            </div>
          </section>
        )}

        {message && (
          <div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-gray-700 bg-gray-900/90 p-4 shadow-lg backdrop-blur-sm">
            <p className="font-medium text-gray-100">{message}</p>
          </div>
        )}

        {showDateModal && selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-sm rounded-[28px] border border-gray-800 bg-gray-900/95 p-6 shadow-2xl">
              <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Планирование</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Добавить в план</h3>

              <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">
                {selectedTask.taskText}
              </p>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-gray-300">На какой день?</label>

                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      selectedDate === format(new Date(), 'yyyy-MM-dd')
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Сегодня
                  </button>
                  <button
                    onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Завтра
                  </button>
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowDateModal(false)}
                  className="flex-1 rounded-xl border border-gray-700 px-4 py-2 text-gray-300 transition hover:bg-gray-800"
                >
                  Отмена
                </button>
                <button
                  onClick={addToPlan}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-2 text-white transition hover:bg-green-500"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
