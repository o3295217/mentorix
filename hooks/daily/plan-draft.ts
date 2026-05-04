import type { DailyPlanDraft } from './types'

export function getPlanDraftKey(date: string): string {
  return `daily:planDraft:${date}`
}

export function parsePlanDraft(raw: string | null): DailyPlanDraft | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<DailyPlanDraft>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.updatedAt !== 'string') return null
    if (typeof parsed.planText !== 'string') return null
    if (!Array.isArray(parsed.selectedTaskIds)) return null

    const selectedTaskIds = parsed.selectedTaskIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .map((id) => Math.trunc(id))

    return {
      updatedAt: parsed.updatedAt,
      planText: parsed.planText,
      selectedTaskIds,
      newTaskText: typeof parsed.newTaskText === 'string' ? parsed.newTaskText : undefined,
    }
  } catch {
    return null
  }
}

export function readPlanDraftFromStorage(storage: Storage, date: string): DailyPlanDraft | null {
  return parsePlanDraft(storage.getItem(getPlanDraftKey(date)))
}

export function writePlanDraftToStorage(storage: Storage, date: string, draft: DailyPlanDraft) {
  storage.setItem(getPlanDraftKey(date), JSON.stringify(draft))
}

export function clearPlanDraftFromStorage(storage: Storage, date: string) {
  storage.removeItem(getPlanDraftKey(date))
}