import crypto from 'crypto'
import { z } from 'zod'

export const TIME_STEP_MINUTES = 15
export const MAX_MINUTES_IN_DAY = 1440
const MAX_BLOCKS = 100

export const DailySchedulePlanningBasisSchema = z.enum(['current_time', 'day_start', 'custom_time'])
export const DailyScheduleBlockCategorySchema = z.enum(['main', 'operational', 'travel', 'personal', 'meal', 'rest', 'buffer'])

const BaseBlockSchema = z.object({
  id: z.string().trim().min(1).max(100),
  startMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  durationMinutes: z.number().int().min(TIME_STEP_MINUTES).max(MAX_MINUTES_IN_DAY),
})

export const DailyScheduleV1BlockSchema = BaseBlockSchema.extend({
  taskIndex: z.number().int().positive(),
  taskText: z.string().trim().min(1).max(500),
})

export const DailyScheduleV2TaskBlockSchema = BaseBlockSchema.extend({
  kind: z.literal('task'),
  taskIndex: z.number().int().positive(),
  taskText: z.string().trim().min(1).max(500),
})

export const DailyScheduleV2ServiceBlockSchema = BaseBlockSchema.extend({
  kind: z.enum(['meal', 'rest', 'buffer']),
  title: z.string().trim().min(1).max(120),
})

export const DailyScheduleV2BlockSchema = z.discriminatedUnion('kind', [
  DailyScheduleV2TaskBlockSchema,
  DailyScheduleV2ServiceBlockSchema,
])

export const DailyScheduleV3TaskBlockSchema = BaseBlockSchema.extend({
  kind: z.literal('task'),
  taskIndex: z.number().int().positive(),
  taskText: z.string().trim().min(1).max(500),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
})

export const DailyScheduleV3ServiceBlockSchema = BaseBlockSchema.extend({
  kind: z.enum(['meal', 'rest', 'buffer']),
  title: z.string().trim().min(1).max(120),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
})

export const DailyScheduleV3BlockSchema = z.discriminatedUnion('kind', [
  DailyScheduleV3TaskBlockSchema,
  DailyScheduleV3ServiceBlockSchema,
])

function refineSchedule<T extends { dayStartMinutes: number; dayEndMinutes: number; blocks: Array<{ id: string; startMinutes: number; durationMinutes: number }> }>(schedule: T, ctx: z.RefinementCtx) {
  if (schedule.dayEndMinutes <= schedule.dayStartMinutes) {
    ctx.addIssue({ code: 'custom', path: ['dayEndMinutes'], message: 'dayEndMinutes must be greater than dayStartMinutes' })
  }
  if (!isTimeStep(schedule.dayStartMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['dayStartMinutes'], message: 'dayStartMinutes must use 15 minute step' })
  }
  if (!isTimeStep(schedule.dayEndMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['dayEndMinutes'], message: 'dayEndMinutes must use 15 minute step' })
  }

  for (const [index, block] of schedule.blocks.entries()) {
    if (!isTimeStep(block.startMinutes)) {
      ctx.addIssue({ code: 'custom', path: ['blocks', index, 'startMinutes'], message: 'startMinutes must use 15 minute step' })
    }
    if (!isTimeStep(block.durationMinutes)) {
      ctx.addIssue({ code: 'custom', path: ['blocks', index, 'durationMinutes'], message: 'durationMinutes must use 15 minute step' })
    }
    if (block.startMinutes < schedule.dayStartMinutes || getBlockEndMinutes(block) > schedule.dayEndMinutes) {
      ctx.addIssue({ code: 'custom', path: ['blocks', index], message: 'block must be inside day range' })
    }
  }

  for (const overlap of findScheduleOverlaps(schedule.blocks)) {
    ctx.addIssue({ code: 'custom', path: ['blocks'], message: `blocks overlap: ${overlap.firstId} and ${overlap.secondId}` })
  }
}

function refineScheduleV3(schedule: {
  dayStartMinutes: number
  dayEndMinutes: number
  planningStartMinutes: number
  workEndMinutes: number
  activityEndMinutes: number
  blocks: Array<{ id: string; startMinutes: number; durationMinutes: number }>
}, ctx: z.RefinementCtx) {
  refineSchedule(schedule, ctx)

  if (!isTimeStep(schedule.planningStartMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['planningStartMinutes'], message: 'planningStartMinutes must use 15 minute step' })
  }
  if (!isTimeStep(schedule.workEndMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['workEndMinutes'], message: 'workEndMinutes must use 15 minute step' })
  }
  if (!isTimeStep(schedule.activityEndMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['activityEndMinutes'], message: 'activityEndMinutes must use 15 minute step' })
  }
  if (!(schedule.planningStartMinutes < schedule.workEndMinutes && schedule.workEndMinutes <= schedule.activityEndMinutes)) {
    ctx.addIssue({ code: 'custom', path: ['planningStartMinutes'], message: 'planningStartMinutes must be less than workEndMinutes and workEndMinutes must not exceed activityEndMinutes' })
  }
  if (schedule.dayStartMinutes !== schedule.planningStartMinutes) {
    ctx.addIssue({ code: 'custom', path: ['dayStartMinutes'], message: 'dayStartMinutes must equal planningStartMinutes for v3 schedules' })
  }
  if (schedule.dayEndMinutes !== schedule.activityEndMinutes) {
    ctx.addIssue({ code: 'custom', path: ['dayEndMinutes'], message: 'dayEndMinutes must equal activityEndMinutes for v3 schedules' })
  }
}

export const DailyScheduleV1Schema = z.object({
  version: z.literal(1),
  timezone: z.string().trim().min(1).max(100),
  dayStartMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  dayEndMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  blocks: z.array(DailyScheduleV1BlockSchema).max(MAX_BLOCKS),
}).superRefine(refineSchedule)

export const DailyScheduleV2Schema = z.object({
  version: z.literal(2),
  timezone: z.string().trim().min(1).max(100),
  dayStartMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  dayEndMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  blocks: z.array(DailyScheduleV2BlockSchema).max(MAX_BLOCKS),
}).superRefine(refineSchedule)

export const DailyScheduleV3Schema = z.object({
  version: z.literal(3),
  timezone: z.string().trim().min(1).max(100),
  dayStartMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  dayEndMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  planningBasis: DailySchedulePlanningBasisSchema,
  planningStartMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  workEndMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  activityEndMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY),
  blocks: z.array(DailyScheduleV3BlockSchema).max(MAX_BLOCKS),
}).superRefine(refineScheduleV3)

export const DailyScheduleSchema = z.union([DailyScheduleV1Schema, DailyScheduleV2Schema, DailyScheduleV3Schema])

export const DailyScheduleCategoryLoadSchema = z.object({
  minutes: z.number().int().min(0),
  percent: z.number().min(0).max(100),
  workMinutes: z.number().int().min(0),
  workPercent: z.number().min(0).max(100),
})

export const DailyScheduleLoadSummarySchema = z.object({
  activeInterval: z.object({ startMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY), endMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY), availableMinutes: z.number().int().min(0) }),
  workInterval: z.object({ startMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY), endMinutes: z.number().int().min(0).max(MAX_MINUTES_IN_DAY), availableMinutes: z.number().int().min(0) }),
  scheduledMinutes: z.number().int().min(0),
  unscheduledMinutes: z.number().int().min(0),
  scheduledPercent: z.number().min(0).max(100),
  unscheduledPercent: z.number().min(0).max(100),
  workScheduledMinutes: z.number().int().min(0),
  workUnscheduledMinutes: z.number().int().min(0),
  workScheduledPercent: z.number().min(0).max(100),
  categories: z.record(DailyScheduleBlockCategorySchema, DailyScheduleCategoryLoadSchema),
  loadLevel: z.enum(['empty', 'light', 'balanced', 'busy', 'overloaded']),
  recommendation: z.string(),
})

export type DailyScheduleV1Block = z.infer<typeof DailyScheduleV1BlockSchema>
export type DailyScheduleV2TaskBlock = z.infer<typeof DailyScheduleV2TaskBlockSchema>
export type DailyScheduleV2ServiceBlock = z.infer<typeof DailyScheduleV2ServiceBlockSchema> & { taskIndex?: never; taskText?: never }
export type DailyScheduleV2Block = DailyScheduleV2TaskBlock | DailyScheduleV2ServiceBlock
export type DailyScheduleV3TaskBlock = z.infer<typeof DailyScheduleV3TaskBlockSchema>
export type DailyScheduleV3ServiceBlock = z.infer<typeof DailyScheduleV3ServiceBlockSchema> & { taskIndex?: never; taskText?: never }
export type DailyScheduleV3Block = DailyScheduleV3TaskBlock | DailyScheduleV3ServiceBlock
export type DailyScheduleBlockCategory = z.infer<typeof DailyScheduleBlockCategorySchema>
export type DailyScheduleBlock = DailyScheduleV1Block | DailyScheduleV2Block | DailyScheduleV3Block
export type DailyScheduleV1 = { version: 1; timezone: string; dayStartMinutes: number; dayEndMinutes: number; blocks: DailyScheduleV1Block[] }
export type DailyScheduleV2 = { version: 2; timezone: string; dayStartMinutes: number; dayEndMinutes: number; blocks: DailyScheduleV2Block[] }
export type DailyScheduleV3 = { version: 3; timezone: string; dayStartMinutes: number; dayEndMinutes: number; planningBasis: z.infer<typeof DailySchedulePlanningBasisSchema>; planningStartMinutes: number; workEndMinutes: number; activityEndMinutes: number; blocks: DailyScheduleV3Block[] }
export type DailySchedule = DailyScheduleV1 | DailyScheduleV2 | DailyScheduleV3
export type DailyScheduleCategoryLoad = z.infer<typeof DailyScheduleCategoryLoadSchema>
export type DailyScheduleLoadSummary = z.infer<typeof DailyScheduleLoadSummarySchema>

export type DailyScheduleResponse = { schedule: DailySchedule | null; updatedAt: string | null; hash?: string | null; loadSummary?: DailyScheduleLoadSummary | null }

export function isDailyScheduleV1(schedule: DailySchedule): schedule is DailyScheduleV1 { return schedule.version === 1 }
export function isDailyScheduleV2(schedule: DailySchedule): schedule is DailyScheduleV2 { return schedule.version === 2 }
export function isDailyScheduleV3(schedule: DailySchedule): schedule is DailyScheduleV3 { return schedule.version === 3 }
export function isTaskBlock(block: DailyScheduleBlock): block is DailyScheduleV1Block | DailyScheduleV2TaskBlock | DailyScheduleV3TaskBlock { return !('kind' in block) || block.kind === 'task' }
export function isServiceBlock(block: DailyScheduleBlock): block is DailyScheduleV2ServiceBlock | DailyScheduleV3ServiceBlock { return 'kind' in block && block.kind !== 'task' }

export function isTimeStep(value: number): boolean { return value % TIME_STEP_MINUTES === 0 }
export function getBlockEndMinutes(block: Pick<DailyScheduleBlock, 'startMinutes' | 'durationMinutes'>): number { return block.startMinutes + block.durationMinutes }
export function blocksOverlap(first: Pick<DailyScheduleBlock, 'startMinutes' | 'durationMinutes'>, second: Pick<DailyScheduleBlock, 'startMinutes' | 'durationMinutes'>): boolean {
  return first.startMinutes < getBlockEndMinutes(second) && second.startMinutes < getBlockEndMinutes(first)
}
export function findScheduleOverlaps(blocks: Array<Pick<DailyScheduleBlock, 'id' | 'startMinutes' | 'durationMinutes'>>): Array<{ firstId: string; secondId: string }> {
  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
  const overlaps: Array<{ firstId: string; secondId: string }> = []
  for (let index = 1; index < sortedBlocks.length; index++) {
    const previous = sortedBlocks[index - 1]
    const current = sortedBlocks[index]
    if (blocksOverlap(previous, current)) overlaps.push({ firstId: previous.id, secondId: current.id })
  }
  return overlaps
}

const SCHEDULE_CATEGORIES = DailyScheduleBlockCategorySchema.options

function percent(part: number, total: number): number {
  if (total <= 0 || part <= 0) return 0
  return Math.round((part / total) * 10000) / 100
}

function clampMinutes(value: number): number {
  return Math.max(0, Math.min(MAX_MINUTES_IN_DAY, value))
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

function getBlockCategory(block: DailyScheduleBlock): DailyScheduleBlockCategory {
  if ('category' in block) return block.category
  if ('kind' in block && block.kind !== 'task') return block.kind
  return 'main'
}

function getClippedDuration(block: Pick<DailyScheduleBlock, 'startMinutes' | 'durationMinutes'>, intervalStart: number, intervalEnd: number): number {
  const start = Math.max(block.startMinutes, intervalStart)
  const end = Math.min(getBlockEndMinutes(block), intervalEnd)
  return clampMinutes(end - start)
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

export function computeDailyScheduleLoadSummary(schedule: DailySchedule): DailyScheduleLoadSummary {
  const activeStart = getPlanningStartMinutes(schedule)
  const activeEnd = getActivityEndMinutes(schedule)
  const workStart = activeStart
  const workEnd = getWorkEndMinutes(schedule)
  const activeAvailable = Math.max(0, activeEnd - activeStart)
  const workAvailable = Math.max(0, workEnd - workStart)
  const categoryMinutes: Record<DailyScheduleBlockCategory, number> = {
    main: 0,
    operational: 0,
    travel: 0,
    personal: 0,
    meal: 0,
    rest: 0,
    buffer: 0,
  }
  const categoryWorkMinutes: Record<DailyScheduleBlockCategory, number> = {
    main: 0,
    operational: 0,
    travel: 0,
    personal: 0,
    meal: 0,
    rest: 0,
    buffer: 0,
  }

  for (const block of schedule.blocks) {
    const category = getBlockCategory(block)
    categoryMinutes[category] += getClippedDuration(block, activeStart, activeEnd)
    categoryWorkMinutes[category] += getClippedDuration(block, workStart, workEnd)
  }

  const scheduledMinutes = SCHEDULE_CATEGORIES.reduce((sum, category) => sum + categoryMinutes[category], 0)
  const workScheduledMinutes = SCHEDULE_CATEGORIES.reduce((sum, category) => sum + categoryWorkMinutes[category], 0)
  const scheduledPercent = percent(scheduledMinutes, activeAvailable)
  const loadLevel = getLoadLevel(scheduledPercent)
  const categories = SCHEDULE_CATEGORIES.reduce((acc, category) => {
    acc[category] = {
      minutes: categoryMinutes[category],
      percent: percent(categoryMinutes[category], activeAvailable),
      workMinutes: categoryWorkMinutes[category],
      workPercent: percent(categoryWorkMinutes[category], workAvailable),
    }
    return acc
  }, {} as Record<DailyScheduleBlockCategory, DailyScheduleCategoryLoad>)

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
    categories,
    loadLevel,
    recommendation: getLoadRecommendation(loadLevel),
  }
}

export function normalizeDailyScheduleForHash(schedule: DailySchedule): DailySchedule {
  if (schedule.version === 3) {
    const blocks = [...schedule.blocks].map(block => {
      if (block.kind === 'task') {
        return { id: block.id.trim(), kind: 'task' as const, taskIndex: block.taskIndex, taskText: block.taskText.trim(), category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id: block.id.trim(), kind: block.kind, title: block.title.trim(), category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }).sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
    return { ...schedule, timezone: schedule.timezone.trim(), blocks } as DailySchedule
  }
  const blocks = [...schedule.blocks].map(block => {
    if (isServiceBlock(block)) {
      return { id: block.id.trim(), kind: block.kind, title: block.title.trim(), startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }
    if ('kind' in block) {
      return { id: block.id.trim(), kind: 'task' as const, taskIndex: block.taskIndex, taskText: block.taskText.trim(), startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }
    return { id: block.id.trim(), taskIndex: block.taskIndex, taskText: block.taskText.trim(), startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
  }).sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id))
  return { ...schedule, timezone: schedule.timezone.trim(), blocks } as DailySchedule
}

export function hashDailySchedule(schedule: DailySchedule): string {
  return crypto.createHash('sha256').update(JSON.stringify(normalizeDailyScheduleForHash(schedule))).digest('hex')
}
