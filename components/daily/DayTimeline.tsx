'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DailySchedule } from '@/lib/daily-schedule'
import type { OpenTask } from '@/lib/types'
import {
  type BlockInput,
  MIN_BLOCK_DURATION_MINUTES,
  SCHEDULE_INTERACTION_STEP_MINUTES,
  computeClientScheduleLoadSummary,
  formatDurationLabel,
  getBlockDisplayTitle,
  getScheduleBoundaryMinutes,
  getScheduleBlockCategory,
  isTaskScheduleBlock,
  minutesToTimeInputValue,
  minutesToTimeLabel,
  snapToStep,
  timeLabelToMinutes,
} from '@/hooks/daily/schedule-helpers'

const PX_PER_MIN = 3 // 15-min block ≈ 45px (≥44px touch target)
const DEFAULT_UNSCHEDULED_DURATION_MINUTES = 30

export function getScheduleBlockRenderKey(blockId: string, appliedAnimationKey: number): string {
  return appliedAnimationKey > 0 ? `${appliedAnimationKey}:${blockId}` : blockId
}

export function canMutateTimeline(mutationLocked: boolean): boolean {
  return !mutationLocked
}

export function isTaskHighlighted(block: BlockInput, highlightedTaskIndexes: ReadonlySet<number>): boolean {
  return isTaskScheduleBlock(block) && highlightedTaskIndexes.has(block.taskIndex)
}

export function shouldCommitPointerDrag(eventType: 'up' | 'cancel', moved: boolean, mutationLocked: boolean): boolean {
  return eventType === 'up' && moved && !mutationLocked
}

export function shouldStartTimelinePointerDrag(pointerType: string, startedFromTouchHandle: boolean): boolean {
  return pointerType !== 'touch' || startedFromTouchHandle
}

export function getTimelinePointerPreviewRange(
  originalStart: number,
  originalDuration: number,
  deltaPixels: number,
  mode: DragMode,
  dayStart: number,
  dayEnd: number,
  pxPerMinute: number = PX_PER_MIN,
): { startMinutes: number; durationMinutes: number } {
  const deltaMin = snapToStep(deltaPixels / pxPerMinute)
  if (mode === 'resize') {
    const maxDuration = Math.max(0, dayEnd - originalStart)
    const requestedDuration = snapToStep(originalDuration + deltaMin)
    const duration = Math.min(Math.max(MIN_BLOCK_DURATION_MINUTES, requestedDuration), maxDuration)
    return { startMinutes: originalStart, durationMinutes: duration }
  }
  const requestedStart = originalStart + deltaMin
  const duration = Math.min(Math.max(MIN_BLOCK_DURATION_MINUTES, snapToStep(originalDuration)), Math.max(MIN_BLOCK_DURATION_MINUTES, dayEnd - dayStart))
  const start = Math.min(Math.max(dayStart, snapToStep(requestedStart)), Math.max(dayStart, dayEnd - duration))
  return { startMinutes: start, durationMinutes: Math.min(duration, dayEnd - start) }
}

export function getDropStartMinutesFromClientY(
  clientY: number,
  timelineTop: number,
  dayStart: number,
  dayEnd: number,
  durationMinutes: number = DEFAULT_UNSCHEDULED_DURATION_MINUTES,
  pxPerMinute: number = PX_PER_MIN,
): number {
  const rawMinutes = dayStart + (clientY - timelineTop) / pxPerMinute
  const snapped = snapToStep(rawMinutes)
  return Math.min(Math.max(dayStart, snapped), Math.max(dayStart, dayEnd - durationMinutes))
}

export function getTimelineBoundaryPills(schedule: DailySchedule): string[] {
  const boundaries = getScheduleBoundaryMinutes(schedule)
  return [
    `План ${minutesToTimeLabel(boundaries.planningStartMinutes)}`,
    `Работа до ${minutesToTimeLabel(boundaries.workEndMinutes)}`,
    `Активность до ${minutesToTimeLabel(boundaries.activityEndMinutes)}`,
  ]
}

export function getTimelineAxisMarkerLabels(): string[] {
  return []
}

export function getCompressedTimelineWindow(schedule: DailySchedule, showFullDay: boolean): { startMinutes: number; endMinutes: number; isCompressed: boolean } {
  if (showFullDay || schedule.blocks.length > 0) {
    return { startMinutes: schedule.dayStartMinutes, endMinutes: schedule.dayEndMinutes, isCompressed: false }
  }
  const boundaries = getScheduleBoundaryMinutes(schedule)
  const startMinutes = Math.max(schedule.dayStartMinutes, boundaries.planningStartMinutes)
  const endMinutes = Math.min(schedule.dayEndMinutes, boundaries.workEndMinutes)
  return {
    startMinutes,
    endMinutes: Math.max(endMinutes, startMinutes + 180),
    isCompressed: true,
  }
}

export function isCurrentTimeLineVisible(selectedDate: string, now: Date, startMinutes: number, endMinutes: number): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const minutes = now.getHours() * 60 + now.getMinutes()
  return selectedDate === today && minutes >= startMinutes && minutes <= endMinutes
}

export function getTimelineViewportHeight(totalHeight: number, isCompressed: boolean, maxHeight = 560): number {
  const compactMaxHeight = 520
  return Math.max(240, Math.min(totalHeight, isCompressed ? compactMaxHeight : maxHeight))
}

export function getUnscheduledTrayViewConfig(): { defaultDurationMinutes: number; showsDurationControls: boolean; hint: string; chipItemClassName: string; chipButtonClassIncludes: string[]; emptyCanvasText: string | null } {
  return {
    defaultDurationMinutes: DEFAULT_UNSCHEDULED_DURATION_MINUTES,
    showsDurationControls: false,
    hint: 'Перетащите задачу на шкалу',
    chipItemClassName: 'w-[min(76vw,240px)] flex-shrink-0 md:w-[240px]',
    chipButtonClassIncludes: ['w-full', 'cursor-grab', 'active:cursor-grabbing', 'disabled:cursor-not-allowed'],
    emptyCanvasText: null,
  }
}

export interface DayTimelineProps {
  schedule: DailySchedule
  tasks: OpenTask[]
  selectedTasks: Set<number>
  unscheduledTaskIndexes: number[]
  isSaving: boolean
  isDirty: boolean
  error: string
  onSetBlockRange: (blockId: string, startMinutes: number, durationMinutes: number) => void
  onMoveBlock: (blockId: string, deltaMinutes: number) => void
  onRemoveBlock: (blockId: string) => void
  onScheduleUnscheduled: (taskIndex: number, startMinutes?: number, durationMinutes?: number) => void
  appliedAnimationKey?: number
  highlightedTaskIndexes?: Set<number>
  mutationLocked?: boolean
  selectedDate: string
  onToggleTask: (taskId: number) => void
}

export type DragMode = 'move' | 'resize'

interface DragState {
  mode: DragMode
  pointerId: number
  startY: number
  originalStart: number
  originalDuration: number
  moved: boolean
}

type PreviewRange = { startMinutes: number; durationMinutes: number } | null
type DropPreview = { taskIndex: number; startMinutes: number } | null

const categoryLabels = {
  main: 'главное',
  operational: 'операц.',
  travel: 'дорога',
  personal: 'личное',
  meal: 'еда',
  rest: 'отдых',
  buffer: 'буфер',
} as const

function getTaskIdForBlock(block: BlockInput, tasks: OpenTask[]): number | null {
  if (!isTaskScheduleBlock(block)) return null
  const task = tasks[block.taskIndex - 1]
  return task ? task.id : null
}

function isFixedBlock(block: BlockInput): boolean {
  return 'isFixed' in block && block.isFixed === true
}

export default function DayTimeline({
  schedule,
  tasks,
  selectedTasks,
  unscheduledTaskIndexes,
  isSaving,
  isDirty,
  error,
  onSetBlockRange,
  onMoveBlock,
  onRemoveBlock,
  onScheduleUnscheduled,
  appliedAnimationKey = 0,
  highlightedTaskIndexes = new Set<number>(),
  mutationLocked = false,
  selectedDate,
  onToggleTask,
}: DayTimelineProps) {
  const { blocks, timezone } = schedule
  const [draggingTaskIndex, setDraggingTaskIndex] = useState<number | null>(null)
  const [dropPreview, setDropPreview] = useState<DropPreview>(null)
  const [showFullDay, setShowFullDay] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const loadSummary = useMemo(() => computeClientScheduleLoadSummary(schedule), [schedule])
  const trayConfig = getUnscheduledTrayViewConfig()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const timelineWindow = getCompressedTimelineWindow(schedule, showFullDay)
  const dayStart = timelineWindow.startMinutes
  const dayEnd = timelineWindow.endMinutes
  const pxPerMinute = timelineWindow.isCompressed ? 0.8 : PX_PER_MIN
  const totalMinutes = Math.max(0, dayEnd - dayStart)
  const totalHeight = totalMinutes * pxPerMinute
  const viewportHeight = getTimelineViewportHeight(totalHeight, timelineWindow.isCompressed)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const showCurrentTimeLine = isCurrentTimeLineVisible(selectedDate, now, dayStart, dayEnd)

  // Hour grid lines (inclusive of dayEnd label).
  const hourMarks = useMemo(() => {
    const marks: number[] = []
    const firstHour = Math.ceil(dayStart / 60) * 60
    for (let m = firstHour; m <= dayEnd; m += 60) {
      if (m >= dayStart) marks.push(m)
    }
    return marks
  }, [dayStart, dayEnd])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  // Sort blocks by start time for display.
  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.startMinutes - b.startMinutes),
    [blocks],
  )

  const unscheduledTasks = unscheduledTaskIndexes
    .map(i => ({ index: i, task: tasks[i] }))
    .filter((x): x is { index: number; task: OpenTask } => Boolean(x.task))

  useEffect(() => {
    if (appliedAnimationKey <= 0) return
    const firstBlock = sortedBlocks[0]
    const container = scrollContainerRef.current
    if (!firstBlock || !container) return
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({
      top: Math.max(0, (firstBlock.startMinutes - dayStart) * pxPerMinute - 32),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [appliedAnimationKey, dayStart, sortedBlocks, pxPerMinute])

  return (
    <div className="day-timeline flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pr-2">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm leading-5 text-gray-400">
        {getTimelineBoundaryPills(schedule).map(label => (
          <span key={label} className="rounded-full border border-gray-800/70 bg-gray-950/60 px-2 py-1 text-xs text-gray-300 tabular-nums">{label}</span>
        ))}
        <span>
          Часовой пояс: <span className="text-gray-200">{timezone}</span>
        </span>
        <span aria-hidden>·</span>
        {isSaving ? (
          <span className="text-amber-300" role="status" aria-live="polite">Сохранение расписания…</span>
        ) : isDirty ? (
          <span className="text-amber-300" role="status" aria-live="polite">Несохранённые изменения</span>
        ) : (
          <span className="text-green-400" role="status" aria-live="polite">Сохранено</span>
        )}
        {error && <span className="text-red-400" role="alert">Ошибка: {error}</span>}
        {mutationLocked && <span className="text-blue-300" role="status" aria-live="polite">Шкала временно заблокирована на время применения</span>}
      </div>

      <div className="grid gap-2 rounded-2xl border border-gray-800/70 bg-gray-950/50 p-2 text-xs text-gray-300 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>Занято: <b className="text-gray-100">{formatDurationLabel(loadSummary.scheduledMinutes)} ({loadSummary.scheduledPercent}%)</b></span>
          <span>Свободно: <b className="text-gray-100">{formatDurationLabel(loadSummary.unscheduledMinutes)} ({loadSummary.unscheduledPercent}%)</b></span>
          {Object.entries(loadSummary.categories).map(([category, value]) => value.minutes > 0 && (
            <span key={category}>{categoryLabels[category as keyof typeof categoryLabels]}: {formatDurationLabel(value.minutes)} · {value.percent}%</span>
          ))}
        </div>
        <p className="text-gray-400">{loadSummary.recommendation}</p>
      </div>

      {timelineWindow.isCompressed && (
        <div className="rounded-2xl border border-primary-500/20 bg-primary-500/10 p-3 text-sm text-gray-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Пока нет блоков расписания — показываю только рабочее окно, чтобы не прокручивать пустой день.</p>
            <button
              type="button"
              onClick={() => setShowFullDay(true)}
              className="min-h-10 rounded-lg px-3 text-sm font-medium text-primary-200 transition-colors hover:bg-primary-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Показать весь день
            </button>
          </div>
        </div>
      )}

      {unscheduledTasks.length > 0 && (
        <div className="flex-shrink-0 rounded-2xl border border-gray-800/70 bg-gray-950/50 p-3 pr-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium text-gray-200">Не распределено ({unscheduledTasks.length})</h4>
            <span className="text-right text-xs text-gray-500">{trayConfig.hint}</span>
          </div>
          <ul className="flex max-h-24 gap-2 overflow-x-auto px-1 pb-2 pr-3 md:flex-wrap md:overflow-y-auto md:overflow-x-hidden">
            {unscheduledTasks.map(({ index, task }) => (
              <li key={`${index}-${task.id}`} className={trayConfig.chipItemClassName}>
                <button
                  type="button"
                  onClick={() => {
                    if (canMutateTimeline(mutationLocked)) onScheduleUnscheduled(index, undefined, trayConfig.defaultDurationMinutes)
                  }}
                  draggable={!mutationLocked}
                  onDragStart={event => {
                    if (!canMutateTimeline(mutationLocked)) return
                    setDraggingTaskIndex(index)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', String(index))
                  }}
                  onDragEnd={() => {
                    setDraggingTaskIndex(null)
                    setDropPreview(null)
                  }}
                  disabled={mutationLocked}
                  className={`group flex w-full cursor-grab items-center gap-2 rounded-xl border border-gray-800/80 bg-gray-900/70 px-3 py-2 text-left text-sm text-gray-200 shadow-sm transition hover:border-blue-400/50 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 ${draggingTaskIndex === index ? 'scale-[0.98] border-blue-400/70 bg-blue-500/15' : ''}`}
                  title={`Перетащить «${task.taskText}» на шкалу или нажать для ближайшего слота`}
                  aria-label={`Задача «${task.taskText}». Перетащите на шкалу или нажмите, чтобы поставить в ближайший свободный слот на 30 минут`}
                  aria-grabbed={draggingTaskIndex === index}
                >
                  <span className="text-gray-500 group-hover:text-blue-300" aria-hidden>⋮⋮</span>
                  <span className="truncate">{task.taskText}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline viewport: this element clips and scrolls the positioned hour grid and blocks. */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-none overflow-y-auto overscroll-contain rounded-2xl"
        style={{ height: viewportHeight, maxHeight: 'min(62vh, 560px)' }}
      >
      {/* Timeline area + hour axis */}
      <div className="flex gap-2" style={{ height: totalHeight, minHeight: totalHeight }}>
        {/* Hour labels column */}
        <div className="relative h-full w-14 flex-shrink-0" aria-hidden>
          {hourMarks.map(m => (
            <div
              key={m}
              className="absolute right-1 -translate-y-1/2 text-xs leading-none text-gray-400"
               style={{ top: (m - dayStart) * pxPerMinute }}
            >
              {minutesToTimeLabel(m)}
            </div>
          ))}

        </div>

        {/* Block area */}
        <div
          className="relative h-full min-w-0 flex-1 rounded-2xl border border-gray-800/70 bg-gradient-to-b from-gray-950/70 to-gray-900/30"
          aria-label="Шкала дня. Перетащите задачу сюда, чтобы поставить её на выбранное время"
          onDragOver={event => {
            if (!canMutateTimeline(mutationLocked)) return
            const rawIndex = event.dataTransfer.getData('text/plain')
            const taskIndex = rawIndex ? Number(rawIndex) : draggingTaskIndex
            if (typeof taskIndex !== 'number' || !Number.isInteger(taskIndex)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            const rect = event.currentTarget.getBoundingClientRect()
            setDropPreview({ taskIndex, startMinutes: getDropStartMinutesFromClientY(event.clientY, rect.top, dayStart, dayEnd, DEFAULT_UNSCHEDULED_DURATION_MINUTES, pxPerMinute) })
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPreview(null)
          }}
          onDrop={event => {
            if (!canMutateTimeline(mutationLocked)) return
            event.preventDefault()
            const taskIndex = Number(event.dataTransfer.getData('text/plain'))
            const rect = event.currentTarget.getBoundingClientRect()
            const startMinutes = getDropStartMinutesFromClientY(event.clientY, rect.top, dayStart, dayEnd, DEFAULT_UNSCHEDULED_DURATION_MINUTES, pxPerMinute)
            setDropPreview(null)
            setDraggingTaskIndex(null)
            if (Number.isInteger(taskIndex)) onScheduleUnscheduled(taskIndex, startMinutes, DEFAULT_UNSCHEDULED_DURATION_MINUTES)
          }}
        >
          {/* Hour grid lines */}
          {hourMarks.map(m => (
            <div
              key={m}
              className="absolute left-0 right-0 border-t border-gray-800/70"
              style={{ top: (m - dayStart) * pxPerMinute }}
              aria-hidden
            />
          ))}

          {dropPreview && (
            <div
              className="pointer-events-none absolute left-2 right-2 z-10 rounded-xl border border-blue-300/70 bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-50 shadow-lg shadow-blue-950/30"
              style={{ top: (dropPreview.startMinutes - dayStart) * pxPerMinute, height: Math.max(44, DEFAULT_UNSCHEDULED_DURATION_MINUTES * pxPerMinute) }}
              role="status"
              aria-live="polite"
            >
              {minutesToTimeLabel(dropPreview.startMinutes)}–{minutesToTimeLabel(dropPreview.startMinutes + DEFAULT_UNSCHEDULED_DURATION_MINUTES)} · 30 мин
            </div>
          )}

          {showCurrentTimeLine && (
            <div
              className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-cyan-300/90"
              style={{ top: (currentMinutes - dayStart) * pxPerMinute }}
              aria-hidden="true"
            >
              <span className="absolute -top-3 left-2 rounded-full bg-cyan-400 px-2 py-0.5 text-[11px] font-semibold text-gray-950 shadow-sm">
                сейчас {minutesToTimeLabel(currentMinutes)}
              </span>
            </div>
          )}

          {sortedBlocks.map((block, index) => (
            <ScheduleBlock
              key={getScheduleBlockRenderKey(block.id, appliedAnimationKey)}
              block={block}
              dayStart={dayStart}
              dayEnd={dayEnd}
              pxPerMinute={pxPerMinute}
              isCompleted={(() => {
                const id = getTaskIdForBlock(block, tasks)
                return id !== null && selectedTasks.has(id)
              })()}
              taskId={getTaskIdForBlock(block, tasks)}
              onToggleTask={onToggleTask}
              onSetBlockRange={onSetBlockRange}
              onMove={onMoveBlock}
              onRemove={onRemoveBlock}
              appliedAnimationKey={appliedAnimationKey}
              animationIndex={index}
              isHighlighted={isTaskHighlighted(block, highlightedTaskIndexes)}
              mutationLocked={mutationLocked}
            />
          ))}
        </div>
      </div>
      </div>

    </div>
  )
}

interface ScheduleBlockProps {
  block: BlockInput
  dayStart: number
  dayEnd: number
  pxPerMinute: number
  isCompleted: boolean
  taskId: number | null
  onToggleTask: (taskId: number) => void
  onSetBlockRange: (blockId: string, startMinutes: number, durationMinutes: number) => void
  onMove: (blockId: string, deltaMinutes: number) => void
  onRemove: (blockId: string) => void
  appliedAnimationKey: number
  animationIndex: number
  isHighlighted: boolean
  mutationLocked: boolean
}

function ScheduleBlock({
  block,
  dayStart,
  dayEnd,
  pxPerMinute,
  isCompleted,
  taskId,
  onToggleTask,
  onSetBlockRange,
  onMove,
  onRemove,
  appliedAnimationKey,
  animationIndex,
  isHighlighted,
  mutationLocked,
}: ScheduleBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState(block.startMinutes)
  const [draftDuration, setDraftDuration] = useState(block.durationMinutes)
  const [previewRange, setPreviewRange] = useState<PreviewRange>(null)
  const dragRef = useRef<DragState | null>(null)
  const previewRef = useRef<PreviewRange>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Keep local draft in sync when entering edit mode.
  useEffect(() => {
    if (editing) {
      setDraftStart(block.startMinutes)
      setDraftDuration(block.durationMinutes)
    }
  }, [editing, block.startMinutes, block.durationMinutes])

  useEffect(() => {
    if (canMutateTimeline(mutationLocked)) return
    dragRef.current = null
    previewRef.current = null
    setPreviewRange(null)
    setEditing(false)
  }, [mutationLocked])

  const displayStart = previewRange?.startMinutes ?? block.startMinutes
  const displayDuration = previewRange?.durationMinutes ?? block.durationMinutes
  const top = (displayStart - dayStart) * pxPerMinute
  const height = displayDuration * pxPerMinute
  const endLabel = minutesToTimeLabel(displayStart + displayDuration)
  const title = getBlockDisplayTitle(block)
  const blockKind = 'kind' in block ? block.kind : 'task'
  const isTaskBlock = isTaskScheduleBlock(block)
  const isVeryShortBlock = displayDuration <= 15
  const isShortBlock = displayDuration <= 30
  const kindClass = blockKind === 'meal'
    ? 'border-orange-400/40 bg-gradient-to-br from-orange-500/20 to-orange-500/10 hover:border-orange-300/60 hover:from-orange-500/25'
    : blockKind === 'rest'
      ? 'border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 hover:border-emerald-300/60 hover:from-emerald-500/25'
      : blockKind === 'buffer'
        ? 'border-purple-400/40 bg-gradient-to-br from-purple-500/20 to-purple-500/10 hover:border-purple-300/60 hover:from-purple-500/25'
        : isCompleted
          ? 'border-green-400/35 bg-gradient-to-br from-green-500/20 to-green-500/10'
          : 'border-blue-400/35 bg-gradient-to-br from-blue-500/20 to-blue-500/10 hover:border-blue-300/60 hover:from-blue-500/25'

  const clampPreview = (startMinutes: number, durationMinutes: number, mode: DragMode) =>
    getTimelinePointerPreviewRange(startMinutes, durationMinutes, 0, mode, dayStart, dayEnd)

  // === Pointer handlers (move) ===
  const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canMutateTimeline(mutationLocked)) return
    if (editing) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startedFromTouchHandle = e.target instanceof Element
      && e.target.closest('[data-timeline-touch-drag-handle="true"]') !== null
    if (!shouldStartTimelinePointerDrag(e.pointerType, startedFromTouchHandle)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'move',
      pointerId: e.pointerId,
      startY: e.clientY,
      originalStart: block.startMinutes,
      originalDuration: block.durationMinutes,
      moved: false,
    }
  }

  const onBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!canMutateTimeline(mutationLocked)) return
    if (!state || state.pointerId !== e.pointerId || state.mode !== 'move') return
    const dy = e.clientY - state.startY
    if (!state.moved && Math.abs(dy) < 4) return
    state.moved = true
    const deltaMin = snapToStep(dy / pxPerMinute)
    const next = clampPreview(state.originalStart + deltaMin, state.originalDuration, 'move')
    previewRef.current = next
    setPreviewRange(next)
  }

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>, eventType: 'up' | 'cancel') => {
    const state = dragRef.current
    if (!state || state.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    dragRef.current = null
    if (shouldCommitPointerDrag(eventType, state.moved, mutationLocked)) {
      const next = previewRef.current ?? clampPreview(state.originalStart, state.originalDuration, state.mode)
      onSetBlockRange(block.id, next.startMinutes, next.durationMinutes)
    }
    previewRef.current = null
    setPreviewRange(null)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, 'up')
  const cancelDrag = (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, 'cancel')

  // === Pointer handlers (resize) ===
  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canMutateTimeline(mutationLocked)) return
    if (editing) return
    e.stopPropagation()
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'resize',
      pointerId: e.pointerId,
      startY: e.clientY,
      originalStart: block.startMinutes,
      originalDuration: block.durationMinutes,
      moved: false,
    }
  }

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!canMutateTimeline(mutationLocked)) return
    if (!state || state.pointerId !== e.pointerId || state.mode !== 'resize') return
    const dy = e.clientY - state.startY
    if (!state.moved && Math.abs(dy) < 4) return
    state.moved = true
    const deltaMin = snapToStep(dy / pxPerMinute)
    const next = clampPreview(state.originalStart, state.originalDuration + deltaMin, 'resize')
    previewRef.current = next
    setPreviewRange(next)
  }

  // === Keyboard ===
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setEditing(false)
      }
      return
    }
    if (!canMutateTimeline(mutationLocked)) {
      e.preventDefault()
      return
    }
    const step = e.shiftKey ? 60 : SCHEDULE_INTERACTION_STEP_MINUTES
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onMove(block.id, -step)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onMove(block.id, step)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setEditing(true)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onRemove(block.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      rootRef.current?.blur()
    }
  }

  const applyEdit = () => {
    if (!canMutateTimeline(mutationLocked)) return
    onSetBlockRange(block.id, draftStart, draftDuration)
    setEditing(false)
  }

  const startLabel = minutesToTimeLabel(displayStart)
  const category = getScheduleBlockCategory(block)
  const fixed = isFixedBlock(block)

  return (
    <div
      ref={rootRef}
      role="group"
      tabIndex={0}
      aria-label={`Блок расписания: ${title}, с ${startLabel} до ${endLabel}, длительность ${formatDurationLabel(displayDuration)}.${fixed ? ' Фиксированное время.' : ''}${mutationLocked ? ' Редактирование временно заблокировано.' : ' Enter — редактировать, стрелки — сдвинуть, Delete — убрать. На сенсорном экране переносите за маркер.'}`}
      title={fixed ? 'Фиксированное время: другие блоки не могут на него наехать' : undefined}
      aria-disabled={mutationLocked}
      className={`absolute left-1 right-1 flex flex-col overflow-hidden rounded-xl border px-2.5 py-1.5 shadow-sm outline-none transition-colors focus:ring-2 focus:ring-blue-400 ${kindClass} ${mutationLocked ? 'cursor-not-allowed opacity-70' : ''} ${appliedAnimationKey > 0 ? 'schedule-block-apply-enter' : ''} ${isHighlighted ? 'schedule-block-new-task-highlight' : ''}`}
      style={{
        top,
        height: Math.max(height, 44),
        touchAction: 'pan-y',
        cursor: mutationLocked ? 'not-allowed' : 'grab',
        animationDelay: appliedAnimationKey > 0 ? `${Math.min(animationIndex, 12) * 70}ms` : undefined,
      }}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onBodyPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onKeyDown={onKeyDown}
    >
      {!editing && !mutationLocked && (
        <span
          data-timeline-touch-drag-handle="true"
          className="absolute right-0 top-0 z-20 flex h-11 w-11 cursor-grab items-center justify-center text-lg text-gray-300/80 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          aria-hidden="true"
        >
          ⠿
        </span>
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto ${!editing && !mutationLocked ? 'pr-9' : 'pr-0.5'}`}>
        {isVeryShortBlock && !editing ? (
          <div className="flex min-w-0 items-center gap-2 leading-tight">
            {isTaskBlock && taskId !== null && (
              <input
                type="checkbox"
                checked={isCompleted}
                disabled={mutationLocked}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                onChange={() => onToggleTask(taskId)}
                className="h-4 w-4 flex-shrink-0"
                aria-label={`Отметить задачу «${title}» выполненной`}
              />
            )}
            <div className={`min-w-0 flex-1 truncate text-[13px] font-medium text-gray-100 sm:text-sm ${isCompleted && isTaskBlock ? 'text-gray-400 line-through' : ''}`}>
              {title}
            </div>
            <div className="shrink-0 text-xs font-medium text-gray-300">
              {startLabel}–{endLabel} · {formatDurationLabel(displayDuration)}
              {fixed && <span className="ml-1 rounded border border-amber-400/60 bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-100">фикс.</span>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-start gap-2">
              {isTaskBlock && taskId !== null && (
                <input
                  type="checkbox"
                  checked={isCompleted}
                  disabled={mutationLocked}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  onChange={() => onToggleTask(taskId)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  aria-label={`Отметить задачу «${title}» выполненной`}
                />
              )}
              <div className={`min-w-0 flex-1 truncate text-[15px] font-medium leading-tight text-gray-100 ${isCompleted && isTaskBlock ? 'text-gray-400 line-through' : ''}`}>
                {title}
              </div>
            </div>
            <div className={`${isShortBlock ? 'text-xs leading-tight' : 'text-[13px] leading-5'} text-gray-300`}>
              <span className="mr-1 rounded bg-gray-950/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide">{categoryLabels[category]}</span>
              {fixed && <span className="mr-1 rounded border border-amber-400/60 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100">фикс.</span>}
              {startLabel}–{endLabel} · {formatDurationLabel(displayDuration)}
            </div>
          </>
        )}

        {editing && (
          <div
            className="mt-1.5 flex flex-col gap-1.5"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
              <span>Начало</span>
              <input
                type="time"
                disabled={mutationLocked}
                className="rounded bg-gray-900 px-1.5 py-1 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-blue-400"
                value={minutesToTimeInputValue(draftStart)}
                onChange={e => {
                  const m = timeLabelToMinutes(e.target.value)
                  if (m >= 0) setDraftStart(m)
                }}
                aria-label="Время начала блока"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
              <span>Минут</span>
              <input
                type="number"
                disabled={mutationLocked}
                min={MIN_BLOCK_DURATION_MINUTES}
                max={1440}
                step={SCHEDULE_INTERACTION_STEP_MINUTES}
                className="w-20 rounded bg-gray-900 px-1.5 py-1 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-blue-400"
                value={draftDuration}
                onChange={e => {
                  const n = Number(e.target.value)
                  if (Number.isFinite(n)) setDraftDuration(snapToStep(n))
                }}
                aria-label="Длительность блока в минутах"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={mutationLocked}
                className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
                onClick={applyEdit}
              >
                OK
              </button>
              <button
                type="button"
                className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-200 hover:bg-gray-600"
                onClick={() => setEditing(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={mutationLocked}
                className="rounded bg-red-700/80 px-2 py-1 text-xs font-medium text-white hover:bg-red-600/80"
                onClick={() => {
                  onRemove(block.id)
                  setEditing(false)
                }}
                aria-label={`Убрать «${title}» из расписания`}
              >
                Убрать
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resize handle (bottom). Touch zone is the visible strip — at PX_PER_MIN=3
          a 15-min block is 45px tall, leaving enough room for an 18px handle. */}
      <div
        role="separator"
        aria-label="Изменить длительность блока"
        aria-orientation="horizontal"
        className="flex h-[18px] cursor-ns-resize items-center justify-center"
        style={{ touchAction: 'none' }}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
      >
        <div className="h-1 w-8 rounded bg-gray-400/70" />
      </div>
    </div>
  )
}
