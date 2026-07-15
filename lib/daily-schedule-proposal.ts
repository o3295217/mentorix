import crypto from 'crypto'
import { z } from 'zod'
import { DailyScheduleV2, DailyScheduleV2Schema, hashDailySchedule } from '@/lib/daily-schedule'

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const TimezoneSchema = z.string().trim().min(1).max(100).regex(/^([A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*|UTC)$/, 'Expected IANA timezone')

export const DailyScheduleProposalBlockSchema = z.object({
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

export const DailyScheduleProposalSchema = z.object({
  version: z.literal(1),
  date: DateSchema,
  timezone: TimezoneSchema,
  dayStartMinutes: z.number().int().min(0).max(1440),
  dayEndMinutes: z.number().int().min(0).max(1440),
  blocks: z.array(DailyScheduleProposalBlockSchema).min(1).max(100),
  rationale: z.string().trim().max(1000).optional(),
})

export const DailyScheduleProposalMetadataSchema = z.object({
  type: z.literal('daily_schedule_proposal'),
  schemaVersion: z.literal(1),
  date: DateSchema,
  createdAt: z.string().datetime(),
  currentScheduleExists: z.boolean().optional(),
  currentScheduleHash: z.string().length(64).nullable(),
  appliedAt: z.string().datetime().nullable().optional(),
  proposal: DailyScheduleProposalSchema,
}).transform(metadata => ({
  ...metadata,
  currentScheduleExists: metadata.currentScheduleExists ?? metadata.currentScheduleHash !== null,
}))

export type DailyScheduleProposal = z.infer<typeof DailyScheduleProposalSchema>
export type DailyScheduleProposalMetadata = z.infer<typeof DailyScheduleProposalMetadataSchema>

export function validateProposalAgainstCurrentPlan(proposal: DailyScheduleProposal, current: { date: string; timezone: string; planTasks: string[] }): { success: true; data: DailyScheduleProposal } | { success: false; error: string } {
  if (proposal.date !== current.date) return { success: false, error: 'proposal date does not match current date' }
  if (proposal.timezone !== current.timezone) return { success: false, error: 'proposal timezone does not match request timezone' }
  for (const [index, block] of proposal.blocks.entries()) {
    if (block.kind !== 'task') continue
    const taskIndex = block.taskIndex
    if (!taskIndex || taskIndex < 1 || taskIndex > current.planTasks.length) {
      return { success: false, error: `task block ${index} references unknown taskIndex` }
    }
    const expectedText = current.planTasks[taskIndex - 1]
    if (block.taskText !== expectedText) {
      return { success: false, error: `task block ${index} taskText does not match current plan` }
    }
  }
  const schedule = proposalToDailyScheduleV2(proposal)
  const validation = DailyScheduleV2Schema.safeParse(schedule)
  if (!validation.success) return { success: false, error: 'proposal cannot be converted to a valid schedule' }
  return { success: true, data: proposal }
}

export function proposalToDailyScheduleV2(proposal: DailyScheduleProposal): DailyScheduleV2 {
  return {
    version: 2,
    timezone: proposal.timezone,
    dayStartMinutes: proposal.dayStartMinutes,
    dayEndMinutes: proposal.dayEndMinutes,
    blocks: proposal.blocks.map((block, index) => {
      const id = `srv-${crypto.createHash('sha1').update(`${proposal.date}:${index}:${block.kind}:${block.startMinutes}:${block.durationMinutes}`).digest('hex').slice(0, 16)}`
      if (block.kind === 'task') {
        return { id, kind: 'task', taskIndex: block.taskIndex!, taskText: block.taskText!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
      }
      return { id, kind: block.kind, title: block.title!, startMinutes: block.startMinutes, durationMinutes: block.durationMinutes }
    }),
  }
}

export function createProposalMetadata(input: { date: string; proposal: DailyScheduleProposal; currentScheduleHash: string | null; currentScheduleExists: boolean; createdAt?: Date }): DailyScheduleProposalMetadata {
  return { type: 'daily_schedule_proposal', schemaVersion: 1, date: input.date, createdAt: (input.createdAt ?? new Date()).toISOString(), currentScheduleExists: input.currentScheduleExists, currentScheduleHash: input.currentScheduleHash, appliedAt: null, proposal: input.proposal }
}

export function safeParseProposalMetadata(value: unknown): DailyScheduleProposalMetadata | null {
  const validation = DailyScheduleProposalMetadataSchema.safeParse(value)
  return validation.success ? validation.data : null
}

export function getProposalScheduleHash(metadata: DailyScheduleProposalMetadata): string {
  return hashDailySchedule(proposalToDailyScheduleV2(metadata.proposal))
}
