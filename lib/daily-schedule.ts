import crypto from 'crypto'
import { z } from 'zod'

export const TIME_STEP_MINUTES = 15
export const MAX_MINUTES_IN_DAY = 1440
const MAX_BLOCKS = 100

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

export const DailyScheduleSchema = z.union([DailyScheduleV1Schema, DailyScheduleV2Schema])

export type DailyScheduleV1Block = z.infer<typeof DailyScheduleV1BlockSchema>
export type DailyScheduleV2TaskBlock = z.infer<typeof DailyScheduleV2TaskBlockSchema>
export type DailyScheduleV2ServiceBlock = z.infer<typeof DailyScheduleV2ServiceBlockSchema> & { taskIndex?: never; taskText?: never }
export type DailyScheduleV2Block = DailyScheduleV2TaskBlock | DailyScheduleV2ServiceBlock
export type DailyScheduleBlock = DailyScheduleV1Block | DailyScheduleV2Block
export type DailyScheduleV1 = { version: 1; timezone: string; dayStartMinutes: number; dayEndMinutes: number; blocks: DailyScheduleV1Block[] }
export type DailyScheduleV2 = { version: 2; timezone: string; dayStartMinutes: number; dayEndMinutes: number; blocks: DailyScheduleV2Block[] }
export type DailySchedule = DailyScheduleV1 | DailyScheduleV2

export type DailyScheduleResponse = { schedule: DailySchedule | null; updatedAt: string | null; hash?: string | null }

export function isDailyScheduleV1(schedule: DailySchedule): schedule is DailyScheduleV1 { return schedule.version === 1 }
export function isDailyScheduleV2(schedule: DailySchedule): schedule is DailyScheduleV2 { return schedule.version === 2 }
export function isTaskBlock(block: DailyScheduleBlock): block is DailyScheduleV1Block | DailyScheduleV2TaskBlock { return !('kind' in block) || block.kind === 'task' }
export function isServiceBlock(block: DailyScheduleBlock): block is DailyScheduleV2ServiceBlock { return 'kind' in block && block.kind !== 'task' }

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

export function normalizeDailyScheduleForHash(schedule: DailySchedule): DailySchedule {
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
