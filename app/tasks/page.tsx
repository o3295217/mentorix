'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { DailyEntry, OpenTask, PaginatedResponse } from '@/lib/types'
import { parseDateParam } from '@/lib/dates'
import { areTasksSimilar } from '@/lib/task-match'
import { expectOk, fetchJson, getFetchErrorMessage } from '@/lib/fetch-json'
import { safeParseJson } from '@/lib/safe-json'
import { formatCarriedFrom } from '@/lib/carryover'

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

// Тон секции «Задачи прошлого месяца» — задачи, пришедшие из незакрытых целей
const CARRIED_TONE: TaskTone = {
  eyebrow: 'Хвосты периода',
  title: 'Задачи прошлого месяца',
  description: 'Незакрытые цели прошлого месяца, отправленные в задачи при ревизии.',
  sectionCountClass: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  itemClass: 'border-amber-500/15 bg-amber-500/[0.05]',
  badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  accentButtonClass: 'text-amber-300 hover:bg-amber-500/10 hover:text-amber-200',
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
    <div className={`inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border px-3 py-1.5 text-sm backdrop-blur-md ${className || 'border-white/10 bg-white/[0.04] text-gray-200'}`}>
      <span className="font-semibold text-white">{value}</span>
      <span className="break-words text-gray-400">{label}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="break-words rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-gray-500">
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
  saveEdit: (taskId: number, newText: string) => Promise<boolean>
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
  const savingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleSave = async () => {
    if (savingRef.current) return
    const trimmed = editText.trim()
    if (!trimmed || trimmed === task.taskText) { setIsEditing(false); return }
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await saveEdit(task.id, trimmed)
      if (saved && mountedRef.current) setIsEditing(false)
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  return (
    <div className={`group animate-fade-in-up min-w-0 rounded-2xl border p-3 sm:p-4 ${tone.itemClass}`}>
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {inPlanDate && (
              <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium leading-5 text-green-200 [overflow-wrap:anywhere]">
                {formatPlanStatus(inPlanDate, today)}
              </span>
            )}
            {task.carriedFromMonth && (
              <span className={`inline-flex max-w-full items-center whitespace-normal break-words rounded-full border px-2.5 py-1 text-[11px] font-medium leading-5 [overflow-wrap:anywhere] ${tone.badgeClass}`}>
                {formatCarriedFrom(task.carriedFromMonth)}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void handleSave()
                  }
                }}
                aria-label={`Текст задачи «${task.taskText}»`}
                className="max-h-56 min-h-24 w-full resize-y rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-base leading-6 text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:text-[15px]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setEditText(task.taskText) }}
                  disabled={saving}
                  className="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 break-words text-[15px] leading-6 text-gray-100 [overflow-wrap:anywhere]">{task.taskText}</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          <p className="shrink-0 text-sm text-gray-500">{formatTaskDate(task.originDate)}</p>

          {closeRequested ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 p-2 text-sm sm:w-auto lg:w-full xl:w-auto">
              <span className="mr-auto min-w-0 break-words text-green-200">Закрыть задачу?</span>
              <button type="button" aria-label="Да, закрыть задачу" onClick={() => confirmClose(task.id)} className="min-h-11 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300">Да, закрыть</button>
              <button type="button" aria-label="Нет, не закрывать задачу" onClick={cancelClose} className="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">Нет</button>
            </div>
          ) : deleteRequested ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-2 text-sm sm:w-auto lg:w-full xl:w-auto">
              <span className="mr-auto min-w-0 break-words text-red-200">Удалить задачу?</span>
              <button type="button" aria-label="Да, удалить задачу" onClick={() => confirmDelete(task.id)} className="min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Да, удалить</button>
              <button type="button" aria-label="Нет, не удалять задачу" onClick={cancelDelete} className="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">Нет</button>
            </div>
          ) : (
            !isEditing && <div className="task-card-actions flex flex-wrap items-center justify-end gap-1">
              {!inPlanDate && (
                <button
                  type="button"
                  title="В план"
                  aria-label={`Добавить задачу «${task.taskText}» в план`}
                  onClick={() => addToPlan(task)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-green-500/15 hover:text-green-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                    <path d="M5 8h6M8 5v6" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                title="Закрыть задачу"
                aria-label={`Закрыть задачу «${task.taskText}»`}
                onClick={() => requestClose(task.id)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/8 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              </button>

              <button
                type="button"
                title="Изменить"
                aria-label={`Изменить задачу «${task.taskText}»`}
                onClick={() => { setIsEditing(true); setEditText(task.taskText) }}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white/8 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 2.5a1.5 1.5 0 0 1 2.5 1.5L5 13l-3 1 1-3 8.5-8.5Z" />
                </svg>
              </button>

              <button
                type="button"
                title="Удалить"
                aria-label={`Удалить задачу «${task.taskText}»`}
                onClick={() => requestDelete(task.id)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
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
  tone,
  tasks,
  totalCount,
  state,
  actions,
  headerContent,
}: {
  tone: TaskTone
  tasks: OpenTask[]
  totalCount: number
  state: TaskSectionState
  actions: TaskCardActions
  headerContent?: ReactNode
}) {
  const { today, tasksInPlan, hideInPlan, confirmCloseId, confirmDeleteId } = state
  const hiddenCount = Math.max(totalCount - tasks.length, 0)

  return (
    <section className="min-w-0 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.52),rgba(15,23,42,0.22))] p-3 backdrop-blur-md sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{tone.eyebrow}</div>
        </div>
        <div className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${tone.sectionCountClass}`}>
          {totalCount} {formatTaskWord(totalCount)}
        </div>
      </div>

      <h2 className="mt-2 break-words text-xl font-semibold text-white">{tone.title}</h2>
      <p className="mt-1 break-words text-sm leading-6 text-gray-400">{tone.description}</p>

      {hideInPlan && hiddenCount > 0 && (
        <div className="mt-4 break-words rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-gray-500 sm:px-4">
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
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${statusMeta.cardClass}`}>
      <p className="break-words text-[15px] leading-6 text-gray-300 [overflow-wrap:anywhere]">{task.taskText}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-gray-500">
          {task.closedAt ? format(new Date(task.closedAt), 'd MMM yyyy', { locale: ru }) : ''}
        </span>
        <div className="flex items-center gap-2">
          <span
            title={statusMeta.label}
            role="img"
            aria-label={statusMeta.label}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${statusMeta.iconClass}`}
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
            type="button"
            onClick={() => onReopen(task.id)}
            title="Вернуть в активные"
            aria-label={`Вернуть задачу «${task.taskText}» в активные`}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${statusMeta.iconClass}`}
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
    <section className="min-w-0 rounded-[24px] bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.06))] p-3 backdrop-blur-md sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.18em] text-gray-600">Архив</div>
          <h3 className="mt-2 break-words text-base font-semibold text-gray-200">{tone.title}</h3>
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
  const [isAddingToPlan, setIsAddingToPlan] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmCloseId, setConfirmCloseId] = useState<number | null>(null)
  const [newPersonalTask, setNewPersonalTask] = useState('')
  const archiveRef = useRef<HTMLElement>(null)
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const archiveScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dateDialogRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dateModalReturnFocusRef = useRef<HTMLElement | null>(null)
  const pageFocusFallbackRef = useRef<HTMLHeadingElement>(null)
  const addToPlanSubmittingRef = useRef(false)
  const dateModalSessionRef = useRef(0)
  const dateModalOpenRef = useRef(false)

  const closeDateModal = useCallback(() => {
    dateModalSessionRef.current += 1
    dateModalOpenRef.current = false
    setShowDateModal(false)
    setSelectedTask(null)
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setIsAddingToPlan(false)
  }, [])

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => () => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    if (archiveScrollTimerRef.current) clearTimeout(archiveScrollTimerRef.current)
  }, [])

  useEffect(() => {
    if (!showDateModal) return

    const body = document.body
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const returnFocusTarget = dateModalReturnFocusRef.current
    const fallbackFocusTarget = pageFocusFallbackRef.current
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

    const focusFrame = window.requestAnimationFrame(() => {
      dateInputRef.current?.focus()
      if (!dateInputRef.current) dateDialogRef.current?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDateModal()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousStyles.overflow
      body.style.overscrollBehavior = previousStyles.overscrollBehavior
      body.style.position = previousStyles.position
      body.style.top = previousStyles.top
      body.style.width = previousStyles.width
      window.scrollTo(scrollX, scrollY)
      const focusTarget = returnFocusTarget?.isConnected
        ? returnFocusTarget
        : fallbackFocusTarget
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true })
    }
  }, [closeDateModal, showDateModal])

  const showTaskMessage = (text: string) => {
    setMessage(text)
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    messageTimerRef.current = setTimeout(() => {
      setMessage('')
      messageTimerRef.current = null
    }, 3000)
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

  const editTask = async (taskId: number, newText: string): Promise<boolean> => {
    try {
      const updatedTask = await fetchJson<OpenTask>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskText: newText }),
      })
      setOpenTasks((prev) => prev.map((task) => task.id === taskId ? { ...task, ...updatedTask } : task))
      return true
    } catch (error) {
      console.error('Error editing task:', error)
      showTaskMessage(`Ошибка редактирования: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
      return false
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
    dateModalSessionRef.current += 1
    dateModalOpenRef.current = true
    dateModalReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setSelectedTask(task)
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    setIsAddingToPlan(addToPlanSubmittingRef.current)
    setShowDateModal(true)
  }

  const addToPlan = async () => {
    if (!selectedTask || addToPlanSubmittingRef.current) return
    const modalSession = dateModalSessionRef.current
    addToPlanSubmittingRef.current = true
    setIsAddingToPlan(true)

    try {
      const daily = await fetchJson<DailyEntry | null>(`/api/daily?date=${selectedDate}`)
      const currentPlan = daily?.planText || ''
      const planTasks = currentPlan ? currentPlan.split('\n').filter((task: string) => task.trim()) : []

      const currentExtraTasks = safeParseJson<string[]>(daily?.extraTasksJson, [])

      const existsInPlan = planTasks.some((task: string) => areTasksSimilar(task, selectedTask.taskText))
      const existsInExtra = currentExtraTasks.some((task) => areTasksSimilar(task, selectedTask.taskText))

      if (existsInPlan || existsInExtra) {
        showTaskMessage('Похожая задача уже есть в плане на этот день')
        if (dateModalSessionRef.current === modalSession) closeDateModal()
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
      if (dateModalSessionRef.current === modalSession) {
        closeDateModal()
      } else if (!dateModalOpenRef.current) {
        const fallbackFocusTarget = pageFocusFallbackRef.current
        if (fallbackFocusTarget?.isConnected) fallbackFocusTarget.focus({ preventScroll: true })
      }
    } catch (error) {
      console.error('Error adding task to plan:', error)
      showTaskMessage(`Ошибка при добавлении в план: ${getFetchErrorMessage(error, 'ошибка запроса')}`)
    } finally {
      addToPlanSubmittingRef.current = false
      setIsAddingToPlan(false)
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

  // Задачи из незакрытых целей прошлого месяца живут в собственной секции
  const carriedTotal = openTasks.filter((task) => task.carriedFromMonth)
  const carriedOpen = filteredOpen.filter((task) => task.carriedFromMonth)

  const strategicTotal = openTasks.filter((task) => task.taskType === 'strategic' && !task.carriedFromMonth)
  const operationalTotal = openTasks.filter((task) => task.taskType === 'operational' && !task.carriedFromMonth)
  const personalTotal = openTasks.filter((task) => task.taskType === 'personal' && !task.carriedFromMonth)

  const strategicOpen = filteredOpen.filter((task) => task.taskType === 'strategic' && !task.carriedFromMonth)
  const operationalOpen = filteredOpen.filter((task) => task.taskType === 'operational' && !task.carriedFromMonth)
  const personalOpen = filteredOpen.filter((task) => task.taskType === 'personal' && !task.carriedFromMonth)

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
    requestClose: (taskId) => {
      setConfirmDeleteId(null)
      setConfirmCloseId(taskId)
    },
    cancelClose: () => setConfirmCloseId(null),
    confirmClose: (taskId) => {
      closeTask(taskId)
      setConfirmCloseId(null)
    },
    requestDelete: (taskId) => {
      setConfirmCloseId(null)
      setConfirmDeleteId(taskId)
    },
    cancelDelete: () => setConfirmDeleteId(null),
    confirmDelete: (taskId) => {
      deleteTask(taskId)
      setConfirmDeleteId(null)
    },
    saveEdit: editTask,
  }

  if (loading) {
    return (
      <div className="flex min-h-[min(400px,60dvh)] items-center justify-center px-4 text-center" role="status" aria-live="polite">
        <div className="text-base text-gray-400 sm:text-lg">Загрузка задач…</div>
      </div>
    )
  }

  return (
    <>
    <div className="relative isolate overflow-hidden rounded-[32px]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1 opacity-40" />
        <div className="landing-orb landing-orb-2 opacity-35" />
        <div className="landing-orb landing-orb-3 opacity-30" />
        <div className="absolute inset-0 landing-grid opacity-[0.03]" />
      </div>

      <div className="relative z-10 space-y-5">
        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.58),rgba(15,23,42,0.22))] p-5 backdrop-blur-md sm:p-6">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.22em] text-gray-500">Контур задач</div>
              <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
                <h1 ref={pageFocusFallbackRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-white outline-none sm:text-3xl">Задачи</h1>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <SummaryPill label="открыто" value={openTasks.length} />
                  <SummaryPill label="стратегических" value={strategicTotal.length} className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200" />
                  <SummaryPill label="операционных" value={operationalTotal.length} className="border-sky-500/20 bg-sky-500/10 text-sky-200" />
                  <SummaryPill label="входящих" value={personalTotal.length} className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200" />
                  {inPlanTodayCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setHideInPlan((prev) => !prev)}
                      aria-pressed={hideInPlan}
                      aria-controls="open-task-sections"
                      className="inline-flex min-h-11 max-w-full items-center whitespace-normal break-words rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-left text-sm leading-5 text-sky-200 transition hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:min-h-0 sm:py-1.5"
                    >
                      {hideInPlan ? `в плане ${inPlanTodayCount}` : `показаны ${inPlanTodayCount} из плана`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
              {closedTasks.length > 0 && (
                <button
                  type="button"
                  aria-expanded={showClosed}
                  aria-controls={showClosed ? 'tasks-archive' : undefined}
                  onClick={() => {
                    const opening = !showClosed
                    setShowClosed(opening)
                    if (archiveScrollTimerRef.current) {
                      clearTimeout(archiveScrollTimerRef.current)
                      archiveScrollTimerRef.current = null
                    }
                    if (opening) {
                      archiveScrollTimerRef.current = setTimeout(() => {
                        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        archiveRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
                        archiveScrollTimerRef.current = null
                      }, 50)
                    }
                  }}
                  className="min-h-11 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  {showClosed ? `Скрыть архив (${closedTasks.length})` : `Показать архив (${closedTasks.length})`}
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 break-words text-sm leading-6 text-gray-400">
            Здесь держится весь незакрытый контур: входящие задачи, стратегические обязательства и операционные хвосты, пока они не разложены по дням или не закрыты.
          </p>
        </section>

        {carriedTotal.length > 0 && (
          <TaskSection
            tone={CARRIED_TONE}
            tasks={carriedOpen}
            totalCount={carriedTotal.length}
            state={taskSectionState}
            actions={taskSectionActions}
          />
        )}

        <div id="open-task-sections" className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[0.8fr_1fr_1.35fr]">
            <TaskSection
              tone={TASK_TONES.personal}
              tasks={personalOpen}
              totalCount={personalTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
              headerContent={
                <div className="space-y-3">
                   <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch lg:flex-col xl:flex-row">
                     <input
                      type="text"
                      value={newPersonalTask}
                      onChange={(event) => setNewPersonalTask(event.target.value)}
                       onKeyDown={(event) => event.key === 'Enter' && addIncomingTask()}
                       placeholder="Что нужно не забыть?"
                       aria-label="Новая входящая задача"
                       className="min-h-11 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-gray-100 placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-1"
                     />
                     <button
                       type="button"
                       onClick={addIncomingTask}
                       disabled={!newPersonalTask.trim()}
                       className="min-h-11 w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto lg:w-full xl:w-auto"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              }
            />

            <TaskSection
              tone={TASK_TONES.strategic}
              tasks={strategicOpen}
              totalCount={strategicTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
            />

            <TaskSection
              tone={TASK_TONES.operational}
              tasks={operationalOpen}
              totalCount={operationalTotal.length}
              state={taskSectionState}
              actions={taskSectionActions}
            />
        </div>

        {filteredOpen.length === 0 && openTasks.length > 0 && hideInPlan && (
          <section className="break-words rounded-[26px] border border-sky-500/15 bg-sky-500/[0.05] px-4 py-5 text-sm leading-6 text-sky-100 backdrop-blur-md sm:px-5 sm:py-6">
            Все открытые задачи уже стоят в плане на сегодня. Можно временно показать их кнопкой в хедере.
          </section>
        )}

        {closedTasks.length > 0 && showClosed && (
          <section id="tasks-archive" ref={archiveRef} className="animate-fade-in-up min-w-0 scroll-mt-20 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.32),rgba(15,23,42,0.12))] p-3 backdrop-blur-md sm:p-6">
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-600">Архив</div>
                <h2 className="mt-2 text-xl font-semibold text-gray-200">Закрытые задачи</h2>
                <p className="mt-2 break-words text-sm leading-6 text-gray-500">Здесь лежат закрытые задачи. Выполненные подсвечены мягким зелёным, и любую можно вернуть обратно в активный контур.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                <div className="inline-flex min-h-11 items-center rounded-full bg-white/[0.03] px-4 py-2 text-sm font-medium text-gray-300 sm:min-h-0">
                  {closedTasks.length} в архиве
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (archiveScrollTimerRef.current) {
                      clearTimeout(archiveScrollTimerRef.current)
                      archiveScrollTimerRef.current = null
                    }
                    setShowClosed(false)
                  }}
                  aria-expanded={true}
                  aria-controls="tasks-archive"
                  className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
          <div role="status" aria-live="polite" className="app-fixed-status fixed z-50 rounded-2xl border border-gray-700 bg-gray-900/90 p-4 shadow-lg backdrop-blur-sm">
            <p className="font-medium text-gray-100">{message}</p>
          </div>
        )}
      </div>
    </div>

        {showDateModal && selectedTask && (
          <div
            className="task-date-modal-backdrop pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeDateModal()
            }}
          >
            <div
              ref={dateDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-date-modal-title"
              aria-describedby="task-date-modal-description"
              tabIndex={-1}
              className="task-date-modal-panel flex w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-gray-800 bg-gray-900/95 shadow-2xl outline-none"
            >
              <header className="shrink-0 border-b border-gray-800 px-4 py-4 sm:px-6">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Планирование</div>
                <h2 id="task-date-modal-title" className="mt-2 text-xl font-semibold text-white">Добавить в план</h2>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                <p id="task-date-modal-description" className="break-words text-sm leading-6 text-gray-400 [overflow-wrap:anywhere]">
                  Выберите день для задачи: {selectedTask.taskText}
                </p>

                <div className="mt-5">
                  <label htmlFor="task-plan-date" className="mb-2 block text-sm font-medium text-gray-300">На какой день?</label>

                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                      aria-pressed={selectedDate === format(new Date(), 'yyyy-MM-dd')}
                      className={`min-h-11 min-w-0 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
                        selectedDate === format(new Date(), 'yyyy-MM-dd')
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      Сегодня
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
                      aria-pressed={selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      className={`min-h-11 min-w-0 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 ${
                        selectedDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      Завтра
                    </button>
                  </div>

                  <input
                    ref={dateInputRef}
                    id="task-plan-date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  />
                </div>
              </div>

              <footer className="grid shrink-0 grid-cols-1 gap-2 border-t border-gray-800 px-4 py-4 sm:grid-cols-2 sm:px-6">
                <button
                  type="button"
                  onClick={closeDateModal}
                  className="min-h-11 rounded-xl border border-gray-700 px-4 py-2 text-gray-300 transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={addToPlan}
                  disabled={isAddingToPlan}
                  className="min-h-11 rounded-xl bg-green-600 px-4 py-2 text-white transition hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAddingToPlan ? 'Добавление…' : 'Добавить'}
                </button>
              </footer>
            </div>
          </div>
        )}
    </>
  )
}
