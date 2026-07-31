export const DAILY_SCHEDULE_TIME_STEP_MINUTES = 1
export const MIN_DAILY_SCHEDULE_BLOCK_DURATION_MINUTES = 15
export const DAILY_SCHEDULE_INTERACTION_STEP_MINUTES = 15

export function isTimeStep(value: number): boolean {
  return Number.isInteger(value) && value % DAILY_SCHEDULE_TIME_STEP_MINUTES === 0
}
