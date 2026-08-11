import crypto from 'crypto'
import { z } from 'zod'
import {
  DailyScheduleBlockCategorySchema,
  DailyScheduleLoadSummarySchema,
  DailySchedulePlanningBasisSchema,
  DailyScheduleSchema,
  DailyScheduleV2,
  DailyScheduleV2Schema,
  DailyScheduleV3,
  DailyScheduleV3Schema,
  MIN_BLOCK_DURATION_MINUTES,
  blocksOverlap,
  computeDailyScheduleLoadSummary,
  getBlockEndMinutes,
  hashDailySchedule,
} from '@/lib/daily-schedule'
import { DAILY_SCHEDULE_TIME_STEP_MINUTES, isTimeStep } from '@/lib/daily-schedule-time'
import { isValidDateOnly } from '@/lib/dates'

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'Invalid calendar date')
export const TimezoneSchema = z.string().trim().min(1).max(100).regex(/^([A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*|UTC)$/, 'Expected IANA timezone')
export const MAX_DAILY_SCHEDULE_PROPOSAL_NEW_TASKS = 10
export const DAILY_SCHEDULE_PROPOSAL_TIME_STEP_MINUTES = DAILY_SCHEDULE_TIME_STEP_MINUTES
const TaskTextSchema = z.string().trim().min(1).max(500)

export const DailyScheduleProposalV1BlockSchema = z.object({
  kind: z.enum(['task', 'meal', 'rest', 'buffer']),
  taskIndex: z.number().int().positive().optional(),
  taskText: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(MIN_BLOCK_DURATION_MINUTES).max(1440),
}).superRefine((block, ctx) => {
  if (block.kind === 'task') {
    if (block.taskIndex === undefined) ctx.addIssue({ code: 'custom', path: ['taskIndex'], message: 'taskIndex is required for task blocks' })
    if (!block.taskText) ctx.addIssue({ code: 'custom', path: ['taskText'], message: 'taskText is required for task blocks' })
  } else if (!block.title) {
    ctx.addIssue({ code: 'custom', path: ['title'], message: 'title is required for service blocks' })
  }
})

export const DailyScheduleProposalV1Schema = z.object({
  version: z.literal(1),
  date: DateSchema,
  timezone: TimezoneSchema,
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  blocks: z.array(DailyScheduleProposalV1BlockSchema).min(1).max(100),
  rationale: z.string().trim().max(1000).optional(),
})

export const DailyScheduleProposalV2TaskBlockSchema = z.object({
  kind: z.literal('task'),
  taskIndex: z.number().int().positive(),
  taskText: z.string().trim().min(1).max(500),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(MIN_BLOCK_DURATION_MINUTES).max(1440),
})

export const DailyScheduleProposalV2ServiceBlockSchema = z.object({
  kind: z.enum(['meal', 'rest', 'buffer']),
  title: z.string().trim().min(1).max(120),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(MIN_BLOCK_DURATION_MINUTES).max(1440),
})

export const DailyScheduleProposalV2BlockSchema = z.discriminatedUnion('kind', [
  DailyScheduleProposalV2TaskBlockSchema,
  DailyScheduleProposalV2ServiceBlockSchema,
])

export const DailyScheduleProposalV2Schema = z.object({
  version: z.literal(2),
  date: DateSchema,
  timezone: TimezoneSchema,
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  planningBasis: DailySchedulePlanningBasisSchema,
  planningStartMinutes: z.number().int().min(0).max(1440),
  workEndMinutes: z.number().int().min(0).max(1440),
  activityEndMinutes: z.number().int().min(0).max(1440),
  blocks: z.array(DailyScheduleProposalV2BlockSchema).min(1).max(100),
  rationale: z.string().trim().max(1000).optional(),
}).superRefine((proposal, ctx) => {
  for (const field of ['dayStartMinutes', 'dayEndMinutes', 'planningStartMinutes', 'workEndMinutes', 'activityEndMinutes'] as const) {
    if (!isTimeStep(proposal[field])) ctx.addIssue({ code: 'custom', path: [field], message: `${field} must use 1 minute step` })
  }
  for (const [index, block] of proposal.blocks.entries()) {
    if (!isTimeStep(block.startMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'startMinutes'], message: 'startMinutes must use 1 minute step' })
    if (!isTimeStep(block.durationMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'durationMinutes'], message: 'durationMinutes must use 1 minute step' })
  }
})

// V3 deliberately keeps `kind: 'task'` for both existing and newly proposed tasks.
// `taskSource` disambiguates semantics without introducing a new block kind that older
// consumers would accidentally treat as a service block. For `taskSource: 'new'`,
// `taskIndex` is a 1-based index into top-level `newTasks`; conversion remaps it to
// the final plan task index using the current plan task count.
export const DailyScheduleProposalV3TaskBlockSchema = z.object({
  kind: z.literal('task'),
  taskSource: z.enum(['existing', 'new']),
  taskIndex: z.number().int().positive(),
  taskText: TaskTextSchema,
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(MIN_BLOCK_DURATION_MINUTES).max(1440),
}).strict()

export const DailyScheduleProposalV3ServiceBlockSchema = z.object({
  kind: z.enum(['meal', 'rest', 'buffer']),
  title: z.string().trim().min(1).max(120),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(MIN_BLOCK_DURATION_MINUTES).max(1440),
}).strict()

export const DailyScheduleProposalV3BlockSchema = z.discriminatedUnion('kind', [
  DailyScheduleProposalV3TaskBlockSchema,
  DailyScheduleProposalV3ServiceBlockSchema,
])

export const DailyScheduleProposalV3Schema = z.object({
  version: z.literal(3),
  date: DateSchema,
  timezone: TimezoneSchema,
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  planningBasis: DailySchedulePlanningBasisSchema,
  planningStartMinutes: z.number().int().min(0).max(1440),
  workEndMinutes: z.number().int().min(0).max(1440),
  activityEndMinutes: z.number().int().min(0).max(1440),
  newTasks: z.array(TaskTextSchema).max(MAX_DAILY_SCHEDULE_PROPOSAL_NEW_TASKS),
  blocks: z.array(DailyScheduleProposalV3BlockSchema).min(1).max(100),
  rationale: z.string().trim().max(1000).optional(),
}).strict().superRefine((proposal, ctx) => {
  for (const field of ['dayStartMinutes', 'dayEndMinutes', 'planningStartMinutes', 'workEndMinutes', 'activityEndMinutes'] as const) {
    if (!isTimeStep(proposal[field])) ctx.addIssue({ code: 'custom', path: [field], message: `${field} must use 1 minute step` })
  }

  const normalizedNewTasks = new Set<string>()
  for (const [index, taskText] of proposal.newTasks.entries()) {
    const normalized = taskText.trim().toLocaleLowerCase('ru-RU')
    if (normalizedNewTasks.has(normalized)) ctx.addIssue({ code: 'custom', path: ['newTasks', index], message: 'newTasks must be unique' })
    normalizedNewTasks.add(normalized)
  }

  for (const [index, block] of proposal.blocks.entries()) {
    if (!isTimeStep(block.startMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'startMinutes'], message: 'startMinutes must use 1 minute step' })
    if (!isTimeStep(block.durationMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'durationMinutes'], message: 'durationMinutes must use 1 minute step' })
    if (block.kind !== 'task') continue

    if (block.taskSource === 'new') {
      const expectedText = proposal.newTasks[block.taskIndex - 1]
      if (!expectedText) {
        ctx.addIssue({ code: 'custom', path: ['blocks', index, 'taskIndex'], message: 'new task block references unknown newTasks index' })
      }
    }
  }
})

export const DailyScheduleProposalSchema = z.union([DailyScheduleProposalV1Schema, DailyScheduleProposalV2Schema, DailyScheduleProposalV3Schema])

const DailyScheduleProposalMetadataV1Schema = z.object({
  type: z.literal('daily_schedule_proposal'),
  schemaVersion: z.literal(1),
  date: DateSchema,
  createdAt: z.string().datetime(),
  currentScheduleExists: z.boolean().optional(),
  currentScheduleHash: z.string().length(64).nullable(),
  appliedAt: z.string().datetime().nullable().optional(),
  proposal: DailyScheduleProposalV1Schema,
}).transform(metadata => ({
  ...metadata,
  currentScheduleExists: metadata.currentScheduleExists ?? metadata.currentScheduleHash !== null,
}))

const DailyScheduleProposalMetadataV2Schema = z.object({
  type: z.literal('daily_schedule_proposal'),
  schemaVersion: z.literal(2),
  date: DateSchema,
  createdAt: z.string().datetime(),
  currentScheduleExists: z.boolean().optional(),
  currentScheduleHash: z.string().length(64).nullable(),
  appliedAt: z.string().datetime().nullable().optional(),
  loadSummary: DailyScheduleLoadSummarySchema,
  proposal: DailyScheduleProposalV2Schema,
}).transform(metadata => ({
  ...metadata,
  currentScheduleExists: metadata.currentScheduleExists ?? metadata.currentScheduleHash !== null,
}))

const DailyScheduleProposalMetadataV3Schema = z.object({
  type: z.literal('daily_schedule_proposal'),
  schemaVersion: z.literal(3),
  date: DateSchema,
  createdAt: z.string().datetime(),
  currentScheduleExists: z.boolean().optional(),
  currentScheduleHash: z.string().length(64).nullable(),
  currentPlanTaskCount: z.number().int().min(0).optional(),
  currentPlanTasksHash: z.string().length(64).nullable().optional(),
  appliedAt: z.string().datetime().nullable().optional(),
  loadSummary: DailyScheduleLoadSummarySchema,
  proposal: DailyScheduleProposalV3Schema,
}).transform(metadata => ({
  ...metadata,
  currentScheduleExists: metadata.currentScheduleExists ?? metadata.currentScheduleHash !== null,
}))

export const DailyScheduleProposalMetadataSchema = z.union([DailyScheduleProposalMetadataV1Schema, DailyScheduleProposalMetadataV2Schema, DailyScheduleProposalMetadataV3Schema])

const DailyTaskListProposalScheduleIssueSchema = z.object({
  status: z.literal('schedule_rejected'),
  reason: z.string().trim().min(1).max(500),
  diagnostics: z.array(z.string().trim().min(1).max(500)).max(20),
  nextAction: z.enum(['place_from_current', 'ignore_current', 'edit']).nullable().optional(),
}).strict()

export const DailyTaskListProposalMetadataSchema = z.object({
  type: z.literal('daily_task_list_proposal'),
  schemaVersion: z.literal(1),
  date: DateSchema,
  createdAt: z.string().datetime(),
  currentPlanTaskCount: z.number().int().min(0),
  currentPlanTasksHash: z.string().length(64),
  appliedAt: z.string().datetime().nullable().optional(),
  tasks: z.array(TaskTextSchema).min(1).max(MAX_DAILY_SCHEDULE_PROPOSAL_NEW_TASKS),
  scheduleIssue: DailyTaskListProposalScheduleIssueSchema.optional(),
}).strict()

export const DailyChatProposalMetadataSchema = z.union([DailyScheduleProposalMetadataSchema, DailyTaskListProposalMetadataSchema])

export type DailyScheduleProposalV1Block = z.infer<typeof DailyScheduleProposalV1BlockSchema>
export type DailyScheduleProposalV2Block = z.infer<typeof DailyScheduleProposalV2BlockSchema>
export type DailyScheduleProposalV3Block = z.infer<typeof DailyScheduleProposalV3BlockSchema>
export type DailyScheduleProposalV1 = z.infer<typeof DailyScheduleProposalV1Schema>
export type DailyScheduleProposalV2 = z.infer<typeof DailyScheduleProposalV2Schema>
export type DailyScheduleProposalV3 = z.infer<typeof DailyScheduleProposalV3Schema>
export type DailyScheduleProposal = z.infer<typeof DailyScheduleProposalSchema>
export type DailyScheduleProposalMetadata = z.infer<typeof DailyScheduleProposalMetadataSchema>
export type DailyTaskListProposalMetadata = z.infer<typeof DailyTaskListProposalMetadataSchema>
export type DailyChatProposalMetadata = z.infer<typeof DailyChatProposalMetadataSchema>
export type ProposalToDailyScheduleOptions = { currentPlanTaskCount?: number }
export type DailyScheduleProposalUnscheduledBlock = {
  originalIndex: number
  reason: 'does_not_fit'
  block: Record<string, unknown>
  task?: { taskSource?: 'existing' | 'new'; taskIndex?: number; taskText?: string }
}
export type DailyScheduleProposalNormalizationResult = { unscheduledBlocks: DailyScheduleProposalUnscheduledBlock[] }

const normalizationResults = new WeakMap<object, DailyScheduleProposalNormalizationResult>()

export function hashDailyPlanTasks(planTasks: string[]): string {
  return crypto.createHash('sha256').update(JSON.stringify({ version: 1, tasks: planTasks.map(task => task.trim()) })).digest('hex')
}

export function getNewTasksFromProposal(proposal: DailyScheduleProposalV3): string[] {
  return [...proposal.newTasks]
}

export function createTaskListProposalMetadata(input: {
  date: string
  tasks: string[]
  currentPlanTaskCount: number
  currentPlanTasksHash: string
  scheduleIssue?: { reason: string; diagnostics: string[]; nextAction?: 'place_from_current' | 'ignore_current' | 'edit' | null }
  createdAt?: Date
}): DailyTaskListProposalMetadata {
  const parsedTasks = z.array(TaskTextSchema).min(1).max(MAX_DAILY_SCHEDULE_PROPOSAL_NEW_TASKS).parse(input.tasks)
  const metadata: DailyTaskListProposalMetadata = {
    type: 'daily_task_list_proposal',
    schemaVersion: 1,
    date: input.date,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    currentPlanTaskCount: input.currentPlanTaskCount,
    currentPlanTasksHash: input.currentPlanTasksHash,
    appliedAt: null,
    tasks: parsedTasks,
  }
  if (input.scheduleIssue) {
    metadata.scheduleIssue = {
      status: 'schedule_rejected',
      reason: input.scheduleIssue.reason,
      diagnostics: input.scheduleIssue.diagnostics,
      nextAction: input.scheduleIssue.nextAction ?? null,
    }
  }
  return metadata
}

function snapMinutesToStep(value: number, options: { min: number; max: number }): number {
  const snapped = Math.round(value / DAILY_SCHEDULE_PROPOSAL_TIME_STEP_MINUTES) * DAILY_SCHEDULE_PROPOSAL_TIME_STEP_MINUTES
  return Math.min(options.max, Math.max(options.min, snapped))
}

type NormalizedProposalBlock = Record<string, unknown> & {
  startMinutes?: unknown
  durationMinutes?: unknown
  isFixed?: unknown
}

type MovableScheduleBlock = {
  block: NormalizedProposalBlock
  originalIndex: number
  startMinutes: number
  durationMinutes: number
  isFixed: boolean
}

type LayoutBlock = MovableScheduleBlock & { endMinutes: number }

type FreeInterval = { startMinutes: number; endMinutes: number }

function getMovableScheduleBlocks(blocks: unknown[]): MovableScheduleBlock[] {
  return blocks.flatMap((block, originalIndex) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return []
    const normalizedBlock = block as NormalizedProposalBlock
    if (typeof normalizedBlock.startMinutes !== 'number' || !Number.isFinite(normalizedBlock.startMinutes)) return []
    if (typeof normalizedBlock.durationMinutes !== 'number' || !Number.isFinite(normalizedBlock.durationMinutes)) return []
    return [{ block: normalizedBlock, originalIndex, startMinutes: normalizedBlock.startMinutes, durationMinutes: normalizedBlock.durationMinutes, isFixed: normalizedBlock.isFixed === true }]
  })
}

function sortScheduleBlocksByStart(blocks: MovableScheduleBlock[]): MovableScheduleBlock[] {
  return [...blocks].sort((first, second) => first.startMinutes - second.startMinutes || first.originalIndex - second.originalIndex)
}

function sortLayoutBlocksByStart(blocks: LayoutBlock[]): LayoutBlock[] {
  return [...blocks].sort((first, second) => first.startMinutes - second.startMinutes || first.originalIndex - second.originalIndex)
}

function getScheduleDayWindow(candidate: Record<string, unknown>): FreeInterval | null {
  const startMinutes = candidate.version === 3 ? candidate.planningStartMinutes : candidate.dayStartMinutes
  const endMinutes = candidate.version === 3 ? candidate.activityEndMinutes : candidate.dayEndMinutes
  if (typeof startMinutes !== 'number' || !Number.isFinite(startMinutes)) return null
  if (typeof endMinutes !== 'number' || !Number.isFinite(endMinutes)) return null
  const normalizedStart = snapMinutesToStep(startMinutes, { min: 0, max: 1440 })
  const normalizedEnd = snapMinutesToStep(endMinutes, { min: 0, max: 1440 })
  if (normalizedEnd <= normalizedStart) return null
  return { startMinutes: normalizedStart, endMinutes: normalizedEnd }
}

function getFixedOccupiedIntervals(fixedBlocks: LayoutBlock[], dayWindow: FreeInterval): FreeInterval[] {
  const intervals = fixedBlocks
    .filter(block => block.startMinutes >= dayWindow.startMinutes && block.endMinutes <= dayWindow.endMinutes)
    .sort((first, second) => first.startMinutes - second.startMinutes || first.originalIndex - second.originalIndex)

  const merged: FreeInterval[] = []
  for (const interval of intervals) {
    const previous = merged.at(-1)
    if (previous && interval.startMinutes <= previous.endMinutes) {
      previous.endMinutes = Math.max(previous.endMinutes, interval.endMinutes)
    } else {
      merged.push({ startMinutes: interval.startMinutes, endMinutes: interval.endMinutes })
    }
  }
  return merged
}

function getFreeIntervals(dayWindow: FreeInterval, occupiedIntervals: FreeInterval[]): FreeInterval[] {
  const freeIntervals: FreeInterval[] = []
  let cursor = dayWindow.startMinutes

  for (const interval of occupiedIntervals) {
    if (interval.startMinutes > cursor) freeIntervals.push({ startMinutes: cursor, endMinutes: interval.startMinutes })
    cursor = Math.max(cursor, interval.endMinutes)
  }

  if (cursor < dayWindow.endMinutes) freeIntervals.push({ startMinutes: cursor, endMinutes: dayWindow.endMinutes })
  return freeIntervals
}

function getUnscheduledTaskInfo(block: NormalizedProposalBlock): DailyScheduleProposalUnscheduledBlock['task'] | undefined {
  if (block.kind !== 'task') return undefined
  const task: NonNullable<DailyScheduleProposalUnscheduledBlock['task']> = {}
  if (block.taskSource === 'existing' || block.taskSource === 'new') task.taskSource = block.taskSource
  if (typeof block.taskIndex === 'number') task.taskIndex = block.taskIndex
  if (typeof block.taskText === 'string') task.taskText = block.taskText
  return task
}

function placeFlexibleBlocksInFreeIntervals(blocks: unknown[], candidate: Record<string, unknown>): { blocks: unknown[]; unscheduledBlocks: DailyScheduleProposalUnscheduledBlock[] } | null {
  const dayWindow = getScheduleDayWindow(candidate)
  if (!dayWindow) return null

  const scheduleBlocks = getMovableScheduleBlocks(blocks).map(block => ({ ...block, endMinutes: getBlockEndMinutes(block) }))
  if (scheduleBlocks.length !== blocks.length) return null

  const fixedBlocks = scheduleBlocks.filter(block => block.isFixed)
  const flexibleBlocks = scheduleBlocks.filter(block => !block.isFixed).sort((first, second) => first.originalIndex - second.originalIndex)
  const freeIntervals = getFreeIntervals(dayWindow, getFixedOccupiedIntervals(fixedBlocks, dayWindow))
  const placedFlexibleBlocks: LayoutBlock[] = []
  const unscheduledBlocks: DailyScheduleProposalUnscheduledBlock[] = []
  let cursor = dayWindow.startMinutes

  for (const block of flexibleBlocks) {
    const durationMinutes = block.durationMinutes
    const interval = freeIntervals.find(freeInterval => {
      if (freeInterval.endMinutes <= cursor) return false
      const startMinutes = Math.max(cursor, freeInterval.startMinutes)
      return startMinutes + durationMinutes <= freeInterval.endMinutes && startMinutes + durationMinutes <= 1440
    })

    if (!interval) {
      const unscheduledBlock: DailyScheduleProposalUnscheduledBlock = {
        originalIndex: block.originalIndex,
        reason: 'does_not_fit',
        block: { ...block.block },
      }
      const task = getUnscheduledTaskInfo(block.block)
      if (task) unscheduledBlock.task = task
      unscheduledBlocks.push(unscheduledBlock)
      continue
    }

    const startMinutes = Math.max(cursor, interval.startMinutes)
    const endMinutes = startMinutes + durationMinutes
    block.startMinutes = startMinutes
    block.endMinutes = endMinutes
    block.block.startMinutes = startMinutes
    placedFlexibleBlocks.push(block)
    cursor = endMinutes
  }

  return { blocks: sortLayoutBlocksByStart([...fixedBlocks, ...placedFlexibleBlocks]).map(block => block.block), unscheduledBlocks }
}

function separateOverlappingScheduleBlocks(blocks: unknown[]): unknown[] {
  const scheduleBlocks = getMovableScheduleBlocks(blocks)
  const maxIterations = scheduleBlocks.length * scheduleBlocks.length + scheduleBlocks.length

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const sortedBlocks = sortScheduleBlocksByStart(scheduleBlocks)
    let changed = false

    for (let index = 1; index < sortedBlocks.length; index++) {
      const previous = sortedBlocks[index - 1]
      const current = sortedBlocks[index]
      if (!blocksOverlap(previous, current)) continue
      if (previous.isFixed && current.isFixed) continue

      const movable = previous.isFixed ? current : current.isFixed ? previous : current
      const anchor = movable === previous ? current : previous
      const nextStartMinutes = getBlockEndMinutes(anchor)
      if (nextStartMinutes <= movable.startMinutes) continue

      movable.startMinutes = nextStartMinutes
      movable.block.startMinutes = nextStartMinutes
      changed = true
      break
    }

    if (!changed) break
  }

  if (scheduleBlocks.length !== blocks.length) return blocks
  return sortScheduleBlocksByStart(scheduleBlocks).map(scheduleBlock => scheduleBlock.block)
}

export function normalizeDailyScheduleProposalToolInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const candidate = input as Record<string, unknown>
  if (candidate.version !== 2 && candidate.version !== 3) return input
  if (!Array.isArray(candidate.blocks)) return input

  const normalizedCandidate = { ...candidate }
  for (const field of ['dayStartMinutes', 'dayEndMinutes', 'planningStartMinutes', 'workEndMinutes', 'activityEndMinutes'] as const) {
    if (typeof normalizedCandidate[field] === 'number' && Number.isFinite(normalizedCandidate[field])) {
      normalizedCandidate[field] = snapMinutesToStep(normalizedCandidate[field], { min: 0, max: 1440 })
    }
  }
  if (normalizedCandidate.version === 3) {
    normalizedCandidate.dayStartMinutes = normalizedCandidate.planningStartMinutes
    normalizedCandidate.dayEndMinutes = normalizedCandidate.activityEndMinutes
  }

  const normalizedBlocks = candidate.blocks.map(block => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return block
    const normalizedBlock = { ...(block as Record<string, unknown>) }
    if (typeof normalizedBlock.startMinutes === 'number' && Number.isFinite(normalizedBlock.startMinutes)) {
      normalizedBlock.startMinutes = snapMinutesToStep(normalizedBlock.startMinutes, { min: 0, max: 1440 })
    }
    if (typeof normalizedBlock.durationMinutes === 'number' && Number.isFinite(normalizedBlock.durationMinutes)) {
      normalizedBlock.durationMinutes = snapMinutesToStep(normalizedBlock.durationMinutes, { min: MIN_BLOCK_DURATION_MINUTES, max: 1440 })
    }
    if (normalizedCandidate.version === 3 && normalizedBlock.kind === 'task' && normalizedBlock.taskSource === 'new' && typeof normalizedBlock.taskIndex === 'number' && Array.isArray(normalizedCandidate.newTasks)) {
      const expectedTaskText = normalizedCandidate.newTasks[normalizedBlock.taskIndex - 1]
      if (typeof expectedTaskText === 'string') normalizedBlock.taskText = expectedTaskText
    }
    return normalizedBlock
  })

  const layout = normalizedCandidate.version === 3 ? placeFlexibleBlocksInFreeIntervals(normalizedBlocks, normalizedCandidate) : null
  const normalizedOutput = {
    ...normalizedCandidate,
    blocks: layout ? layout.blocks : separateOverlappingScheduleBlocks(normalizedBlocks),
  }
  normalizationResults.set(normalizedOutput, { unscheduledBlocks: layout?.unscheduledBlocks ?? [] })

  return normalizedOutput
}

export function getDailyScheduleProposalNormalizationResult(input: unknown): DailyScheduleProposalNormalizationResult | null {
  if (!input || typeof input !== 'object') return null
  return normalizationResults.get(input) ?? null
}

function inferMinimumCurrentPlanTaskCount(proposal: DailyScheduleProposalV3): number {
  return proposal.blocks.reduce((maxIndex, block) => {
    if (block.kind === 'task' && block.taskSource === 'existing') return Math.max(maxIndex, block.taskIndex)
    return maxIndex
  }, 0)
}

function formatScheduleIssuePath(path: PropertyKey[]): string {
  const normalized = path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number')
  return normalized.length > 0 ? normalized.join('.') : 'schedule'
}

function getScheduleValidationIssueDetails(issues: z.ZodIssue[]): string[] {
  return issues.map(issue => `${formatScheduleIssuePath(issue.path)} [${issue.code}]: ${issue.message}`)
}

function validateTaskBlocksAgainstCurrentPlan(proposal: DailyScheduleProposal, current: { date: string; timezone: string; planTasks: string[] }): { success: true } | { success: false; error: string } {
  if (proposal.date !== current.date) return { success: false, error: 'proposal date does not match current date' }
  if (proposal.timezone !== current.timezone) return { success: false, error: 'proposal timezone does not match request timezone' }
  for (const [index, block] of proposal.blocks.entries()) {
    if (block.kind !== 'task') continue
    if (proposal.version === 3 && 'taskSource' in block && block.taskSource === 'new') {
      const newTaskIndex = block.taskIndex
      if (typeof newTaskIndex !== 'number') return { success: false, error: `new task block ${index} references unknown newTasks index` }
      const expectedText = proposal.newTasks[newTaskIndex - 1]
      if (!expectedText) return { success: false, error: `new task block ${index} references unknown newTasks index` }
      block.taskText = expectedText
      continue
    }
    const taskIndex = block.taskIndex
    if (typeof taskIndex !== 'number' || taskIndex < 1 || taskIndex > current.planTasks.length) {
      return { success: false, error: `task block ${index} references unknown taskIndex` }
    }
    const expectedText = current.planTasks[taskIndex - 1]
    block.taskText = expectedText
  }
  return { success: true }
}

export function validateProposalAgainstCurrentPlan(proposal: DailyScheduleProposal, current: { date: string; timezone: string; planTasks: string[] }): { success: true; data: DailyScheduleProposal } | { success: false; error: string } {
  const taskValidation = validateTaskBlocksAgainstCurrentPlan(proposal, current)
  if (!taskValidation.success) return taskValidation
  const schedule = proposalToDailySchedule(proposal, { currentPlanTaskCount: current.planTasks.length })
  const validation = DailyScheduleSchema.safeParse(schedule)
  if (!validation.success) {
    const details = getScheduleValidationIssueDetails(validation.error.issues).join('; ')
    return { success: false, error: details ? `proposal cannot be converted to a valid schedule: ${details}` : 'proposal cannot be converted to a valid schedule' }
  }
  return { success: true, data: proposal }
}

function proposalBlockId(proposal: DailyScheduleProposal, index: number, kind: string, startMinutes: number, durationMinutes: number): string {
  const key = proposal.version === 1
    ? `${proposal.date}:${index}:${kind}:${startMinutes}:${durationMinutes}`
    : `${proposal.date}:${proposal.version}:${index}:${kind}:${startMinutes}:${durationMinutes}`
  return `srv-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}`
}

export function proposalToDailyScheduleV2(proposal: DailyScheduleProposalV1): DailyScheduleV2 {
  return {
    version: 2,
    timezone: proposal.timezone,
    dayStartMinutes: proposal.dayStartMinutes,
    dayEndMinutes: proposal.dayEndMinutes,
    blocks: proposal.blocks.map((block, index) => {
      const id = proposalBlockId(proposal, index, block.kind, block.startMinutes, block.durationMinutes)
      if (block.kind === 'task') {
        return { id, kind: 'task', taskIndex: block.taskIndex!, taskText: block.taskText!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id, kind: block.kind, title: block.title!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function proposalToDailyScheduleV3(proposal: DailyScheduleProposalV2): DailyScheduleV3
export function proposalToDailyScheduleV3(proposal: DailyScheduleProposalV3, currentPlanTaskCount: number): DailyScheduleV3
export function proposalToDailyScheduleV3(proposal: DailyScheduleProposalV2 | DailyScheduleProposalV3, currentPlanTaskCount?: number): DailyScheduleV3 {
  const existingTaskCount = proposal.version === 3 ? currentPlanTaskCount ?? inferMinimumCurrentPlanTaskCount(proposal) : 0
  return {
    version: 3,
    timezone: proposal.timezone,
    dayStartMinutes: proposal.dayStartMinutes,
    dayEndMinutes: proposal.dayEndMinutes,
    planningBasis: proposal.planningBasis,
    planningStartMinutes: proposal.planningStartMinutes,
    workEndMinutes: proposal.workEndMinutes,
    activityEndMinutes: proposal.activityEndMinutes,
    blocks: proposal.blocks.map((block, index) => {
      const id = proposalBlockId(proposal, index, block.kind, block.startMinutes, block.durationMinutes)
      if (block.kind === 'task') {
        const taskIndex = proposal.version === 3 && 'taskSource' in block && block.taskSource === 'new'
          ? existingTaskCount + block.taskIndex
          : block.taskIndex
        return { id, kind: 'task', taskIndex, taskText: block.taskText, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id, kind: block.kind, title: block.title, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function proposalToDailySchedule(proposal: DailyScheduleProposal, options: ProposalToDailyScheduleOptions = {}): DailyScheduleV2 | DailyScheduleV3 {
  if (proposal.version === 1) return proposalToDailyScheduleV2(proposal)
  if (proposal.version === 2) return proposalToDailyScheduleV3(proposal)
  return proposalToDailyScheduleV3(proposal, options.currentPlanTaskCount ?? inferMinimumCurrentPlanTaskCount(proposal))
}

export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposalV1; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): Extract<DailyScheduleProposalMetadata, { schemaVersion: 1 }>
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposalV2; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): Extract<DailyScheduleProposalMetadata, { schemaVersion: 2 }>
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposalV3; currentScheduleHash: string | null; currentScheduleExists: boolean; currentPlanTaskCount: number; currentPlanTasksHash?: string | null; createdAt?: Date }): Extract<DailyScheduleProposalMetadata, { schemaVersion: 3 }>
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposal; currentScheduleHash: string | null; currentScheduleExists: boolean; currentPlanTaskCount?: number; currentPlanTasksHash?: string | null; createdAt?: Date }): DailyScheduleProposalMetadata
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposal; currentScheduleHash: string | null; currentScheduleExists: boolean; currentPlanTaskCount?: number; currentPlanTasksHash?: string | null; createdAt?: Date }): DailyScheduleProposalMetadata {
  const base = { type: 'daily_schedule_proposal' as const, date: input.date, createdAt: (input.createdAt ?? new Date()).toISOString(), currentScheduleExists: input.currentScheduleExists, currentScheduleHash: input.currentScheduleHash, appliedAt: null }
  if (input.proposal.version === 1) {
    return { ...base, schemaVersion: 1, proposal: input.proposal }
  }
  if (input.proposal.version === 2) {
    return { ...base, schemaVersion: 2, proposal: input.proposal, loadSummary: computeDailyScheduleLoadSummary(proposalToDailyScheduleV3(input.proposal)) }
  }
  const schedule = proposalToDailyScheduleV3(input.proposal, input.currentPlanTaskCount ?? inferMinimumCurrentPlanTaskCount(input.proposal))
  return { ...base, schemaVersion: 3, proposal: input.proposal, currentPlanTaskCount: input.currentPlanTaskCount, currentPlanTasksHash: input.currentPlanTasksHash, loadSummary: computeDailyScheduleLoadSummary(schedule) }
}

export function safeParseProposalMetadata(value: unknown): DailyScheduleProposalMetadata | null {
  const validation = DailyScheduleProposalMetadataSchema.safeParse(value)
  if (!validation.success) return null
  if (validation.data.schemaVersion === 2) {
    const schedule = proposalToDailyScheduleV3(validation.data.proposal)
    const scheduleValidation = DailyScheduleV3Schema.safeParse(schedule)
    if (!scheduleValidation.success) return null
    return { ...validation.data, loadSummary: computeDailyScheduleLoadSummary(scheduleValidation.data) }
  }
  if (validation.data.schemaVersion === 3) {
    const schedule = proposalToDailyScheduleV3(validation.data.proposal, validation.data.currentPlanTaskCount ?? inferMinimumCurrentPlanTaskCount(validation.data.proposal))
    const scheduleValidation = DailyScheduleV3Schema.safeParse(schedule)
    if (!scheduleValidation.success) return null
    return { ...validation.data, loadSummary: computeDailyScheduleLoadSummary(scheduleValidation.data) }
  }
  const schedule = proposalToDailyScheduleV2(validation.data.proposal)
  const scheduleValidation = DailyScheduleV2Schema.safeParse(schedule)
  return scheduleValidation.success ? validation.data : null
}

export function safeParseTaskListProposalMetadata(value: unknown): DailyTaskListProposalMetadata | null {
  const validation = DailyTaskListProposalMetadataSchema.safeParse(value)
  return validation.success ? validation.data : null
}

export function safeParseDailyChatProposalMetadata(value: unknown): DailyChatProposalMetadata | null {
  const validation = DailyChatProposalMetadataSchema.safeParse(value)
  if (!validation.success) return null
  if (validation.data.type === 'daily_task_list_proposal') return validation.data
  return safeParseProposalMetadata(value)
}

export function getProposalScheduleHash(metadata: DailyScheduleProposalMetadata): string {
  if (metadata.schemaVersion === 3) {
    return hashDailySchedule(proposalToDailySchedule(metadata.proposal, { currentPlanTaskCount: metadata.currentPlanTaskCount }))
  }
  return hashDailySchedule(proposalToDailySchedule(metadata.proposal))
}
