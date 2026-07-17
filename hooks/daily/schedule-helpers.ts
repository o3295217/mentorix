// Pure helpers for the daily schedule timeline feature.
// No React, no DOM, no Node-only APIs — safe for tests and the client bundle.

import type { DailySchedule, DailyScheduleBlock, DailyScheduleBlockCategory, DailyScheduleLoadSummary, DailyScheduleV2Block } from '@/lib/daily-schedule'

export const TIME_STEP_MINUTES = 15
export const DEFAULT_DAY_START_MINUTES = 6 * 60 // 06:00
export const DEFAULT_DAY_END_MINUTES = 24 * 60 // 24:00 (= 1440)
export const DEFAULT_BLOCK_DURATION_MINUTES = 60
export const MIN_BLOCK_DURATION_MINUTES = 15
export const DEFAULT_GAP_MINUTES = 15
export const MAX_BLOCKS = 100

export type TaskLike = { taskText: string }
export type BlockInput = DailyScheduleBlock
export type RangeLike = Pick<DailyScheduleBlock, 'startMinutes' | 'durationMinutes'>

export function isTaskScheduleBlock(block: BlockInput): block is BlockInput & { taskIndex: number; taskText: string } {
  return !('kind' in block) || block.kind === 'task'
}

export function getBlockDisplayTitle(block: BlockInput): string {
  if ('kind' in block && block.kind !== 'task') return block.title
  return block.taskText
}

// === Numeric primitives ===

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

export function snapToStep(value: number, step: number = TIME_STEP_MINUTES): number {
  return Math.round(value / step) * step
}

export function snapDownToStep(value: number, step: number = TIME_STEP_MINUTES): number {
  return Math.floor(value / step) * step
}

// === Time formatting ===

export function minutesToTimeLabel(minutes: number): string {
  const clamped = clamp(minutes, 0, 24 * 60)
  const hours = Math.floor(clamped / 60)
  const mins = Math.round(clamped) % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function timeLabelToMinutes(label: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label.trim())
  if (!match) return -1
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return -1
  if (hours < 0 || hours > 24 || mins < 0 || mins > 59) return -1
  if (hours === 24 && mins !== 0) return -1
  return hours * 60 + mins
}

// <input type="time"> cannot represent 24:00 in most browsers; cap editor value at 23:59.
export function minutesToTimeInputValue(minutes: number): string {
  return minutesToTimeLabel(clamp(minutes, 0, 23 * 60 + 59))
}

export function formatDurationLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`
  if (hours > 0) return `${hours} ч`
  return `${mins} мин`
}

const SCHEDULE_CATEGORIES: DailyScheduleBlockCategory[] = ['main', 'operational', 'travel', 'personal', 'meal', 'rest', 'buffer']

function percent(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0
  return Math.round((part / total) * 10000) / 100
}

function getPlanningStartMinutes(schedule: DailySchedule): number {
  return schedule.version === 3 ? schedule.planningStartMinutes : schedule.dayStartMinutes
}

function getActivityEndMinutes(schedule: DailySchedule): number {
  return schedule.version === 3 ? schedule.activityEndMinutes : schedule.dayEndMinutes
}

function getWorkEndMinutes(schedule: DailySchedule): number {
  return schedule.version === 3 ? schedule.workEndMinutes : schedule.dayEndMinutes
}

export function getScheduleBoundaryMinutes(schedule: DailySchedule): { planningStartMinutes: number; workEndMinutes: number; activityEndMinutes: number } {
  return {
    planningStartMinutes: getPlanningStartMinutes(schedule),
    workEndMinutes: getWorkEndMinutes(schedule),
    activityEndMinutes: getActivityEndMinutes(schedule),
  }
}

export function getScheduleBlockCategory(block: DailyScheduleBlock): DailyScheduleBlockCategory {
  if ('category' in block) return block.category
  if ('kind' in block && block.kind !== 'task') return block.kind
  return 'main'
}

function getClippedDuration(block: RangeLike, intervalStart: number, intervalEnd: number): number {
  const start = Math.max(block.startMinutes, intervalStart)
  const end = Math.min(getBlockEnd(block), intervalEnd)
  return Math.max(0, Math.min(24 * 60, end - start))
}

function getLoadLevel(scheduledPercent: number): DailyScheduleLoadSummary['loadLevel'] {
  if (scheduledPercent === 0) return 'empty'
  if (scheduledPercent < 40) return 'light'
  if (scheduledPercent < 70) return 'balanced'
  if (scheduledPercent < 90) return 'busy'
  return 'overloaded'
}

function getLoadRecommendation(loadLevel: DailyScheduleLoadSummary['loadLevel']): string {
  switch (loadLevel) {
    case 'empty': return 'Расписание пока пустое: добавьте главные задачи и обязательные блоки.'
    case 'light': return 'Нагрузка лёгкая: можно добавить важную задачу или оставить запас.'
    case 'balanced': return 'Нагрузка сбалансирована: есть план и буферы на непредвиденное.'
    case 'busy': return 'День плотный: проверьте буферы и зафиксированные обязательства.'
    case 'overloaded': return 'День перегружен: перенесите часть задач или увеличьте буферы.'
  }
}

export function computeClientScheduleLoadSummary(schedule: DailySchedule): DailyScheduleLoadSummary {
  const activeStart = getPlanningStartMinutes(schedule)
  const activeEnd = getActivityEndMinutes(schedule)
  const workStart = activeStart
  const workEnd = getWorkEndMinutes(schedule)
  const activeAvailable = Math.max(0, activeEnd - activeStart)
  const workAvailable = Math.max(0, workEnd - workStart)
  const categoryMinutes = Object.fromEntries(SCHEDULE_CATEGORIES.map(category => [category, 0])) as Record<DailyScheduleBlockCategory, number>
  const categoryWorkMinutes = Object.fromEntries(SCHEDULE_CATEGORIES.map(category => [category, 0])) as Record<DailyScheduleBlockCategory, number>

  for (const block of schedule.blocks) {
    const category = getScheduleBlockCategory(block)
    categoryMinutes[category] += getClippedDuration(block, activeStart, activeEnd)
    categoryWorkMinutes[category] += getClippedDuration(block, workStart, workEnd)
  }

  const scheduledMinutes = SCHEDULE_CATEGORIES.reduce((sum, category) => sum + categoryMinutes[category], 0)
  const workScheduledMinutes = SCHEDULE_CATEGORIES.reduce((sum, category) => sum + categoryWorkMinutes[category], 0)
  const scheduledPercent = percent(scheduledMinutes, activeAvailable)
  const loadLevel = getLoadLevel(scheduledPercent)
  return {
    activeInterval: { startMinutes: activeStart, endMinutes: activeEnd, availableMinutes: activeAvailable },
    workInterval: { startMinutes: workStart, endMinutes: workEnd, availableMinutes: workAvailable },
    scheduledMinutes,
    unscheduledMinutes: Math.max(0, activeAvailable - scheduledMinutes),
    scheduledPercent,
    unscheduledPercent: percent(Math.max(0, activeAvailable - scheduledMinutes), activeAvailable),
    workScheduledMinutes,
    workUnscheduledMinutes: Math.max(0, workAvailable - workScheduledMinutes),
    workScheduledPercent: percent(workScheduledMinutes, workAvailable),
    categories: SCHEDULE_CATEGORIES.reduce((acc, category) => {
      acc[category] = {
        minutes: categoryMinutes[category],
        percent: percent(categoryMinutes[category], activeAvailable),
        workMinutes: categoryWorkMinutes[category],
        workPercent: percent(categoryWorkMinutes[category], workAvailable),
      }
      return acc
    }, {} as DailyScheduleLoadSummary['categories']),
    loadLevel,
    recommendation: getLoadRecommendation(loadLevel),
  }
}

// === Block geometry ===

export function getBlockEnd(block: RangeLike): number {
  return block.startMinutes + block.durationMinutes
}

export function blocksOverlap(a: RangeLike, b: RangeLike): boolean {
  return a.startMinutes < getBlockEnd(b) && b.startMinutes < getBlockEnd(a)
}

export function isBlockInRange(block: RangeLike, dayStart: number, dayEnd: number): boolean {
  return block.startMinutes >= dayStart && getBlockEnd(block) <= dayEnd
}

export function clampBlockToRange(
  block: RangeLike,
  dayStart: number,
  dayEnd: number,
): { startMinutes: number; durationMinutes: number } {
  const span = Math.max(0, dayEnd - dayStart)
  const maxDuration = Math.max(MIN_BLOCK_DURATION_MINUTES, span)
  const duration = clamp(snapToStep(block.durationMinutes), MIN_BLOCK_DURATION_MINUTES, maxDuration)
  const start = clamp(
    snapToStep(block.startMinutes),
    dayStart,
    Math.max(dayStart, dayEnd - duration),
  )
  return { startMinutes: start, durationMinutes: duration }
}

export function hasOverlapWithOthers(
  block: RangeLike & { id?: string },
  others: BlockInput[],
  ignoreId?: string,
): boolean {
  return others.some(other => {
    if (ignoreId && other.id === ignoreId) return false
    if (block.id && other.id === block.id) return false
    return blocksOverlap(block, other)
  })
}

// === Atomic cascade edits ===

export type CascadeScheduleEdit =
  | { type: 'move'; blockId: string; startMinutes: number }
  | { type: 'resize'; blockId: string; durationMinutes: number; startMinutes?: number }
  | { type: 'set'; blockId: string; startMinutes: number; durationMinutes: number }
  | { type: 'insert'; block: BlockInput; startMinutes: number; durationMinutes?: number }

export type CascadeScheduleFailureReason =
  | 'block-not-found'
  | 'duplicate-block-id'
  | 'fixed-collision'
  | 'invalid-input'
  | 'overflow'
  | 'structural-invalid'

export type CascadeScheduleEditResult =
  | { ok: true; schedule: DailySchedule; changedBlockIds: string[] }
  | {
      ok: false
      reason: CascadeScheduleFailureReason
      message: string
      blockId?: string
      conflictingBlockId?: string
      limitMinutes?: number
    }

type CascadeScheduleFailureResult = Extract<CascadeScheduleEditResult, { ok: false }>

type StructureValidationResult =
  | { ok: true }
  | { ok: false; reason: CascadeScheduleFailureReason; message: string; blockId?: string; conflictingBlockId?: string }

function isFixedScheduleBlock(block: BlockInput): boolean {
  return 'isFixed' in block && block.isFixed === true
}

function isTimeStep(value: number): boolean {
  return Number.isInteger(value) && value % TIME_STEP_MINUTES === 0
}

function getTimelineEnd(schedule: DailySchedule): number {
  return schedule.version === 3 ? Math.min(schedule.dayEndMinutes, schedule.activityEndMinutes) : schedule.dayEndMinutes
}

function cloneBlock(block: BlockInput): BlockInput {
  return { ...block }
}

function cloneScheduleWithBlocks(schedule: DailySchedule, blocks: BlockInput[]): DailySchedule {
  return { ...schedule, blocks: blocks.map(cloneBlock) } as DailySchedule
}

function sortBlocksByTimeline(blocks: BlockInput[], order: Map<string, number>): BlockInput[] {
  return [...blocks].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      getBlockEnd(a) - getBlockEnd(b) ||
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
  )
}

function validateTimelineStructure(schedule: DailySchedule): StructureValidationResult {
  const dayStart = schedule.dayStartMinutes
  const dayEnd = getTimelineEnd(schedule)
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart) {
    return { ok: false, reason: 'invalid-input', message: 'Schedule day range is invalid' }
  }
  if (!isTimeStep(dayStart) || !isTimeStep(dayEnd)) {
    return { ok: false, reason: 'invalid-input', message: 'Schedule day range must use 15 minute step' }
  }

  const ids = new Set<string>()
  for (const block of schedule.blocks) {
    if (!block.id || ids.has(block.id)) {
      return { ok: false, reason: 'invalid-input', message: 'Schedule block ids must be unique and non-empty', blockId: block.id }
    }
    ids.add(block.id)
    if (!Number.isFinite(block.startMinutes) || !Number.isFinite(block.durationMinutes)) {
      return { ok: false, reason: 'invalid-input', message: 'Schedule block time values must be finite', blockId: block.id }
    }
    if (!isTimeStep(block.startMinutes) || !isTimeStep(block.durationMinutes)) {
      return { ok: false, reason: 'invalid-input', message: 'Schedule blocks must use 15 minute step', blockId: block.id }
    }
    if (block.durationMinutes < MIN_BLOCK_DURATION_MINUTES) {
      return { ok: false, reason: 'invalid-input', message: 'Schedule block duration is too short', blockId: block.id }
    }
    if (!isBlockInRange(block, dayStart, dayEnd)) {
      return { ok: false, reason: 'invalid-input', message: 'Schedule block is outside day range', blockId: block.id }
    }
  }

  const sortedBlocks = sortBlocksByTimeline(schedule.blocks, new Map(schedule.blocks.map((block, index) => [block.id, index])))
  for (let index = 1; index < sortedBlocks.length; index += 1) {
    const previous = sortedBlocks[index - 1]
    const current = sortedBlocks[index]
    if (blocksOverlap(previous, current)) {
      return {
        ok: false,
        reason: 'invalid-input',
        message: 'Schedule blocks overlap',
        blockId: previous.id,
        conflictingBlockId: current.id,
      }
    }
  }

  return { ok: true }
}

function makeOverflowResult(blockId: string, limitMinutes: number): CascadeScheduleEditResult {
  return {
    ok: false,
    reason: 'overflow',
    message: 'Cascade edit would move a block outside day/activity range',
    blockId,
    limitMinutes,
  }
}

function makeFixedCollisionResult(blockId: string, fixedBlockId: string): CascadeScheduleEditResult {
  return {
    ok: false,
    reason: 'fixed-collision',
    message: 'Cascade edit would intersect a fixed block',
    blockId,
    conflictingBlockId: fixedBlockId,
  }
}

function buildAnchorBlock(schedule: DailySchedule, edit: CascadeScheduleEdit): CascadeScheduleFailureResult | { ok: true; anchor: BlockInput; restBlocks: BlockInput[] } {
  if (edit.type === 'insert') {
    if (schedule.blocks.some(block => block.id === edit.block.id)) {
      return { ok: false, reason: 'duplicate-block-id', message: 'Inserted block id already exists', blockId: edit.block.id }
    }
    const duration = edit.durationMinutes ?? edit.block.durationMinutes
    if (!Number.isFinite(edit.startMinutes) || !Number.isFinite(duration)) {
      return { ok: false, reason: 'invalid-input', message: 'Requested block time values must be finite', blockId: edit.block.id }
    }
    return {
      ok: true,
      anchor: {
        ...edit.block,
        startMinutes: snapToStep(edit.startMinutes),
        durationMinutes: Math.max(MIN_BLOCK_DURATION_MINUTES, snapToStep(duration)),
      },
      restBlocks: schedule.blocks.map(cloneBlock),
    }
  }

  const block = schedule.blocks.find(candidate => candidate.id === edit.blockId)
  if (!block) {
    return { ok: false, reason: 'block-not-found', message: 'Schedule block was not found', blockId: edit.blockId }
  }

  let startMinutes = block.startMinutes
  let durationMinutes = block.durationMinutes
  if (edit.type === 'move') {
    startMinutes = edit.startMinutes
  } else if (edit.type === 'resize') {
    startMinutes = edit.startMinutes ?? block.startMinutes
    durationMinutes = edit.durationMinutes
  } else {
    startMinutes = edit.startMinutes
    durationMinutes = edit.durationMinutes
  }

  if (!Number.isFinite(startMinutes) || !Number.isFinite(durationMinutes)) {
    return { ok: false, reason: 'invalid-input', message: 'Requested block time values must be finite', blockId: block.id }
  }

  return {
    ok: true,
    anchor: {
      ...block,
      startMinutes: snapToStep(startMinutes),
      durationMinutes: Math.max(MIN_BLOCK_DURATION_MINUTES, snapToStep(durationMinutes)),
    },
    restBlocks: schedule.blocks.filter(candidate => candidate.id !== block.id).map(cloneBlock),
  }
}

/**
 * Atomically applies a manual timeline edit with cascading displacement.
 *
 * Rules:
 * - v1/v2 blocks (without isFixed) are flexible; v3 fixed blocks are hard barriers.
 * - The edited block is removed from collision calculation and placed at the requested
 *   snapped start; if it is fixed, the flag is preserved and it may still be moved explicitly.
 * - Flexible blocks ending after the anchor start keep their duration and original order;
 *   only blocks intersecting the moving cursor are shifted down, so existing gaps absorb shifts.
 * - Other fixed blocks cannot move or be intersected. Overflow past dayEnd/activityEnd fails.
 * - On failure no partial schedule is returned.
 */
export function applyCascadeScheduleEdit(schedule: DailySchedule, edit: CascadeScheduleEdit): CascadeScheduleEditResult {
  const initialValidation = validateTimelineStructure(schedule)
  if (!initialValidation.ok) return initialValidation

  const dayStart = schedule.dayStartMinutes
  const dayEnd = getTimelineEnd(schedule)
  const order = new Map(schedule.blocks.map((block, index) => [block.id, index]))
  const anchorResult = buildAnchorBlock(schedule, edit)
  if (!anchorResult.ok) return anchorResult

  const { anchor, restBlocks } = anchorResult
  if (anchor.startMinutes < dayStart || getBlockEnd(anchor) > dayEnd) {
    return makeOverflowResult(anchor.id, dayEnd)
  }

  const fixedBlocks = restBlocks.filter(isFixedScheduleBlock)
  const fixedAnchorConflict = fixedBlocks.find(block => blocksOverlap(anchor, block))
  if (fixedAnchorConflict) return makeFixedCollisionResult(anchor.id, fixedAnchorConflict.id)

  const flexibleBlocks = restBlocks
    .filter(block => !isFixedScheduleBlock(block))
    .sort((a, b) => a.startMinutes - b.startMinutes || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) || a.id.localeCompare(b.id))

  const arrangedFlexibleBlocks: BlockInput[] = []
  let cursor = getBlockEnd(anchor)
  for (const block of flexibleBlocks) {
    if (getBlockEnd(block) <= anchor.startMinutes) {
      arrangedFlexibleBlocks.push(block)
      continue
    }

    const nextStart = block.startMinutes < cursor ? cursor : block.startMinutes
    const nextBlock = nextStart === block.startMinutes ? block : { ...block, startMinutes: nextStart }
    if (getBlockEnd(nextBlock) > dayEnd) return makeOverflowResult(nextBlock.id, dayEnd)
    const fixedConflict = fixedBlocks.find(fixedBlock => blocksOverlap(nextBlock, fixedBlock))
    if (fixedConflict) return makeFixedCollisionResult(nextBlock.id, fixedConflict.id)
    arrangedFlexibleBlocks.push(nextBlock)
    cursor = getBlockEnd(nextBlock)
  }

  const nextBlocks = sortBlocksByTimeline([anchor, ...fixedBlocks, ...arrangedFlexibleBlocks], order)
  const nextSchedule = cloneScheduleWithBlocks(schedule, nextBlocks)
  const finalValidation = validateTimelineStructure(nextSchedule)
  if (!finalValidation.ok) {
    return {
      ...finalValidation,
      reason: finalValidation.reason === 'invalid-input' ? 'structural-invalid' : finalValidation.reason,
    }
  }

  const beforeById = new Map(schedule.blocks.map(block => [block.id, block]))
  const changedBlockIds = nextBlocks
    .filter(block => {
      const before = beforeById.get(block.id)
      return !before || before.startMinutes !== block.startMinutes || before.durationMinutes !== block.durationMinutes
    })
    .map(block => block.id)

  return { ok: true, schedule: nextSchedule, changedBlockIds }
}

// === Auto-layout ===

export type IdGenerator = () => string

export function createDefaultIdGenerator(prefix = 'block'): IdGenerator {
  let counter = 0
  return () => {
    counter += 1
    const stamp = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 8)
    return `${prefix}-${stamp}-${rand}-${counter}`
  }
}

export interface AutoLayoutOptions {
  defaultDuration?: number
  minDuration?: number
  gap?: number
  generateId?: IdGenerator
}

export interface AutoLayoutResult {
  blocks: BlockInput[]
  unscheduledIndexes: number[]
}

/**
 * Размещает задачи последовательно на шкале [dayStart, dayEnd].
 * Стартовая эвристика: defaultDuration (60 мин) на задачу + gap (15 мин) между ними.
 * Если не помещается — сначала убираем gap, потом сжимаем длительность до minDuration (15 мин).
 * Невместившиеся задачи остаются нераспределёнными.
 */
export function autoLayoutBlocks(
  tasks: TaskLike[],
  dayStart: number,
  dayEnd: number,
  options: AutoLayoutOptions = {},
): AutoLayoutResult {
  const total = tasks.length
  if (total === 0) return { blocks: [], unscheduledIndexes: [] }

  const span = dayEnd - dayStart
  if (span < MIN_BLOCK_DURATION_MINUTES) {
    return { blocks: [], unscheduledIndexes: tasks.map((_, index) => index) }
  }

  const ideal = options.defaultDuration ?? DEFAULT_BLOCK_DURATION_MINUTES
  const min = options.minDuration ?? MIN_BLOCK_DURATION_MINUTES
  const idealGap = options.gap ?? DEFAULT_GAP_MINUTES
  const generateId = options.generateId ?? createDefaultIdGenerator()

  const maxFit = Math.min(total, MAX_BLOCKS, Math.floor(span / min))
  if (maxFit <= 0) {
    return { blocks: [], unscheduledIndexes: tasks.map((_, index) => index) }
  }

  const fitCount = maxFit
  let duration = ideal
  let gap = idealGap

  // Сначала сжимаем gap, затем длительность — пока не поместится.
  while (duration * fitCount + gap * (fitCount - 1) > span) {
    if (gap > 0) {
      gap = 0
      continue
    }
    if (duration > min) {
      duration = snapDownToStep(
        Math.max(min, Math.floor((span - gap * (fitCount - 1)) / fitCount)),
        TIME_STEP_MINUTES,
      )
      if (duration < min) duration = min
      break
    }
    break
  }

  // Подстраховка: если из-за округлений всё ещё не помещается, жёстко режем до min.
  if (duration * fitCount + gap * (fitCount - 1) > span) {
    duration = min
    gap = 0
  }

  const blocks: BlockInput[] = []
  let cursor = dayStart
  for (let i = 0; i < fitCount; i++) {
    const task = tasks[i]
    const isLast = i === fitCount - 1
    blocks.push({
      id: generateId(),
      taskIndex: i + 1,
      taskText: task.taskText.trim(),
      startMinutes: cursor,
      durationMinutes: duration,
    })
    cursor += duration + (isLast ? 0 : gap)
  }

  const unscheduledIndexes: number[] = []
  for (let i = fitCount; i < total; i++) unscheduledIndexes.push(i)

  return { blocks, unscheduledIndexes }
}

// === Reconcile (plan edit/delete/reorder) ===

type OccurrenceKey = string

function normalizeTaskText(text: string): string {
  return text.trim().toLowerCase()
}

function buildOccurrenceKeys(tasks: TaskLike[]): OccurrenceKey[] {
  const counts = new Map<string, number>()
  return tasks.map(task => {
    const base = normalizeTaskText(task.taskText)
    const next = (counts.get(base) ?? 0) + 1
    counts.set(base, next)
    return `${base}#${next}`
  })
}

export interface ReconcileResult {
  blocks: BlockInput[]
  removedBlockIds: string[]
}

/**
 * Синхронизирует блоки расписания с актуальным составом задач плана.
 * - Сопоставление по (нормализованный текст + номер вхождения), чтобы корректно
 *   обрабатывать дубликаты текстов и переупорядочивание.
 * - Блок, для которого нет соответствующей задачи, удаляется.
 * - Новые задачи не размещаются автоматически — они попадают в «Не распределено».
 * - id блока сохраняются для совпадающих задач.
 */
export function reconcileSchedule(
  prevBlocks: BlockInput[],
  prevTasks: TaskLike[],
  currentTasks: TaskLike[],
): ReconcileResult {
  const serviceBlocks = prevBlocks.filter(block => !isTaskScheduleBlock(block))
  const taskBlocks = prevBlocks.filter(isTaskScheduleBlock)
  if (currentTasks.length === 0) {
    return { blocks: serviceBlocks, removedBlockIds: taskBlocks.map(b => b.id) }
  }

  const prevKeys = buildOccurrenceKeys(prevTasks)
  const currentKeys = buildOccurrenceKeys(currentTasks)

  const availableByKey = new Map<OccurrenceKey, number[]>()
  currentKeys.forEach((key, index) => {
    const list = availableByKey.get(key)
    if (list) list.push(index)
    else availableByKey.set(key, [index])
  })

  const blockOccurrenceCounts = new Map<string, number>()
  const nextBlocks: BlockInput[] = []
  const removedBlockIds: string[] = []

  for (const block of taskBlocks) {
    const textKey = normalizeTaskText(block.taskText)
    const blockOccurrence = (blockOccurrenceCounts.get(textKey) ?? 0) + 1
    blockOccurrenceCounts.set(textKey, blockOccurrence)

    // Предпочитаем ключ через taskIndex из prevTasks, иначе берём по тексту блока.
    const prevIndex = block.taskIndex - 1
    let key: OccurrenceKey
    if (prevIndex >= 0 && prevIndex < prevKeys.length && prevKeys[prevIndex].startsWith(`${textKey}#`)) {
      key = prevKeys[prevIndex]
    } else {
      key = `${textKey}#${blockOccurrence}`
    }

    const queue = availableByKey.get(key)
    const nextIndex = queue?.shift()
    if (nextIndex === undefined) {
      removedBlockIds.push(block.id)
      continue
    }
    const task = currentTasks[nextIndex]
    nextBlocks.push({
      ...block,
      taskIndex: nextIndex + 1,
      taskText: task.taskText.trim(),
    })
  }

  return { blocks: [...serviceBlocks, ...nextBlocks].sort((a, b) => a.startMinutes - b.startMinutes), removedBlockIds }
}

/**
 * Возвращает индексы задач (в currentTasks), у которых нет блока в расписании.
 * Учитывает номер вхождения для дубликатов.
 */
export function computeUnscheduledTaskIndexes(blocks: BlockInput[], tasks: TaskLike[]): number[] {
  const keys = buildOccurrenceKeys(tasks)
  const usedCounts = new Map<string, number>()
  for (const block of blocks) {
    if (!isTaskScheduleBlock(block)) continue
    const idx = block.taskIndex - 1
    if (idx >= 0 && idx < keys.length) {
      const key = keys[idx]
      usedCounts.set(key, (usedCounts.get(key) ?? 0) + 1)
    }
  }

  const seenCounts = new Map<string, number>()
  const result: number[] = []
  keys.forEach((key, index) => {
    const seen = (seenCounts.get(key) ?? 0) + 1
    seenCounts.set(key, seen)
    const used = usedCounts.get(key) ?? 0
    if (seen > used) result.push(index)
  })
  return result
}

/**
 * Ищет ближайший свободный слот длиной ≥ duration начиная с earliestStart.
 * Возвращает startMinutes свободного слота или null, если такого слота нет.
 */
export function findFreeSlot(
  duration: number,
  dayStart: number,
  dayEnd: number,
  blocks: BlockInput[],
  options: { ignoreId?: string; earliestStart?: number } = {},
): number | null {
  const durationSteps = snapToStep(duration)
  if (durationSteps < MIN_BLOCK_DURATION_MINUTES) return null
  if (dayEnd - dayStart < durationSteps) return null

  const ignoreId = options.ignoreId
  const earliest = snapToStep(options.earliestStart ?? dayStart)

  // Только кандидаты, не раньше earliest: сам earliest и концы занятых блоков.
  const candidates = new Set<number>()
  const earliestClamped = clamp(earliest, dayStart, dayEnd)
  if (earliestClamped + durationSteps <= dayEnd) {
    candidates.add(earliestClamped)
  }
  for (const block of blocks) {
    if (ignoreId && block.id === ignoreId) continue
    const end = getBlockEnd(block)
    if (end >= earliestClamped) candidates.add(end)
  }

  const sorted = [...candidates].sort((a, b) => a - b)
  for (const candidate of sorted) {
    const c = clamp(candidate, dayStart, dayEnd)
    if (c + durationSteps > dayEnd) continue
    if (!hasOverlapWithOthers({ startMinutes: c, durationMinutes: durationSteps }, blocks, ignoreId)) {
      return c
    }
  }
  return null
}

// === Dirty detection ===

type ComparableSchedule = {
  version: number
  timezone: string
  dayStartMinutes: number
  dayEndMinutes: number
  planningBasis?: string
  planningStartMinutes?: number
  workEndMinutes?: number
  activityEndMinutes?: number
  blocks: BlockInput[]
}

function normalizeForCompare(schedule: ComparableSchedule): string {
  const blocks = [...schedule.blocks]
    .map(b => {
      if (isTaskScheduleBlock(b)) {
        return {
          id: b.id.trim(),
          kind: 'kind' in b ? b.kind : 'task',
          taskIndex: b.taskIndex,
          taskText: b.taskText.trim(),
          title: undefined,
          category: 'category' in b ? b.category : undefined,
          isFixed: 'isFixed' in b ? b.isFixed : undefined,
          startMinutes: b.startMinutes,
          durationMinutes: b.durationMinutes,
        }
      }
      const serviceBlock = b as BlockInput & { kind: 'meal' | 'rest' | 'buffer'; title: string }
      return {
        id: serviceBlock.id.trim(),
        kind: serviceBlock.kind,
        taskIndex: 0,
        taskText: serviceBlock.title.trim(),
        title: serviceBlock.title.trim(),
        category: 'category' in serviceBlock ? serviceBlock.category : undefined,
        isFixed: 'isFixed' in serviceBlock ? serviceBlock.isFixed : undefined,
        startMinutes: serviceBlock.startMinutes,
        durationMinutes: serviceBlock.durationMinutes,
      }
    })
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes || a.taskIndex - b.taskIndex || a.id.localeCompare(b.id),
    )
  return JSON.stringify({
    version: schedule.version,
    timezone: schedule.timezone.trim(),
    dayStartMinutes: schedule.dayStartMinutes,
    dayEndMinutes: schedule.dayEndMinutes,
    planningBasis: schedule.planningBasis,
    planningStartMinutes: schedule.planningStartMinutes,
    workEndMinutes: schedule.workEndMinutes,
    activityEndMinutes: schedule.activityEndMinutes,
    blocks,
  })
}

export function scheduleEquals(
  a: ComparableSchedule | null,
  b: ComparableSchedule | null,
): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return normalizeForCompare(a) === normalizeForCompare(b)
}

// === Request lifecycle guards ===

export type ScheduleRequestContext = {
  date: string
  revision: number
}

/**
 * UI can have stale GET/PUT responses when the user switches dates quickly.
 * A response is allowed to mutate current state only if both date and local
 * revision still match the active day.
 */
export function isScheduleRequestCurrent(
  request: ScheduleRequestContext,
  current: ScheduleRequestContext,
): boolean {
  return request.date === current.date && request.revision === current.revision
}

export function getPendingSaveDateChangeAction(
  pending: ScheduleRequestContext | null,
  next: ScheduleRequestContext,
): 'flush-previous-date' | 'keep-current' | 'none' {
  if (!pending) return 'none'
  return isScheduleRequestCurrent(pending, next) ? 'keep-current' : 'flush-previous-date'
}

export function buildSchedule(timezone: string, dayStart: number, dayEnd: number, blocks: BlockInput[]): DailySchedule {
  if (blocks.some(block => 'kind' in block)) {
    return {
      version: 2,
      timezone,
      dayStartMinutes: dayStart,
      dayEndMinutes: dayEnd,
      blocks: blocks.map(block => isTaskScheduleBlock(block) && !('kind' in block) ? { ...block, kind: 'task' as const } : block) as DailyScheduleV2Block[],
    }
  }
  return {
    version: 1,
    timezone,
    dayStartMinutes: dayStart,
    dayEndMinutes: dayEnd,
    blocks: blocks.filter(isTaskScheduleBlock).map(({ id, taskIndex, taskText, startMinutes, durationMinutes }) => ({ id, taskIndex, taskText, startMinutes, durationMinutes })),
  }
}
