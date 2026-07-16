'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DailySchedule } from '@/lib/daily-schedule'
import type { OpenTask } from '@/lib/types'
import {
  type BlockInput,
  MIN_BLOCK_DURATION_MINUTES,
  clamp,
  formatDurationLabel,
  getBlockDisplayTitle,
  hasOverlapWithOthers,
  isTaskScheduleBlock,
  minutesToTimeInputValue,
  minutesToTimeLabel,
  snapToStep,
  timeLabelToMinutes,
} from '@/hooks/daily/schedule-helpers'

const PX_PER_MIN = 3 // 15-min block ≈ 45px (≥44px touch target)

export function getScheduleBlockRenderKey(blockId: string, appliedAnimationKey: number): string {
  return appliedAnimationKey > 0 ? `${appliedAnimationKey}:${blockId}` : blockId
}

export function canMutateTimeline(mutationLocked: boolean): boolean {
  return !mutationLocked
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
  onScheduleUnscheduled: (taskIndex: number) => void
  appliedAnimationKey?: number
  mutationLocked?: boolean
}

type DragMode = 'move' | 'resize'

interface DragState {
  mode: DragMode
  pointerId: number
  startY: number
  originalStart: number
  originalDuration: number
  moved: boolean
}

function getTaskIdForBlock(block: BlockInput, tasks: OpenTask[]): number | null {
  if (!isTaskScheduleBlock(block)) return null
  const task = tasks[block.taskIndex - 1]
  return task ? task.id : null
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
  mutationLocked = false,
}: DayTimelineProps) {
  const { dayStartMinutes: dayStart, dayEndMinutes: dayEnd, blocks, timezone } = schedule
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const totalMinutes = Math.max(0, dayEnd - dayStart)
  const totalHeight = totalMinutes * PX_PER_MIN

  // Hour grid lines (inclusive of dayEnd label).
  const hourMarks = useMemo(() => {
    const marks: number[] = []
    const firstHour = Math.ceil(dayStart / 60) * 60
    for (let m = firstHour; m <= dayEnd; m += 60) {
      if (m >= dayStart) marks.push(m)
    }
    return marks
  }, [dayStart, dayEnd])

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
      top: Math.max(0, (firstBlock.startMinutes - dayStart) * PX_PER_MIN - 32),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [appliedAnimationKey, dayStart, sortedBlocks])

  return (
    <div ref={scrollContainerRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2" style={{ maxHeight: '80vh' }}>
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm leading-5 text-gray-400">
        <span>
          День: <span className="text-gray-200">{minutesToTimeLabel(dayStart)}–{minutesToTimeLabel(dayEnd)}</span>
        </span>
        <span aria-hidden>·</span>
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

      {unscheduledTasks.length > 0 && (
        <div className="flex-shrink-0 rounded-lg border border-gray-800 bg-gray-900/60 p-2">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium text-gray-300">
              Не распределено ({unscheduledTasks.length})
            </h4>
            <span className="text-right text-xs text-gray-500">Нажмите, чтобы поставить на шкалу</span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {unscheduledTasks.map(({ index, task }) => (
              <li key={`${index}-${task.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (canMutateTimeline(mutationLocked)) onScheduleUnscheduled(index)
                  }}
                  disabled={mutationLocked}
                  className="max-w-full truncate rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-sm text-gray-200 hover:border-blue-400/60 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-700 disabled:hover:bg-gray-800"
                  title={`Поставить «${task.taskText}» на шкалу`}
                  aria-label={`Поставить задачу «${task.taskText}» на шкалу`}
                >
                  + {task.taskText}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline area + hour axis */}
      <div className="flex flex-none gap-2" style={{ height: totalHeight, minHeight: totalHeight }}>
        {/* Hour labels column */}
        <div className="relative h-full w-14 flex-shrink-0" aria-hidden>
          {hourMarks.map(m => (
            <div
              key={m}
              className="absolute right-1 -translate-y-1/2 text-xs leading-none text-gray-400"
              style={{ top: (m - dayStart) * PX_PER_MIN }}
            >
              {minutesToTimeLabel(m)}
            </div>
          ))}
        </div>

        {/* Block area */}
        <div
          className="relative h-full min-w-0 flex-1 rounded-lg border border-gray-800 bg-gray-900/40"
        >
          {/* Hour grid lines */}
          {hourMarks.map(m => (
            <div
              key={m}
              className="absolute left-0 right-0 border-t border-gray-800/70"
              style={{ top: (m - dayStart) * PX_PER_MIN }}
              aria-hidden
            />
          ))}

          {sortedBlocks.map((block, index) => (
            <ScheduleBlock
              key={getScheduleBlockRenderKey(block.id, appliedAnimationKey)}
              block={block}
              dayStart={dayStart}
              dayEnd={dayEnd}
              others={blocks}
              isCompleted={(() => {
                const id = getTaskIdForBlock(block, tasks)
                return id !== null && selectedTasks.has(id)
              })()}
              onSetBlockRange={onSetBlockRange}
              onMove={onMoveBlock}
              onRemove={onRemoveBlock}
              appliedAnimationKey={appliedAnimationKey}
              animationIndex={index}
              mutationLocked={mutationLocked}
            />
          ))}

          {sortedBlocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-gray-500">
              Все задачи в разделе «Не распределено».
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

interface ScheduleBlockProps {
  block: BlockInput
  dayStart: number
  dayEnd: number
  others: BlockInput[]
  isCompleted: boolean
  onSetBlockRange: (blockId: string, startMinutes: number, durationMinutes: number) => void
  onMove: (blockId: string, deltaMinutes: number) => void
  onRemove: (blockId: string) => void
  appliedAnimationKey: number
  animationIndex: number
  mutationLocked: boolean
}

function ScheduleBlock({
  block,
  dayStart,
  dayEnd,
  others,
  isCompleted,
  onSetBlockRange,
  onMove,
  onRemove,
  appliedAnimationKey,
  animationIndex,
  mutationLocked,
}: ScheduleBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState(block.startMinutes)
  const [draftDuration, setDraftDuration] = useState(block.durationMinutes)
  const dragRef = useRef<DragState | null>(null)
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
    setEditing(false)
  }, [mutationLocked])

  const top = (block.startMinutes - dayStart) * PX_PER_MIN
  const height = block.durationMinutes * PX_PER_MIN
  const endLabel = minutesToTimeLabel(block.startMinutes + block.durationMinutes)
  const title = getBlockDisplayTitle(block)
  const blockKind = 'kind' in block ? block.kind : 'task'
  const isVeryShortBlock = block.durationMinutes <= 15
  const isShortBlock = block.durationMinutes <= 30
  const kindClass = blockKind === 'meal'
    ? 'border-orange-400/50 bg-orange-500/20 hover:bg-orange-500/25'
    : blockKind === 'rest'
      ? 'border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/25'
      : blockKind === 'buffer'
        ? 'border-purple-400/50 bg-purple-500/20 hover:bg-purple-500/25'
        : isCompleted
          ? 'border-green-500/40 bg-green-600/20'
          : 'border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/25'

  const tryMove = (nextStart: number) => {
    if (!canMutateTimeline(mutationLocked)) return
    if (nextStart < dayStart) nextStart = dayStart
    if (nextStart + block.durationMinutes > dayEnd) {
      nextStart = dayEnd - block.durationMinutes
    }
    if (
      hasOverlapWithOthers(
        { id: block.id, startMinutes: nextStart, durationMinutes: block.durationMinutes },
        others,
        block.id,
      )
    ) {
      return // ignore — keep last valid
    }
    onSetBlockRange(block.id, nextStart, block.durationMinutes)
  }

  const tryResize = (nextDuration: number) => {
    if (!canMutateTimeline(mutationLocked)) return
    const dur = clamp(snapToStep(nextDuration), MIN_BLOCK_DURATION_MINUTES, dayEnd - block.startMinutes)
    if (
      hasOverlapWithOthers(
        { id: block.id, startMinutes: block.startMinutes, durationMinutes: dur },
        others,
        block.id,
      )
    ) {
      return
    }
    onSetBlockRange(block.id, block.startMinutes, dur)
  }

  // === Pointer handlers (move) ===
  const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canMutateTimeline(mutationLocked)) return
    if (editing) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
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
    const deltaMin = snapToStep(dy / PX_PER_MIN)
    tryMove(state.originalStart + deltaMin)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state || state.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    dragRef.current = null
  }

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
    const deltaMin = snapToStep(dy / PX_PER_MIN)
    tryResize(state.originalDuration + deltaMin)
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
    const step = e.shiftKey ? 60 : 15
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

  const startLabel = minutesToTimeLabel(block.startMinutes)

  return (
    <div
      ref={rootRef}
      role="group"
      tabIndex={0}
      aria-label={`Блок расписания: ${title}, с ${startLabel} до ${endLabel}, длительность ${formatDurationLabel(block.durationMinutes)}.${mutationLocked ? ' Редактирование временно заблокировано.' : ' Enter — редактировать, стрелки — сдвинуть, Delete — убрать.'}`}
      aria-disabled={mutationLocked}
      className={`absolute left-1 right-1 flex flex-col overflow-hidden rounded-md border px-2 py-1 outline-none transition-colors focus:ring-2 focus:ring-blue-400 ${kindClass} ${mutationLocked ? 'cursor-not-allowed opacity-70' : ''} ${appliedAnimationKey > 0 ? 'schedule-block-apply-enter' : ''}`}
      style={{
        top,
        height: Math.max(height, 44),
        touchAction: 'none',
        cursor: mutationLocked ? 'not-allowed' : 'grab',
        animationDelay: appliedAnimationKey > 0 ? `${Math.min(animationIndex, 12) * 70}ms` : undefined,
      }}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onBodyPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {isVeryShortBlock && !editing ? (
          <div className="flex min-w-0 items-center gap-2 leading-tight">
            <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-100 sm:text-sm">
              {title}
            </div>
            <div className="shrink-0 text-xs font-medium text-gray-300">
              {startLabel}–{endLabel}
            </div>
          </div>
        ) : (
          <>
            <div className="truncate text-[15px] font-medium leading-tight text-gray-100">
              {title}
            </div>
            <div className={`${isShortBlock ? 'text-xs leading-tight' : 'text-[13px] leading-5'} text-gray-300`}>
              {blockKind !== 'task' && <span className="mr-1 rounded bg-gray-950/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide">{blockKind === 'meal' ? 'еда' : blockKind === 'rest' ? 'отдых' : 'буфер'}</span>}
              {startLabel}–{endLabel} · {formatDurationLabel(block.durationMinutes)}
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
                step={15}
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
        onPointerCancel={endDrag}
      >
        <div className="h-1 w-8 rounded bg-gray-400/70" />
      </div>
    </div>
  )
}
