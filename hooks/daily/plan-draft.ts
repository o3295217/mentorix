import type { DailyPlanDraft } from './types'

const legacyPlanDraftKeyPattern = /^daily:planDraft:\d{4}-\d{2}-\d{2}$/
const legacyChatKeyPattern = /^daily:chat:\d{4}-\d{2}-\d{2}$/

export function getPlanDraftKey(userId: string, date: string): string {
  return `daily:planDraft:${userId}:${date}`
}

export function getDailyChatStorageKey(userId: string, date: string): string {
  return `daily:chat:${userId}:${date}`
}

export function sweepLegacyDailyStorage(storage: Storage): number {
  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && (legacyPlanDraftKeyPattern.test(key) || legacyChatKeyPattern.test(key))) {
      keysToRemove.push(key)
    }
  }
  for (const key of keysToRemove) storage.removeItem(key)
  return keysToRemove.length
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

export function readPlanDraftFromStorage(storage: Storage, userId: string, date: string): DailyPlanDraft | null {
  return parsePlanDraft(storage.getItem(getPlanDraftKey(userId, date)))
}

export function writePlanDraftToStorage(storage: Storage, userId: string, date: string, draft: DailyPlanDraft) {
  storage.setItem(getPlanDraftKey(userId, date), JSON.stringify(draft))
}

export function clearPlanDraftFromStorage(storage: Storage, userId: string, date: string) {
  storage.removeItem(getPlanDraftKey(userId, date))
}
