import type { DailySchedule } from '@/lib/daily-schedule'
import type { OpenTask } from '@/lib/types'
import { isTaskScheduleBlock, minutesToTimeLabel } from './schedule-helpers'

export type TaskTimeChip = {
  label: string
  extraCount: number
  firstStartMinutes: number
}

export function getTaskTimeChips(schedule: DailySchedule | null): Map<number, TaskTimeChip> {
  const byTask = new Map<number, Array<{ startMinutes: number; endMinutes: number }>>()
  if (!schedule) return new Map()

  for (const block of schedule.blocks) {
    if (!isTaskScheduleBlock(block)) continue
    const blocks = byTask.get(block.taskIndex) ?? []
    blocks.push({ startMinutes: block.startMinutes, endMinutes: block.startMinutes + block.durationMinutes })
    byTask.set(block.taskIndex, blocks)
  }

  const chips = new Map<number, TaskTimeChip>()
  for (const [taskIndex, blocks] of byTask.entries()) {
    const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes)
    const first = sorted[0]
    if (!first) continue
    chips.set(taskIndex, {
      label: `${minutesToTimeLabel(first.startMinutes)}–${minutesToTimeLabel(first.endMinutes)}`,
      extraCount: Math.max(0, sorted.length - 1),
      firstStartMinutes: first.startMinutes,
    })
  }
  return chips
}

export function sortTasksByScheduleTime(tasks: OpenTask[], chips: Map<number, TaskTimeChip>, planTasks: OpenTask[] = tasks): OpenTask[] {
  return [...tasks].sort((a, b) => {
    const aIndex = planTasks.findIndex(task => task.id === a.id) + 1
    const bIndex = planTasks.findIndex(task => task.id === b.id) + 1
    const aChip = chips.get(aIndex)
    const bChip = chips.get(bIndex)
    if (aChip && bChip) return aChip.firstStartMinutes - bChip.firstStartMinutes || aIndex - bIndex
    if (aChip) return -1
    if (bChip) return 1
    return aIndex - bIndex
  })
}

export function getTaskTimeChipLabel(chip: TaskTimeChip | undefined): string | null {
  if (!chip) return null
  return chip.extraCount > 0 ? `${chip.label} +${chip.extraCount}` : chip.label
}
