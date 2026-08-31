'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DailySchedule } from '@/lib/daily-schedule'
import type { OpenTask } from '@/lib/types'
import ScheduleLoadSummary from '@/components/daily/ScheduleLoadSummary'
import TimeField from '@/components/daily/TimeField'
import {
  type BlockInput,
  MIN_BLOCK_DURATION_MINUTES,
  SCHEDULE_INTERACTION_STEP_MINUTES,
  clamp,
  computeClientScheduleLoadSummary,
  formatDurationLabel,
  getBlockDisplayTitle,
  getScheduleBoundaryMinutes,
  getScheduleBlockCategory,
  isTaskScheduleBlock,
  minutesToTimeLabel,
  snapToStep,
} from '@/hooks/daily/schedule-helpers'

const PX_PER_MIN = 3 // 15-min block ≈ 45px (≥44px touch target)
// Минимальная отрисованная высота блока (см. ScheduleBlock: max(height, 44) - 2).
// Сетка обязана учитывать её, иначе короткие блоки в сжатом масштабе вылезают за низ.
const MIN_BLOCK_RENDER_PX = 44
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

export function getTimelineBlockTitle(block: BlockInput, tasks: OpenTask[]): string {
  if (!isTaskScheduleBlock(block)) return getBlockDisplayTitle(block)
  return tasks[block.taskIndex - 1]?.taskText ?? block.taskText
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

const FULL_DAY_START_MINUTES = 0
const FULL_DAY_END_MINUTES = 1440

export interface DayNightGradientStop {
  offsetPercent: number
  color: string
}

// Низкая непрозрачность — это лёгкая подложка-настроение поверх тёмной темы, а не заливка;
// текст блоков и меток оси не задет: подложка лежит только под сеткой шкалы, метки — в
// отдельном жёлобе оси со своим фоном, а сами карточки блоков рисуются поверх со своей
// куда более плотной заливкой (см. kindClass ниже).
const NIGHT_COLOR = 'rgba(10, 12, 24, 0.55)' // 00:00–~05:00 и 21:00–24:00 — самый тёмный сине-чёрный
const DAWN_WARM_COLOR = 'rgba(54, 42, 36, 0.38)' // ~07:30 — пик тёплого оттенка на подъёме к утру
const DAY_COLOR = 'rgba(51, 65, 85, 0.32)' // ~10:00–17:00 — самый светлый из тёмных, холодный синий (slate-700)
const EVENING_COLOR = 'rgba(40, 26, 54, 0.42)' // ~21:00 — тёплое фиолетово-синее затемнение

/**
 * Стопы вертикального градиента «день/ночь» для фона зоны блоков шкалы, в процентах
 * от высоты суток (минуты/1440) — не зависят от pxPerMinute или окна вида, поэтому
 * применимы напрямую как проценты CSS linear-gradient, когда вид растянут на весь день
 * (00:00–24:00, см. getCompressedTimelineWindow). Стопы монотонны по offsetPercent;
 * 0% и 100% — одинаковый ночной цвет (полночь на обоих концах суток).
 */
export function getDayNightGradientStops(): DayNightGradientStop[] {
  const stopAt = (minutes: number, color: string): DayNightGradientStop => ({
    offsetPercent: Math.round((minutes / FULL_DAY_END_MINUTES) * 10000) / 100,
    color,
  })
  return [
    stopAt(0, NIGHT_COLOR), // 00:00
    stopAt(5 * 60, NIGHT_COLOR), // 05:00 — конец плато ночи
    stopAt(7 * 60 + 30, DAWN_WARM_COLOR), // 07:30 — тёплый пик рассвета
    stopAt(10 * 60, DAY_COLOR), // 10:00 — начало плато дня
    stopAt(17 * 60, DAY_COLOR), // 17:00 — конец плато дня
    stopAt(21 * 60, EVENING_COLOR), // 21:00 — вечер
    stopAt(FULL_DAY_END_MINUTES, NIGHT_COLOR), // 24:00
  ]
}

export function buildDayNightGradientCss(stops: DayNightGradientStop[]): string {
  return `linear-gradient(to bottom, ${stops.map(s => `${s.color} ${s.offsetPercent}%`).join(', ')})`
}

/**
 * Окно вида шкалы. Вне сжатого режима вид всегда показывает весь день (00:00–24:00),
 * а не schedule.dayStart/dayEndMinutes — план строится «с текущего момента», и его
 * реальные границы (например 16:30–21:00) не должны ограничивать прокрутку: пользователь
 * должен свободно долистать вверх к утру и вниз к ночи независимо от того, где лежат блоки.
 * Границы плана (dayStart/dayEnd, planning/work/activity) остаются как есть — они
 * используются только для пилюль статуса и для сжатого окна пустого расписания ниже.
 */
export function getCompressedTimelineWindow(schedule: DailySchedule, showFullDay: boolean): { startMinutes: number; endMinutes: number; isCompressed: boolean } {
  if (showFullDay || schedule.blocks.length > 0) {
    return { startMinutes: FULL_DAY_START_MINUTES, endMinutes: FULL_DAY_END_MINUTES, isCompressed: false }
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

// Метки ближе этого расстояния (px) к плашке «сейчас» перекрываются ей и не рисуются —
// совпадает с порогом, которым blockBoundaryMarks уже отсеивают совпадения с hourMarks.
const AXIS_MARK_OVERLAP_PX = 14

/**
 * Прячет часовые и точные (границы блоков) метки оси, которые пиксельно накладываются
 * на плашку текущего времени — она рисуется поверх и обязана оставаться читаемой.
 * currentMinutes === null (линия «сейчас» не видна) — фильтрация не нужна, метки как есть.
 */
export function getVisibleAxisMarks(
  hourMarks: number[],
  boundaryMarks: number[],
  currentMinutes: number | null,
  pxPerMinute: number,
): { hourMarks: number[]; boundaryMarks: number[] } {
  if (currentMinutes === null) return { hourMarks, boundaryMarks }
  const overlapsCurrent = (m: number) => Math.abs((m - currentMinutes) * pxPerMinute) < AXIS_MARK_OVERLAP_PX
  return {
    hourMarks: hourMarks.filter(m => !overlapsCurrent(m)),
    boundaryMarks: boundaryMarks.filter(m => !overlapsCurrent(m)),
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
    hint: 'Перетащите на шкалу или нажмите',
    chipItemClassName: 'w-[min(72vw,220px)] flex-shrink-0 sm:w-[220px]',
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
  hasUnappliedScheduleProposal?: boolean
  onGoToUnappliedScheduleProposal?: () => void
  selectedDate: string
  onToggleTask: (taskId: number) => void
  editingTaskId: number | null
  editingTaskText: string
  onStartEditingTask: (taskId: number, currentText: string) => void
  onChangeEditingTaskText: (text: string) => void
  onSaveEditedTask: (taskId: number) => void
  onCancelEditingTask: () => void
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
  hasUnappliedScheduleProposal = false,
  onGoToUnappliedScheduleProposal,
  selectedDate,
  onToggleTask,
  editingTaskId,
  editingTaskText,
  onStartEditingTask,
  onChangeEditingTaskText,
  onSaveEditedTask,
  onCancelEditingTask,
}: DayTimelineProps) {
  const { blocks, timezone } = schedule
  const [draggingTaskIndex, setDraggingTaskIndex] = useState<number | null>(null)
  const [dropPreview, setDropPreview] = useState<DropPreview>(null)
  const [showFullDay, setShowFullDay] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const loadSummary = useMemo(() => computeClientScheduleLoadSummary(schedule), [schedule])
  const trayConfig = getUnscheduledTrayViewConfig()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const isScheduleEmpty = blocks.length === 0
  const timelineWindow = getCompressedTimelineWindow(schedule, showFullDay)
  const dayStart = timelineWindow.startMinutes
  const dayEnd = timelineWindow.endMinutes
  const pxPerMinute = timelineWindow.isCompressed ? 0.8 : PX_PER_MIN
  const totalMinutes = Math.max(0, dayEnd - dayStart)
  // Высота сетки: по времени дня, но не меньше низа самого нижнего
  // отрисованного блока (короткие блоки раздуваются до MIN_BLOCK_RENDER_PX
  // и в сжатом масштабе вылезают за "минутную" высоту) + нижний отступ.
  const maxBlockBottom = blocks.reduce((max, b) => {
    const top = (b.startMinutes - dayStart) * pxPerMinute
    const rendered = Math.max(b.durationMinutes * pxPerMinute, MIN_BLOCK_RENDER_PX)
    return Math.max(max, top + rendered)
  }, 0)
  const totalHeight = Math.max(totalMinutes * pxPerMinute, maxBlockBottom + 8)
  const viewportHeight = getTimelineViewportHeight(totalHeight, timelineWindow.isCompressed)
  // День/ночь подложка растянута ровно на 00:00–24:00, поэтому она осмысленна только
  // когда вид действительно показывает весь день (см. getCompressedTimelineWindow).
  // В сжатом рабочем окне пустого расписания её не показываем — набор из пары часов
  // окна не несёт смысла "утро/день/вечер/ночь", проще оставить нейтральный фон.
  const dayNightGradientCss = useMemo(
    () => (timelineWindow.isCompressed ? null : buildDayNightGradientCss(getDayNightGradientStops())),
    [timelineWindow.isCompressed],
  )
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

  // Точные границы блоков (15:13 и т.п.) на оси: старт и конец каждого блока,
  // кроме совпадающих с часовыми метками и налезающих друг на друга по пикселям.
  const blockBoundaryMarks = useMemo(() => {
    const toPx = (m: number) => (m - dayStart) * pxPerMinute
    const occupied = hourMarks.map(toPx)
    const marks: number[] = []
    const tryAdd = (m: number) => {
      if (m < dayStart || m > dayEnd) return
      if (m % 60 === 0) return
      const y = toPx(m)
      if (occupied.some(u => Math.abs(u - y) < 14)) return
      occupied.push(y)
      marks.push(m)
    }
    for (const b of blocks) {
      tryAdd(b.startMinutes)
      tryAdd(b.startMinutes + b.durationMinutes)
    }
    return marks
  }, [blocks, dayStart, dayEnd, pxPerMinute, hourMarks])

  // Метки, которые плашка «сейчас» перекрывает своим пикселем, не рисуем — иначе
  // час/точная граница блока становятся нечитаемыми под голубой капсулой времени.
  const visibleAxisMarks = useMemo(
    () => getVisibleAxisMarks(hourMarks, blockBoundaryMarks, showCurrentTimeLine ? currentMinutes : null, pxPerMinute),
    [hourMarks, blockBoundaryMarks, showCurrentTimeLine, currentMinutes, pxPerMinute],
  )

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

  // При открытии дня лента сразу показывает «сейчас» (для сегодняшнего дня),
  // иначе — первый блок; без этого шкала всегда открывалась с верха окна (теперь это
  // 00:00 полного дня, а не только время начала плана).
  const initialScrollDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialScrollDateRef.current === selectedDate) return
    const container = scrollContainerRef.current
    if (!container) return
    initialScrollDateRef.current = selectedDate
    const anchorMinutes = showCurrentTimeLine
      ? currentMinutes
      : sortedBlocks[0]?.startMinutes
    if (typeof anchorMinutes !== 'number') return
    container.scrollTo({ top: Math.max(0, (anchorMinutes - dayStart) * pxPerMinute - 48) })
  }, [selectedDate, showCurrentTimeLine, currentMinutes, sortedBlocks, dayStart, pxPerMinute])

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
      <div className="type-secondary flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-5">
        {getTimelineBoundaryPills(schedule).map(label => (
          <span key={label} className="type-caption rounded-full border border-gray-800/70 bg-gray-950/60 px-2 py-0.5 tabular-nums">{label}</span>
        ))}
        <span className="ml-1 truncate text-gray-500 sm:max-w-none">
          {timezone}
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

      {!isScheduleEmpty && <ScheduleLoadSummary summary={loadSummary} className="px-1" />}

      {isScheduleEmpty && (
        <div className="type-body rounded-2xl border border-primary-500/20 bg-primary-500/10 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{timelineWindow.isCompressed ? 'Расписание пустое — показываю рабочее окно, чтобы сразу было видно шкалу.' : 'Расписание пустое — весь день открыт на шкале.'}</p>
            {timelineWindow.isCompressed && (
              <button
                type="button"
                onClick={() => setShowFullDay(true)}
                className="min-h-10 rounded-lg px-3 text-sm font-medium text-primary-200 transition-colors hover:bg-primary-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Показать весь день
              </button>
            )}
          </div>
        </div>
      )}

      {unscheduledTasks.length > 0 && (
        <div className="flex-shrink-0 rounded-2xl border border-gray-800/70 bg-gray-950/50 p-2 pr-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h4 className="type-secondary font-medium text-gray-200">Не распределено ({unscheduledTasks.length})</h4>
            <span className="type-caption hidden text-right sm:inline">{trayConfig.hint}</span>
          </div>
          {hasUnappliedScheduleProposal && onGoToUnappliedScheduleProposal && (
            <button
              type="button"
              onClick={onGoToUnappliedScheduleProposal}
              className="type-caption mb-2 flex w-full items-center justify-between gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-left text-cyan-100 transition-colors hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>В чате есть неприменённое расписание</span>
              <span className="shrink-0 font-medium underline decoration-dotted underline-offset-2">Показать в чате</span>
            </button>
          )}
          <ul className="flex gap-2 overflow-x-auto px-1 pb-1 pr-3" aria-label="Не распределённые задачи для перетаскивания на шкалу">
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
                  className={`type-body group flex w-full cursor-grab items-center gap-2 rounded-xl border border-gray-800/80 bg-gray-900/70 px-3 py-1.5 text-left shadow-sm transition hover:border-blue-400/50 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 ${draggingTaskIndex === index ? 'scale-[0.98] border-blue-400/70 bg-blue-500/15' : ''}`}
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl"
        style={{ height: viewportHeight, maxHeight: 'min(62vh, 560px)' }}
      >
      {/* Timeline area + hour axis */}
      <div className="flex gap-2" style={{ height: totalHeight, minHeight: totalHeight }}>
        {/* Hour labels column */}
        {/* Вне шкалы: циферблатные метки оси (часы, точные границы блоков, плашка
            «сейчас») — плотный числовой жёлоб шкалы времени, читаются как деления
            линейки, а не как текст с ролью в типографической иерархии. */}
        <div className="relative h-full w-14 flex-shrink-0" aria-hidden>
          {visibleAxisMarks.hourMarks.map(m => (
            <div
              key={m}
              className="absolute right-1 -translate-y-1/2 text-xs leading-none text-gray-400"
               style={{ top: (m - dayStart) * pxPerMinute }}
            >
              {minutesToTimeLabel(m)}
            </div>
          ))}
          {visibleAxisMarks.boundaryMarks.map(m => (
            <div
              key={`boundary-${m}`}
              className="absolute right-1 -translate-y-1/2 text-[10px] leading-none text-gray-500"
              style={{ top: (m - dayStart) * pxPerMinute }}
            >
              {minutesToTimeLabel(m)}
            </div>
          ))}
          {/* Плашка текущего времени живёт в жёлобе оси, не поверх карточек */}
          {showCurrentTimeLine && (
            <div
              className="absolute right-0 z-10 -translate-y-1/2 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-950 shadow-sm"
              style={{ top: (currentMinutes - dayStart) * pxPerMinute }}
            >
              {minutesToTimeLabel(currentMinutes)}
            </div>
          )}
        </div>

        {/* Block area */}
        <div
          className="relative h-full min-w-0 flex-1 rounded-2xl border border-gray-800/70 bg-gradient-to-b from-gray-950/70 to-gray-900/30"
          style={dayNightGradientCss ? { backgroundImage: dayNightGradientCss } : undefined}
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
              className="type-secondary pointer-events-none absolute left-2 right-2 z-10 rounded-xl border border-blue-300/70 bg-blue-500/20 px-3 py-2 font-medium text-blue-50 shadow-lg shadow-blue-950/30"
              style={{ top: (dropPreview.startMinutes - dayStart) * pxPerMinute, height: Math.max(44, DEFAULT_UNSCHEDULED_DURATION_MINUTES * pxPerMinute) }}
              role="status"
              aria-live="polite"
            >
              {minutesToTimeLabel(dropPreview.startMinutes)}–{minutesToTimeLabel(dropPreview.startMinutes + DEFAULT_UNSCHEDULED_DURATION_MINUTES)} · 30 мин
            </div>
          )}

          {/* Линия «сейчас» рисуется под карточками (без z-index блоки, идущие
              позже в DOM, перекрывают её) — текст блоков она не пересекает,
              а сквозь полупрозрачный фон мягко просвечивает */}
          {showCurrentTimeLine && (
            <div
              className="pointer-events-none absolute left-0 right-0 border-t-2 border-cyan-300/90"
              style={{ top: (currentMinutes - dayStart) * pxPerMinute }}
              aria-hidden="true"
            />
          )}

          {sortedBlocks.map((block, index) => (
            <ScheduleBlock
              key={getScheduleBlockRenderKey(block.id, appliedAnimationKey)}
              block={block}
              title={getTimelineBlockTitle(block, tasks)}
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
              editingTaskId={editingTaskId}
              editingTaskText={editingTaskText}
              onStartEditingTask={onStartEditingTask}
              onChangeEditingTaskText={onChangeEditingTaskText}
              onSaveEditedTask={onSaveEditedTask}
              onCancelEditingTask={onCancelEditingTask}
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
  title: string
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
  editingTaskId: number | null
  editingTaskText: string
  onStartEditingTask: (taskId: number, currentText: string) => void
  onChangeEditingTaskText: (text: string) => void
  onSaveEditedTask: (taskId: number) => void
  onCancelEditingTask: () => void
}

function ScheduleBlock({
  block,
  title,
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
  editingTaskId,
  editingTaskText,
  onStartEditingTask,
  onChangeEditingTaskText,
  onSaveEditedTask,
  onCancelEditingTask,
}: ScheduleBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState(block.startMinutes)
  const [draftDuration, setDraftDuration] = useState(block.durationMinutes)
  const [previewRange, setPreviewRange] = useState<PreviewRange>(null)
  const dragRef = useRef<DragState | null>(null)
  const previewRef = useRef<PreviewRange>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const blockKind = 'kind' in block ? block.kind : 'task'
  const isTaskBlock = isTaskScheduleBlock(block)

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
    if (isTaskBlock) onCancelEditingTask()
  }, [mutationLocked, isTaskBlock, onCancelEditingTask])

  const displayStart = previewRange?.startMinutes ?? block.startMinutes
  const displayDuration = previewRange?.durationMinutes ?? block.durationMinutes
  const top = (displayStart - dayStart) * pxPerMinute
  const height = displayDuration * pxPerMinute
  const endLabel = minutesToTimeLabel(displayStart + displayDuration)
  const isEditingTaskText = isTaskBlock && taskId !== null && editingTaskId === taskId
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

  const openEditing = () => {
    if (!canMutateTimeline(mutationLocked)) return
    setEditing(true)
    if (isTaskBlock && taskId !== null) onStartEditingTask(taskId, title)
  }

  const closeEditing = () => {
    setEditing(false)
    if (isTaskBlock) onCancelEditingTask()
  }

  // === Keyboard ===
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeEditing()
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
      openEditing()
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
    if (isTaskBlock && taskId !== null) onSaveEditedTask(taskId)
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
      className={`absolute left-1 right-1 flex flex-col overflow-hidden rounded-xl border px-2.5 shadow-sm outline-none transition-colors focus:ring-2 focus:ring-blue-400 ${isVeryShortBlock ? 'py-0.5' : 'py-1.5'} ${kindClass} ${mutationLocked ? 'cursor-not-allowed opacity-70' : ''} ${appliedAnimationKey > 0 ? 'schedule-block-apply-enter' : ''} ${isHighlighted ? 'schedule-block-new-task-highlight' : ''}`}
      style={{
        // +1/-2px — зазор между соседними блоками, чтобы границы не слипались
        top: top + 1,
        height: Math.max(height, 44) - 2,
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
      <div className={`min-h-0 flex-1 ${isVeryShortBlock && !editing ? 'flex items-center overflow-hidden' : 'overflow-y-auto'} ${!editing && !mutationLocked ? 'pr-9' : 'pr-0.5'}`}>
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
            <div className={`type-body min-w-0 flex-1 truncate font-medium ${isCompleted && isTaskBlock ? 'text-gray-400 line-through' : ''}`}>
              {title}
            </div>
            {isTaskBlock && taskId !== null && !mutationLocked && (
              // Вне шкалы: компактная кнопка-иконка правки, размер задан плотностью
              // строки блока, а не текстовой ролью.
              <button
                type="button"
                className="shrink-0 rounded border border-gray-700 px-1.5 py-0.5 text-[11px] font-medium text-gray-300 hover:border-blue-400/70 hover:text-blue-100"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  openEditing()
                }}
                aria-label={`Править задачу «${title}»`}
              >
                ✎
              </button>
            )}
            <div className="type-secondary shrink-0 font-medium">
              {startLabel}–{endLabel} · {formatDurationLabel(displayDuration)}
              {/* Вне шкалы: бейдж «фикс.», как в карточке предложения расписания. */}
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
              <div className={`type-body min-w-0 flex-1 truncate font-medium leading-tight ${isCompleted && isTaskBlock ? 'text-gray-400 line-through' : ''}`}>
                {title}
              </div>
              {!editing && isTaskBlock && taskId !== null && !mutationLocked && (
                <button
                  type="button"
                  className="shrink-0 rounded border border-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-300 hover:border-blue-400/70 hover:text-blue-100"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    openEditing()
                  }}
                >
                  Править
                </button>
              )}
            </div>
            <div className={`type-secondary ${isShortBlock ? 'leading-tight' : 'leading-5'}`}>
              {/* Вне шкалы: бейджи категории и «фикс.» — компактные цветовые метки,
                  как в карточке предложения расписания, а не текстовая роль. */}
              <span className="mr-1 rounded bg-gray-950/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide">{categoryLabels[category]}</span>
              {fixed && <span className="mr-1 rounded border border-amber-400/60 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100">фикс.</span>}
              {startLabel}–{endLabel} · {formatDurationLabel(displayDuration)}
            </div>
          </>
        )}

        {editing && (
          // Вне шкалы (вся инлайн-форма ниже): плотный редактор блока встраивается
          // прямо в карточку шкалы, чья ширина не гарантирована — тот же случай
          // плотности, что и у TimeField (см. components/daily/TimeField.tsx).
          <div
            className="mt-1.5 flex flex-col gap-1.5"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {isTaskBlock && taskId !== null && (
              <label className="flex flex-col gap-1 text-xs text-gray-300">
                <span>Задача</span>
                <textarea
                  disabled={mutationLocked}
                  rows={2}
                  className="resize-none rounded bg-gray-900 px-2 py-1 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-blue-400"
                  value={isEditingTaskText ? editingTaskText : title}
                  onChange={e => onChangeEditingTaskText(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      applyEdit()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      closeEditing()
                    }
                    e.stopPropagation()
                  }}
                  aria-label="Текст задачи"
                />
              </label>
            )}
            <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
              <span>Начало</span>
              <TimeField
                value={draftStart}
                onChange={setDraftStart}
                disabled={mutationLocked}
                ariaLabel="Время начала блока"
                stepMinutes={SCHEDULE_INTERACTION_STEP_MINUTES}
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
              <span>Минут</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={mutationLocked}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-700 text-sm leading-none text-gray-200 outline-none hover:border-blue-400/70 hover:text-blue-100 focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setDraftDuration(d => clamp(snapToStep(d - SCHEDULE_INTERACTION_STEP_MINUTES), MIN_BLOCK_DURATION_MINUTES, 1440))}
                  aria-label="Уменьшить длительность на шаг"
                >
                  −
                </button>
                <input
                  type="number"
                  disabled={mutationLocked}
                  min={MIN_BLOCK_DURATION_MINUTES}
                  max={1440}
                  step={SCHEDULE_INTERACTION_STEP_MINUTES}
                  className="w-14 rounded bg-gray-900 px-1 py-1 text-center text-xs text-gray-100 outline-none [appearance:textfield] focus:ring-1 focus:ring-blue-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={draftDuration}
                  onChange={e => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setDraftDuration(snapToStep(n))
                  }}
                  aria-label="Длительность блока в минутах"
                />
                <button
                  type="button"
                  disabled={mutationLocked}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-700 text-sm leading-none text-gray-200 outline-none hover:border-blue-400/70 hover:text-blue-100 focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setDraftDuration(d => clamp(snapToStep(d + SCHEDULE_INTERACTION_STEP_MINUTES), MIN_BLOCK_DURATION_MINUTES, 1440))}
                  aria-label="Увеличить длительность на шаг"
                >
                  +
                </button>
              </div>
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
                onClick={closeEditing}
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
