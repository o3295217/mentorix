import { describe, expect, it } from 'vitest'
import { DailyScheduleProposalV3Schema, proposalToDailyScheduleV3, validateProposalAgainstCurrentPlan } from '@/lib/daily-schedule-proposal'
import type { z } from 'zod'

type ProposalV3 = z.infer<typeof DailyScheduleProposalV3Schema>

// План: 1..4; задачи 2 и 3 объединяются в новую (removeTaskIndexes), 1 и 4 остаются
const buildProposal = (): ProposalV3 => DailyScheduleProposalV3Schema.parse({
  version: 3,
  date: '2026-09-01',
  timezone: 'Asia/Yekaterinburg',
  dayStartMinutes: 600,
  dayEndMinutes: 1020,
  planningBasis: 'day_start',
  planningStartMinutes: 600,
  workEndMinutes: 1020,
  activityEndMinutes: 1020,
  newTasks: ['Монетизация: выбрать модель и инструмент оплаты'],
  removeTaskIndexes: [2, 3],
  blocks: [
    { kind: 'task', taskSource: 'existing', taskIndex: 1, taskText: 'Задача один', category: 'main', isFixed: false, startMinutes: 600, durationMinutes: 60 },
    { kind: 'task', taskSource: 'new', taskIndex: 1, taskText: 'Монетизация: выбрать модель и инструмент оплаты', category: 'main', isFixed: false, startMinutes: 660, durationMinutes: 60 },
    { kind: 'task', taskSource: 'existing', taskIndex: 4, taskText: 'Задача четыре', category: 'operational', isFixed: false, startMinutes: 720, durationMinutes: 60 },
  ],
})

describe('proposal v3 removeTaskIndexes', () => {
  it('пересчитывает индексы блоков под план без удалённых задач', () => {
    const schedule = proposalToDailyScheduleV3(buildProposal(), 4)
    const taskBlocks = schedule.blocks.filter(b => b.kind === 'task')
    // Итоговый план: [1:Задача один, 2:Задача четыре, 3:Монетизация(новая)]
    expect(taskBlocks.map(b => ('taskIndex' in b ? b.taskIndex : null))).toEqual([1, 3, 2])
  })

  it('схема отклоняет блок, ссылающийся на удаляемую задачу', () => {
    const raw = { ...buildProposal(), blocks: [
      { kind: 'task', taskSource: 'existing', taskIndex: 2, taskText: 'Задача два', category: 'main', isFixed: false, startMinutes: 600, durationMinutes: 60 },
    ] }
    expect(DailyScheduleProposalV3Schema.safeParse(raw).success).toBe(false)
  })

  it('валидация против плана отклоняет индекс за пределами плана', () => {
    const proposal = buildProposal()
    const result = validateProposalAgainstCurrentPlan(proposal, {
      date: '2026-09-01',
      timezone: 'Asia/Yekaterinburg',
      planTasks: ['Задача один', 'Задача два'], // задач всего 2, а removeTaskIndexes содержит 3
    })
    expect(result.success).toBe(false)
  })
})
