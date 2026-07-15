'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson, FetchJsonError, getFetchErrorMessage } from '@/lib/fetch-json'
import type { DailySchedule, DailyScheduleResponse, DailyScheduleV2Block } from '@/lib/daily-schedule'
import type { OpenTask } from '@/lib/types'
import {
  type BlockInput,
  DEFAULT_BLOCK_DURATION_MINUTES,
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  MIN_BLOCK_DURATION_MINUTES,
  autoLayoutBlocks,
  clampBlockToRange,
  computeUnscheduledTaskIndexes,
  createDefaultIdGenerator,
  findFreeSlot,
  getPendingSaveDateChangeAction,
  hasOverlapWithOthers,
  isTaskScheduleBlock,
  isScheduleRequestCurrent,
  reconcileSchedule,
  scheduleEquals,
  type ScheduleRequestContext,
  snapToStep,
} from './schedule-helpers'

export type ScheduleMode = 'list' | 'timeline'

export interface UseDailyScheduleParams {
  selectedDate: string
  tasks: OpenTask[]
  timezone: string
  /** Saves the plan + selectedTasks (existing flow) and resolves true on success. */
  ensureEntrySaved: () => Promise<boolean>
  showMessage: (text: string, duration?: number) => void
}

export interface UseDailyScheduleReturn {
  mode: ScheduleMode
  isEntering: boolean
  isExiting: boolean
  enterTimeline: () => Promise<void>
  exitTimeline: () => Promise<void>
  schedule: DailySchedule | null
  unscheduledTaskIndexes: number[]
  isLoading: boolean
  isSaving: boolean
  error: string
  isDirty: boolean
  setBlockRange: (blockId: string, startMinutes: number, durationMinutes: number) => void
  moveBlockByStep: (blockId: string, deltaMinutes: number) => void
  removeBlock: (blockId: string) => void
  scheduleUnscheduledTask: (taskIndex: number, durationMinutes?: number) => void
  applySavedSchedule: (next: DailySchedule) => void
  appliedAnimationKey: number
}

const DEBOUNCE_MS = 800

type PendingSave = ScheduleRequestContext & {
  schedule: DailySchedule
  timer: ReturnType<typeof setTimeout>
}

function buildEmptySchedule(timezone: string, blocks: BlockInput[]): DailySchedule {
  if (blocks.some(block => 'kind' in block)) {
    return {
      version: 2,
      timezone,
      dayStartMinutes: DEFAULT_DAY_START_MINUTES,
      dayEndMinutes: DEFAULT_DAY_END_MINUTES,
      blocks: blocks.map(block => isTaskScheduleBlock(block) && !('kind' in block) ? { ...block, kind: 'task' as const } : block) as DailyScheduleV2Block[],
    }
  }
  return {
    version: 1,
    timezone,
    dayStartMinutes: DEFAULT_DAY_START_MINUTES,
    dayEndMinutes: DEFAULT_DAY_END_MINUTES,
    blocks: blocks.filter(isTaskScheduleBlock).map(({ id, taskIndex, taskText, startMinutes, durationMinutes }) => ({ id, taskIndex, taskText, startMinutes, durationMinutes })),
  }
}

function scheduleBlockChanged(previous: BlockInput | undefined, next: BlockInput): boolean {
  if (!previous) return true
  if (previous.id !== next.id || previous.startMinutes !== next.startMinutes || previous.durationMinutes !== next.durationMinutes) return true
  if (isTaskScheduleBlock(previous) && isTaskScheduleBlock(next)) {
    return previous.taskIndex !== next.taskIndex || previous.taskText !== next.taskText
  }
  return JSON.stringify(previous) !== JSON.stringify(next)
}

function withScheduleBlocks(current: DailySchedule, blocks: BlockInput[]): DailySchedule {
  if (current.version === 2) {
    return {
      ...current,
      blocks: blocks.map(block => isTaskScheduleBlock(block) && !('kind' in block) ? { ...block, kind: 'task' as const } : block) as DailyScheduleV2Block[],
    }
  }
  return { ...current, blocks: blocks.filter(isTaskScheduleBlock).map(({ id, taskIndex, taskText, startMinutes, durationMinutes }) => ({ id, taskIndex, taskText, startMinutes, durationMinutes })) }
}

export function useDailySchedule({
  selectedDate,
  tasks,
  timezone,
  ensureEntrySaved,
  showMessage,
}: UseDailyScheduleParams): UseDailyScheduleReturn {
  const [mode, setMode] = useState<ScheduleMode>('list')
  const [isEntering, setIsEntering] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [serverSchedule, setServerSchedule] = useState<DailySchedule | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [appliedAnimationKey, setAppliedAnimationKey] = useState(0)

  // Refs to avoid stale closures and dependency churn.
  const tasksRef = useRef<OpenTask[]>(tasks)
  const prevTasksRef = useRef<OpenTask[] | null>(null)
  const scheduleRef = useRef<DailySchedule | null>(schedule)
  const serverScheduleRef = useRef<DailySchedule | null>(serverSchedule)
  const timezoneRef = useRef(timezone)
  const ensureSavedRef = useRef(ensureEntrySaved)
  const showMessageRef = useRef(showMessage)
  const dateRef = useRef(selectedDate)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<PendingSave | null>(null)
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null)
  const revisionRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const isLoadingRef = useRef(true)
  const errorRef = useRef('')
  const idGeneratorRef = useRef(createDefaultIdGenerator())

  scheduleRef.current = schedule
  serverScheduleRef.current = serverSchedule
  tasksRef.current = tasks
  timezoneRef.current = timezone
  ensureSavedRef.current = ensureEntrySaved
  showMessageRef.current = showMessage

  const getCurrentRequestContext = useCallback((): ScheduleRequestContext => ({
    date: dateRef.current,
    revision: revisionRef.current,
  }), [])

  const isCurrentContext = useCallback(
    (context: ScheduleRequestContext) => isScheduleRequestCurrent(context, getCurrentRequestContext()),
    [getCurrentRequestContext],
  )

  const isDirty = useMemo(
    () => !scheduleEquals(schedule, serverSchedule),
    [schedule, serverSchedule],
  )

  const unscheduledTaskIndexes = useMemo(
    () =>
      schedule
        ? computeUnscheduledTaskIndexes(schedule.blocks, tasks)
        : tasks.map((_, i) => i),
    [schedule, tasks],
  )

  // === Save logic ===

  const performSave = useCallback(async (
    next: DailySchedule,
    context: ScheduleRequestContext,
  ): Promise<boolean> => {
    const isCurrent = () => isCurrentContext(context)
    if (isCurrent()) {
      setError('')
      errorRef.current = ''
      setIsSaving(true)
    }
    try {
      const response = await fetchJson<DailyScheduleResponse>('/api/daily/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: context.date, schedule: next }),
      })
      const newServer = response.schedule ?? next
      if (isCurrent()) {
        setServerSchedule(newServer)
        serverScheduleRef.current = newServer
      }
      return true
    } catch (err) {
      if (err instanceof FetchJsonError && err.status === 401) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
        return false
      }
      const msg = getFetchErrorMessage(err, 'не удалось сохранить расписание')
      if (isCurrent()) {
        setError(msg)
        errorRef.current = msg
        showMessageRef.current(`❌ ${msg}`)
      }
      return false
    } finally {
      if (isCurrent()) {
        setIsSaving(false)
      }
    }
  }, [isCurrentContext])

  const runSave = useCallback((next: DailySchedule, context: ScheduleRequestContext): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const previous = inFlightSaveRef.current
      if (previous) {
        await previous.catch(() => undefined)
      }
      return performSave(next, context)
    }
    const promise = run().finally(() => {
      if (inFlightSaveRef.current === promise) {
        inFlightSaveRef.current = null
      }
    })
    inFlightSaveRef.current = promise
    return promise
  }, [performSave])

  const clearPendingSaveTimer = useCallback((): PendingSave | null => {
    const pending = pendingSaveRef.current
    if (pending) {
      clearTimeout(pending.timer)
      pendingSaveRef.current = null
      saveTimerRef.current = null
    } else if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return pending
  }, [])

  const scheduleSave = useCallback(
    (next: DailySchedule) => {
      clearPendingSaveTimer()
      const context = getCurrentRequestContext()
      const timer = setTimeout(() => {
        saveTimerRef.current = null
        const pending = pendingSaveRef.current
        pendingSaveRef.current = null
        void runSave(pending?.schedule ?? next, pending ?? context)
      }, DEBOUNCE_MS)
      saveTimerRef.current = timer
      pendingSaveRef.current = { ...context, schedule: next, timer }
    },
    [clearPendingSaveTimer, getCurrentRequestContext, runSave],
  )

  const flushPendingSave = useCallback(async (): Promise<boolean | null> => {
    const pending = clearPendingSaveTimer()
    if (!pending) return null
    return runSave(pending.schedule, pending)
  }, [clearPendingSaveTimer, runSave])

  const flushSave = useCallback(async (): Promise<boolean> => {
    const pendingResult = await flushPendingSave()
    if (pendingResult === false && pendingSaveRef.current === null) {
      return false
    }
    if (inFlightSaveRef.current) {
      const ok = await inFlightSaveRef.current.catch(() => false)
      if (!ok && errorRef.current) return false
      inFlightSaveRef.current = null
    }
    const current = scheduleRef.current
    const server = serverScheduleRef.current
    if (current && !scheduleEquals(current, server)) {
      return runSave(current, getCurrentRequestContext())
    }
    return true
  }, [flushPendingSave, getCurrentRequestContext, runSave])

  // === Load on date change ===

  useEffect(() => {
    const nextContext = { date: selectedDate, revision: revisionRef.current + 1 }
    const pending = pendingSaveRef.current
    if (getPendingSaveDateChangeAction(pending, nextContext) === 'flush-previous-date') {
      void flushPendingSave()
    }

    revisionRef.current = nextContext.revision
    dateRef.current = selectedDate
    setMode('list')
    setSchedule(null)
    scheduleRef.current = null
    setServerSchedule(null)
    serverScheduleRef.current = null
    setHasLoaded(false)
    hasLoadedRef.current = false
    prevTasksRef.current = null
    setError('')
    errorRef.current = ''
    setIsLoading(true)
    isLoadingRef.current = true

    let cancelled = false
    const loadContext = getCurrentRequestContext()
    void (async () => {
      try {
        const response = await fetchJson<DailyScheduleResponse>(
          `/api/daily/schedule?date=${encodeURIComponent(selectedDate)}`,
        )
        if (cancelled || !isCurrentContext(loadContext)) return
        if (response.schedule) {
          setSchedule(response.schedule)
          scheduleRef.current = response.schedule
          setServerSchedule(response.schedule)
          serverScheduleRef.current = response.schedule
        }
      } catch (err) {
        if (cancelled || !isCurrentContext(loadContext)) return
        if (err instanceof FetchJsonError && err.status === 401) {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
          return
        }
        const msg = getFetchErrorMessage(err, 'не удалось загрузить расписание')
        setError(msg)
        errorRef.current = msg
      } finally {
        if (!cancelled && isCurrentContext(loadContext)) {
          setIsLoading(false)
          isLoadingRef.current = false
          setHasLoaded(true)
          hasLoadedRef.current = true
        }
      }
    })()

    return () => {
      cancelled = true
      const pendingOnCleanup = pendingSaveRef.current
      if (pendingOnCleanup) {
        void flushPendingSave()
      }
    }
  }, [flushPendingSave, getCurrentRequestContext, isCurrentContext, selectedDate])

  // === Reconcile on tasks change ===

  useEffect(() => {
    if (!hasLoaded) return
    // First run after load: establish baseline and self-heal stale blocks
    // (e.g. schedule saved with an older plan that has since changed).
    if (prevTasksRef.current === null) {
      prevTasksRef.current = tasks
      const current = scheduleRef.current
      if (current && current.blocks.length > 0) {
        const { blocks } = reconcileSchedule(current.blocks, [], tasks)
        const changed =
          blocks.length !== current.blocks.length ||
          blocks.some((b, i) => scheduleBlockChanged(current.blocks[i], b))
        if (changed) {
          const nextSchedule = withScheduleBlocks(current, blocks)
          setSchedule(nextSchedule)
          scheduleRef.current = nextSchedule
          scheduleSave(nextSchedule)
        }
      }
      return
    }

    const prev = prevTasksRef.current
    const next = tasks
    if (prev === next) return
    prevTasksRef.current = next

    const current = scheduleRef.current
    if (!current) return // нет расписания — auto-layout произойдёт при входе.

    const { blocks } = reconcileSchedule(current.blocks, prev, next)
    const changed =
      blocks.length !== current.blocks.length ||
      blocks.some((b, i) => scheduleBlockChanged(current.blocks[i], b))

    if (changed) {
      const nextSchedule = withScheduleBlocks(current, blocks)
      setSchedule(nextSchedule)
      scheduleRef.current = nextSchedule
      scheduleSave(nextSchedule)
    }
  }, [tasks, hasLoaded, scheduleSave])

  // === Best-effort flush on unmount ===

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        const pending = clearPendingSaveTimer()
        if (pending) {
          void runSave(pending.schedule, pending)
        }
      }
      const current = scheduleRef.current
      const server = serverScheduleRef.current
      if (current && !scheduleEquals(current, server)) {
        void runSave(current, getCurrentRequestContext())
      }
    }
  }, [clearPendingSaveTimer, getCurrentRequestContext, runSave])

  // === Public actions ===

  const enterTimeline = useCallback(async () => {
    if (tasksRef.current.length === 0) return
    if (!hasLoadedRef.current || isLoadingRef.current) {
      showMessageRef.current('⏳ Дождитесь загрузки расписания перед переходом к шкале')
      return
    }
    if (errorRef.current) {
      showMessageRef.current('❌ Сначала обновите страницу или дождитесь успешной загрузки расписания')
      return
    }
    setIsEntering(true)
    try {
      const ok = await ensureSavedRef.current()
      if (!ok) return

      if (!scheduleRef.current) {
        const { blocks } = autoLayoutBlocks(
          tasksRef.current,
          DEFAULT_DAY_START_MINUTES,
          DEFAULT_DAY_END_MINUTES,
          { generateId: idGeneratorRef.current },
        )
        const next = buildEmptySchedule(timezoneRef.current, blocks)
        setSchedule(next)
        scheduleRef.current = next
        setServerSchedule(null)
        serverScheduleRef.current = null
        prevTasksRef.current = tasksRef.current
        scheduleSave(next)
      } else {
        prevTasksRef.current = tasksRef.current
      }
      setMode('timeline')
    } finally {
      setIsEntering(false)
    }
  }, [scheduleSave])

  const exitTimeline = useCallback(async () => {
    setIsExiting(true)
    try {
      const ok = await flushSave()
      if (ok) {
        setMode('list')
      }
    } finally {
      setIsExiting(false)
    }
  }, [flushSave])

  const setBlockRange = useCallback(
    (blockId: string, startMinutes: number, durationMinutes: number) => {
      const current = scheduleRef.current
      if (!current) return
      const block = current.blocks.find(b => b.id === blockId)
      if (!block) return
      const clamped = clampBlockToRange(
        { startMinutes, durationMinutes },
        current.dayStartMinutes,
        current.dayEndMinutes,
      )
      // Не допускаем overlap — оставляем последнее валидное значение.
      if (hasOverlapWithOthers({ id: blockId, ...clamped }, current.blocks, blockId)) {
        return
      }
      const nextBlocks = current.blocks.map(b =>
        b.id === blockId ? { ...b, ...clamped } : b,
      )
      const next = withScheduleBlocks(current, nextBlocks)
      setSchedule(next)
      scheduleRef.current = next
      scheduleSave(next)
    },
    [scheduleSave],
  )

  const moveBlockByStep = useCallback(
    (blockId: string, deltaMinutes: number) => {
      const current = scheduleRef.current
      if (!current) return
      const block = current.blocks.find(b => b.id === blockId)
      if (!block) return
      const stepped = snapToStep(deltaMinutes)
      if (stepped === 0) return
      setBlockRange(blockId, block.startMinutes + stepped, block.durationMinutes)
    },
    [setBlockRange],
  )

  const removeBlock = useCallback(
    (blockId: string) => {
      const current = scheduleRef.current
      if (!current) return
      const nextBlocks = current.blocks.filter(b => b.id !== blockId)
      if (nextBlocks.length === current.blocks.length) return
      const next = withScheduleBlocks(current, nextBlocks)
      setSchedule(next)
      scheduleRef.current = next
      scheduleSave(next)
    },
    [scheduleSave],
  )

  const scheduleUnscheduledTask = useCallback(
    (taskIndex: number, durationMinutes: number = DEFAULT_BLOCK_DURATION_MINUTES) => {
      const current = scheduleRef.current
      if (!current) return
      const task = tasksRef.current[taskIndex]
      if (!task) return
      const duration = Math.max(MIN_BLOCK_DURATION_MINUTES, snapToStep(durationMinutes))
      const slot = findFreeSlot(
        duration,
        current.dayStartMinutes,
        current.dayEndMinutes,
        current.blocks,
      )
      if (slot === null) {
        showMessageRef.current('ℹ️ Нет свободного слота на шкале — увеличьте диапазон или сдвиньте блоки')
        return
      }
      const newBlock: BlockInput = {
        id: idGeneratorRef.current(),
        ...(current.version === 2 ? { kind: 'task' as const } : {}),
        taskIndex: taskIndex + 1,
        taskText: task.taskText.trim(),
        startMinutes: slot,
        durationMinutes: duration,
      }
      const next = withScheduleBlocks(current, [...current.blocks, newBlock])
      setSchedule(next)
      scheduleRef.current = next
      scheduleSave(next)
    },
    [scheduleSave],
  )

  const applySavedSchedule = useCallback((next: DailySchedule) => {
    clearPendingSaveTimer()
    setSchedule(next)
    scheduleRef.current = next
    setServerSchedule(next)
    serverScheduleRef.current = next
    prevTasksRef.current = tasksRef.current
    setMode('timeline')
    setAppliedAnimationKey(value => value + 1)
    showMessageRef.current('✅ Расписание размещено на шкале')
  }, [clearPendingSaveTimer])

  return {
    mode,
    isEntering,
    isExiting,
    enterTimeline,
    exitTimeline,
    schedule,
    unscheduledTaskIndexes,
    isLoading,
    isSaving,
    error,
    isDirty,
    setBlockRange,
    moveBlockByStep,
    removeBlock,
    scheduleUnscheduledTask,
    applySavedSchedule,
    appliedAnimationKey,
  }
}
