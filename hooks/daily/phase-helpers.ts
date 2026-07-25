export type DailyPhase = 'neutral' | 'planning' | 'execution' | 'summary'

export type DailyPhaseInput = {
  selectedDate: string
  todayDate: string
  savedTaskCount: number
  totalTaskCount: number
  completedTaskCount: number
  currentMinutes: number
  workStartMinutes: number
  workEndMinutes: number
}

export function getDailyPhase({
  selectedDate,
  todayDate,
  savedTaskCount,
  totalTaskCount,
  completedTaskCount,
  currentMinutes,
  workStartMinutes,
  workEndMinutes,
}: DailyPhaseInput): DailyPhase {
  if (selectedDate !== todayDate) return 'neutral'
  if (totalTaskCount > 0 && completedTaskCount >= totalTaskCount) return 'summary'
  if (currentMinutes > workEndMinutes) return 'summary'
  if (savedTaskCount <= 0) return 'planning'
  if (currentMinutes < workStartMinutes) return 'planning'
  if (currentMinutes >= workStartMinutes && currentMinutes <= workEndMinutes) return 'execution'
  return 'neutral'
}

export function countSavedPlanTasks(planText: string | null | undefined): number {
  return (planText ?? '').split('\n').map(line => line.trim()).filter(Boolean).length
}
