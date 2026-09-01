import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DailyScheduleSchema, hashDailySchedule } from '@/lib/daily-schedule'
import { getNewTasksFromProposal, hashDailyPlanTasks, proposalToDailySchedule, safeParseProposalMetadata, safeParseTaskListProposalMetadata, validateProposalAgainstCurrentPlan } from '@/lib/daily-schedule-proposal'
import { lockDailyEntryForScheduleMutation } from '@/lib/daily-schedule-lock'
import { parseDateParam } from '@/lib/dates'
import { safeParseJsonArray } from '@/lib/fact-utils'

export type ApplyScheduleProposalResult =
  | { status: 200; schedule: unknown; updatedAt: Date; applyStatus: 'created' | 'replaced' | 'already_applied'; proposalMessageId: number; planTasks: string[] }
  | { status: 400; error: string }
  | { status: 404 }
  | { status: 409; currentHash: string | null; error?: string }

export type ApplyTaskListProposalResult =
  | { status: 200; updatedAt: Date; applyStatus: 'created' | 'already_applied'; proposalMessageId: number; planText: string; planTasks: string[]; currentPlanTasksHash: string }
  | { status: 400; error: string }
  | { status: 404 }
  | { status: 409; currentPlanTasksHash: string; error?: string }

class ControlledScheduleApplyError extends Error {
  constructor(readonly result: Extract<ApplyScheduleProposalResult, { status: 409 }>) {
    super(result.error ?? 'Schedule conflict')
    this.name = 'ControlledScheduleApplyError'
  }
}

function splitPlanTasks(planText: string | null): string[] {
  return (planText ?? '').split('\n').map(line => line.trim()).filter(Boolean)
}

function normalizeTaskText(task: string): string {
  return task.trim().toLocaleLowerCase('ru-RU')
}

function appendPlanTasks(planText: string | null, newTasks: string[]): string {
  const normalizedNewTasks = newTasks.map(task => task.trim()).filter(Boolean)
  const currentPlanText = (planText ?? '').trimEnd()
  if (currentPlanText.length === 0) return normalizedNewTasks.join('\n')
  if (normalizedNewTasks.length === 0) return currentPlanText
  return `${currentPlanText}\n${normalizedNewTasks.join('\n')}`
}

function stripAppliedNewTasks(planTasks: string[], newTasks: string[]): string[] | null {
  if (newTasks.length === 0) return planTasks
  if (planTasks.length < newTasks.length) return null
  const suffix = planTasks.slice(planTasks.length - newTasks.length)
  const matches = suffix.every((task, index) => normalizeTaskText(task) === normalizeTaskText(newTasks[index]))
  return matches ? planTasks.slice(0, planTasks.length - newTasks.length) : null
}

function getV3PlanTasksConflict(input: { currentPlanTasksHash: string | null | undefined; basePlanTasks: string[] }): string | null {
  if (!input.currentPlanTasksHash) return null
  return hashDailyPlanTasks(input.basePlanTasks) === input.currentPlanTasksHash
    ? null
    : 'Список задач изменился после создания предложения. Попросите AI обновить расписание.'
}

function getNewTaskDuplicateConflict(planTasks: string[], newTasks: string[]): string | null {
  const existingTasks = new Set(planTasks.map(normalizeTaskText))
  const seenNewTasks = new Set<string>()
  for (const task of newTasks) {
    const normalized = normalizeTaskText(task)
    if (existingTasks.has(normalized)) return `Новая задача уже есть в текущем плане: ${task.trim()}`
    if (seenNewTasks.has(normalized)) return `Новая задача дублируется в предложении: ${task.trim()}`
    seenNewTasks.add(normalized)
  }
  return null
}

function getPlanTasksConflict(input: { currentPlanTasksHash: string; basePlanTasks: string[] }): string | null {
  return hashDailyPlanTasks(input.basePlanTasks) === input.currentPlanTasksHash
    ? null
    : 'Список задач изменился после создания предложения. Попросите AI обновить список.'
}

export async function applyDailyScheduleProposal(input: {
  userId: string
  date: string
  messageId: number
  replaceExisting: boolean
  expectedCurrentScheduleHash: string | null
}): Promise<ApplyScheduleProposalResult> {
  try {
    return await prisma.$transaction(async tx => {
      const entryIdentity = await tx.dailyEntry.findFirst({ where: { userId: input.userId, date: parseDateParam(input.date) }, select: { id: true } })
      if (!entryIdentity) return { status: 404 as const }
      await lockDailyEntryForScheduleMutation(tx, entryIdentity.id)

      const message = await tx.chatMessage.findFirst({ where: { id: input.messageId, userId: input.userId, date: input.date, role: 'assistant' }, select: { id: true, metadataJson: true } })
      if (!message) return { status: 404 as const }

      const metadata = safeParseProposalMetadata(message.metadataJson)
      if (!metadata || metadata.date !== input.date) return { status: 400 as const, error: 'Valid schedule proposal metadata not found' }

      const entry = await tx.dailyEntry.findFirst({ where: { id: entryIdentity.id, userId: input.userId, date: parseDateParam(input.date) }, select: { id: true, planText: true, selectedTasksJson: true, schedule: { select: { scheduleJson: true, updatedAt: true } } } })
      if (!entry) return { status: 404 as const }

      const storedScheduleValidation = entry.schedule ? DailyScheduleSchema.safeParse(entry.schedule.scheduleJson) : null
      if (entry.schedule && !storedScheduleValidation?.success) return { status: 409 as const, currentHash: null, error: 'Stored schedule is invalid' }
      const currentHash = storedScheduleValidation?.success ? hashDailySchedule(storedScheduleValidation.data) : null
      const planTasks = splitPlanTasks(entry.planText)
      const newTasks = metadata.proposal.version === 3 ? getNewTasksFromProposal(metadata.proposal).map(task => task.trim()) : []
      const basePlanTasksForProposal = metadata.proposal.version === 3 && metadata.appliedAt
        ? stripAppliedNewTasks(planTasks, newTasks)
        : planTasks
      if (!basePlanTasksForProposal) {
        return { status: 409 as const, currentHash, error: 'Список задач изменился после применения предложения. Попросите AI обновить расписание.' }
      }
      const proposalSchedule = proposalToDailySchedule(metadata.proposal, { currentPlanTaskCount: basePlanTasksForProposal.length })
      const proposalScheduleValidation = DailyScheduleSchema.safeParse(proposalSchedule)
      if (!proposalScheduleValidation.success) return { status: 400 as const, error: 'Proposal schedule is invalid' }
      const proposalHash = hashDailySchedule(proposalSchedule)

      if (input.expectedCurrentScheduleHash !== metadata.currentScheduleHash) {
        return { status: 409 as const, currentHash, error: 'Предложение устарело. Попросите ассистента собрать расписание заново.' }
      }

      if (metadata.appliedAt) {
        if (metadata.schemaVersion === 3) {
          const planTasksConflict = getV3PlanTasksConflict({ currentPlanTasksHash: metadata.currentPlanTasksHash, basePlanTasks: basePlanTasksForProposal })
          if (planTasksConflict) return { status: 409 as const, currentHash, error: planTasksConflict }
        }
        if (currentHash === proposalHash && storedScheduleValidation?.success && entry.schedule) return { status: 200 as const, schedule: storedScheduleValidation.data, updatedAt: entry.schedule.updatedAt, applyStatus: 'already_applied' as const, proposalMessageId: message.id, planTasks }
        return { status: 409 as const, currentHash, error: 'Schedule changed after proposal was applied' }
      }
      if (input.expectedCurrentScheduleHash !== currentHash) {
        return { status: 409 as const, currentHash, error: 'Расписание изменилось с момента предложения. Попросите ассистента собрать его заново.' }
      }
      // Пустая шкала (запись есть, блоков нет) существующей не считается —
      // та же семантика, что в чат-роуте при вычислении currentScheduleExists,
      // иначе применение без replaceExisting падает на очищенном таймлайне
      const storedScheduleHasBlocks = storedScheduleValidation?.success
        ? storedScheduleValidation.data.blocks.length > 0
        : !!entry.schedule
      if (!input.replaceExisting && entry.schedule && storedScheduleHasBlocks) {
        return { status: 409 as const, currentHash, error: 'На шкале уже есть расписание — замена требует подтверждения. Попросите ассистента собрать заново.' }
      }

      if (metadata.schemaVersion === 3) {
        const planTasksConflict = getV3PlanTasksConflict({ currentPlanTasksHash: metadata.currentPlanTasksHash, basePlanTasks: planTasks })
        if (planTasksConflict) return { status: 409 as const, currentHash, error: planTasksConflict }
      }

      // Задачи, которые пользователь согласился объединить/заменить новыми:
      // применение удаляет их из плана (черновик это проговорил, отмашка получена)
      const removeIndexes = metadata.proposal.version === 3
        ? [...new Set(metadata.proposal.removeTaskIndexes ?? [])].sort((a, b) => a - b)
        : []
      const removeIndexSet = new Set(removeIndexes)
      const keptPlanTasks = planTasks.filter((_, i) => !removeIndexSet.has(i + 1))

      const duplicateConflict = getNewTaskDuplicateConflict(keptPlanTasks, newTasks)
      if (duplicateConflict) return { status: 409 as const, currentHash, error: duplicateConflict }

      const proposalValidation = validateProposalAgainstCurrentPlan(metadata.proposal, { date: input.date, timezone: metadata.proposal.timezone, planTasks })
      if (!proposalValidation.success) return { status: 400 as const, error: proposalValidation.error }
      const planChanged = newTasks.length > 0 || removeIndexes.length > 0
      const updatedPlanText = appendPlanTasks(keptPlanTasks.join('\n'), newTasks)
      const updatedPlanTasks = planChanged ? splitPlanTasks(updatedPlanText) : planTasks

      if (planChanged) {
        // Отмеченные задачи хранятся 1-based индексами в строки плана —
        // при удалении строк индексы пересчитываются, удалённые выпадают
        const selectedIds = safeParseJsonArray<string | number>(entry.selectedTasksJson)
          .map(id => Number(id))
          .filter(id => Number.isInteger(id) && id > 0 && id <= planTasks.length)
        const remappedSelected = selectedIds
          .filter(id => !removeIndexSet.has(id))
          .map(id => id - removeIndexes.filter(removed => removed < id).length)
        await tx.dailyEntry.update({
          where: { id: entry.id },
          data: {
            planText: updatedPlanText,
            ...(removeIndexes.length > 0 && { selectedTasksJson: remappedSelected as unknown as Prisma.InputJsonValue }),
          },
          select: { id: true },
        })
      }

      const stored = await tx.dailySchedule.upsert({
        where: { dailyEntryId: entry.id },
        create: { dailyEntryId: entry.id, scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
        update: { scheduleJson: proposalSchedule as unknown as Prisma.InputJsonValue },
        select: { scheduleJson: true, updatedAt: true },
      })
      const persistedScheduleValidation = DailyScheduleSchema.safeParse(stored.scheduleJson)
      if (!persistedScheduleValidation.success) throw new ControlledScheduleApplyError({ status: 409 as const, currentHash: null, error: 'Persisted schedule is invalid' })
      await tx.chatMessage.update({ where: { id: message.id }, data: { metadataJson: { ...metadata, appliedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue } })
      return { status: 200 as const, schedule: persistedScheduleValidation.data, updatedAt: stored.updatedAt, applyStatus: entry.schedule ? 'replaced' as const : 'created' as const, proposalMessageId: message.id, planTasks: updatedPlanTasks }
    })
  } catch (error) {
    if (error instanceof ControlledScheduleApplyError) return error.result
    throw error
  }
}

export async function applyDailyTaskListProposal(input: {
  userId: string
  date: string
  messageId: number
  expectedCurrentPlanTasksHash: string
}): Promise<ApplyTaskListProposalResult> {
  return prisma.$transaction(async tx => {
    const entryIdentity = await tx.dailyEntry.findFirst({ where: { userId: input.userId, date: parseDateParam(input.date) }, select: { id: true } })
    if (!entryIdentity) return { status: 404 as const }
    await lockDailyEntryForScheduleMutation(tx, entryIdentity.id)

    const message = await tx.chatMessage.findFirst({ where: { id: input.messageId, userId: input.userId, date: input.date, role: 'assistant' }, select: { id: true, metadataJson: true } })
    if (!message) return { status: 404 as const }

    const metadata = safeParseTaskListProposalMetadata(message.metadataJson)
    if (!metadata || metadata.date !== input.date) return { status: 400 as const, error: 'Valid task list proposal metadata not found' }

    const entry = await tx.dailyEntry.findFirst({ where: { id: entryIdentity.id, userId: input.userId, date: parseDateParam(input.date) }, select: { id: true, planText: true, updatedAt: true } })
    if (!entry) return { status: 404 as const }

    const planTasks = splitPlanTasks(entry.planText)
    const newTasks = metadata.tasks.map(task => task.trim())
    const basePlanTasksForProposal = metadata.appliedAt ? stripAppliedNewTasks(planTasks, newTasks) : planTasks
    const currentPlanTasksHash = hashDailyPlanTasks(planTasks)

    if (input.expectedCurrentPlanTasksHash !== metadata.currentPlanTasksHash) {
      return { status: 409 as const, currentPlanTasksHash, error: 'Task list proposal base hash mismatch' }
    }

    if (!basePlanTasksForProposal) {
      return { status: 409 as const, currentPlanTasksHash, error: 'Список задач изменился после применения предложения. Попросите AI обновить список.' }
    }

    if (metadata.appliedAt) {
      const planTasksConflict = getPlanTasksConflict({ currentPlanTasksHash: metadata.currentPlanTasksHash, basePlanTasks: basePlanTasksForProposal })
      if (planTasksConflict) return { status: 409 as const, currentPlanTasksHash, error: planTasksConflict }
      return {
        status: 200 as const,
        updatedAt: entry.updatedAt,
        applyStatus: 'already_applied' as const,
        proposalMessageId: message.id,
        planText: entry.planText ?? '',
        planTasks,
        currentPlanTasksHash,
      }
    }

    const planTasksConflict = getPlanTasksConflict({ currentPlanTasksHash: metadata.currentPlanTasksHash, basePlanTasks: planTasks })
    if (planTasksConflict) return { status: 409 as const, currentPlanTasksHash, error: planTasksConflict }

    const duplicateConflict = getNewTaskDuplicateConflict(planTasks, newTasks)
    if (duplicateConflict) return { status: 409 as const, currentPlanTasksHash, error: duplicateConflict }

    const updatedPlanText = appendPlanTasks(entry.planText, newTasks)
    const updatedPlanTasks = splitPlanTasks(updatedPlanText)
    const updatedEntry = await tx.dailyEntry.update({ where: { id: entry.id }, data: { planText: updatedPlanText }, select: { planText: true, updatedAt: true } })
    const updatedPlanTasksHash = hashDailyPlanTasks(updatedPlanTasks)
    await tx.chatMessage.update({ where: { id: message.id }, data: { metadataJson: { ...metadata, appliedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue } })
    return {
      status: 200 as const,
      updatedAt: updatedEntry.updatedAt,
      applyStatus: 'created' as const,
      proposalMessageId: message.id,
      planText: updatedEntry.planText ?? updatedPlanText,
      planTasks: updatedPlanTasks,
      currentPlanTasksHash: updatedPlanTasksHash,
    }
  })
}
