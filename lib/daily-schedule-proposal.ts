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
  computeDailyScheduleLoadSummary,
  hashDailySchedule,
  isTimeStep,
} from '@/lib/daily-schedule'
import { isValidDateOnly } from '@/lib/dates'

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'Invalid calendar date')
export const TimezoneSchema = z.string().trim().min(1).max(100).regex(/^([A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*|UTC)$/, 'Expected IANA timezone')

export const DailyScheduleProposalV1BlockSchema = z.object({
  kind: z.enum(['task', 'meal', 'rest', 'buffer']),
  taskIndex: z.number().int().positive().optional(),
  taskText: z.string().trim().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(15).max(1440),
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
  durationMinutes: z.number().int().min(15).max(1440),
})

export const DailyScheduleProposalV2ServiceBlockSchema = z.object({
  kind: z.enum(['meal', 'rest', 'buffer']),
  title: z.string().trim().min(1).max(120),
  category: DailyScheduleBlockCategorySchema,
  isFixed: z.boolean(),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.number().int().min(15).max(1440),
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
    if (!isTimeStep(proposal[field])) ctx.addIssue({ code: 'custom', path: [field], message: `${field} must use 15 minute step` })
  }
  for (const [index, block] of proposal.blocks.entries()) {
    if (!isTimeStep(block.startMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'startMinutes'], message: 'startMinutes must use 15 minute step' })
    if (!isTimeStep(block.durationMinutes)) ctx.addIssue({ code: 'custom', path: ['blocks', index, 'durationMinutes'], message: 'durationMinutes must use 15 minute step' })
  }
})

export const DailyScheduleProposalSchema = z.union([DailyScheduleProposalV1Schema, DailyScheduleProposalV2Schema])

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

export const DailyScheduleProposalMetadataSchema = z.union([DailyScheduleProposalMetadataV1Schema, DailyScheduleProposalMetadataV2Schema])

export type DailyScheduleProposalV1Block = z.infer<typeof DailyScheduleProposalV1BlockSchema>
export type DailyScheduleProposalV2Block = z.infer<typeof DailyScheduleProposalV2BlockSchema>
export type DailyScheduleProposalV1 = z.infer<typeof DailyScheduleProposalV1Schema>
export type DailyScheduleProposalV2 = z.infer<typeof DailyScheduleProposalV2Schema>
export type DailyScheduleProposal = z.infer<typeof DailyScheduleProposalSchema>
export type DailyScheduleProposalMetadata = z.infer<typeof DailyScheduleProposalMetadataSchema>

function validateTaskBlocksAgainstCurrentPlan(proposal: DailyScheduleProposal, current: { date: string; timezone: string; planTasks: string[] }): { success: true } | { success: false; error: string } {
  if (proposal.date !== current.date) return { success: false, error: 'proposal date does not match current date' }
  if (proposal.timezone !== current.timezone) return { success: false, error: 'proposal timezone does not match request timezone' }
  for (const [index, block] of proposal.blocks.entries()) {
    if (block.kind !== 'task') continue
    const taskIndex = block.taskIndex
    if (typeof taskIndex !== 'number' || taskIndex < 1 || taskIndex > current.planTasks.length) {
      return { success: false, error: `task block ${index} references unknown taskIndex` }
    }
    const expectedText = current.planTasks[taskIndex - 1]
    if (block.taskText !== expectedText) {
      return { success: false, error: `task block ${index} taskText does not match current plan` }
    }
  }
  return { success: true }
}

export function validateProposalAgainstCurrentPlan(proposal: DailyScheduleProposal, current: { date: string; timezone: string; planTasks: string[] }): { success: true; data: DailyScheduleProposal } | { success: false; error: string } {
  const taskValidation = validateTaskBlocksAgainstCurrentPlan(proposal, current)
  if (!taskValidation.success) return taskValidation
  const schedule = proposalToDailySchedule(proposal)
  const validation = DailyScheduleSchema.safeParse(schedule)
  if (!validation.success) return { success: false, error: 'proposal cannot be converted to a valid schedule' }
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

export function proposalToDailyScheduleV3(proposal: DailyScheduleProposalV2): DailyScheduleV3 {
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
        return { id, kind: 'task', taskIndex: block.taskIndex, taskText: block.taskText, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id, kind: block.kind, title: block.title, category: block.category, isFixed: block.isFixed, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function proposalToDailySchedule(proposal: DailyScheduleProposal): DailyScheduleV2 | DailyScheduleV3 {
  return proposal.version === 1 ? proposalToDailyScheduleV2(proposal) : proposalToDailyScheduleV3(proposal)
}

export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposalV1; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): Extract<DailyScheduleProposalMetadata, { schemaVersion: 1 }>
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposalV2; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): Extract<DailyScheduleProposalMetadata, { schemaVersion: 2 }>
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposal; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): DailyScheduleProposalMetadata
export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposal; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): DailyScheduleProposalMetadata {
  const base = { type: 'daily_schedule_proposal' as const, date: input.date, createdAt: (input.createdAt ?? new Date()).toISOString(), currentScheduleExists: input.currentScheduleExists, currentScheduleHash: input.currentScheduleHash, appliedAt: null }
  if (input.proposal.version === 1) {
    return { ...base, schemaVersion: 1, proposal: input.proposal }
  }
  return { ...base, schemaVersion: 2, proposal: input.proposal, loadSummary: computeDailyScheduleLoadSummary(proposalToDailyScheduleV3(input.proposal)) }
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
  const schedule = proposalToDailyScheduleV2(validation.data.proposal)
  const scheduleValidation = DailyScheduleV2Schema.safeParse(schedule)
  return scheduleValidation.success ? validation.data : null
}

export function getProposalScheduleHash(metadata: DailyScheduleProposalMetadata): string {
  return hashDailySchedule(proposalToDailySchedule(metadata.proposal))
}
