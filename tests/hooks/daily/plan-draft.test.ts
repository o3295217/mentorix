import { describe, expect, it } from 'vitest'
import {
  clearPlanDraftFromStorage,
  getPlanDraftKey,
  getDailyChatStorageKey,
  parsePlanDraft,
  readPlanDraftFromStorage,
  sweepLegacyDailyStorage,
  writePlanDraftToStorage,
} from '@/hooks/daily/plan-draft'
import type { DailyPlanDraft } from '@/hooks/daily/types'

function createStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('daily plan draft helpers', () => {
  it('parses valid draft payloads and sanitizes selected task ids', () => {
    const draft = parsePlanDraft(JSON.stringify({
      updatedAt: '2026-05-02T00:00:00.000Z',
      planText: 'Task',
      selectedTaskIds: [1, '2', 2.9, 'bad'],
      newTaskText: 'Next',
    }))

    expect(draft).toEqual({
      updatedAt: '2026-05-02T00:00:00.000Z',
      planText: 'Task',
      selectedTaskIds: [1, 2, 2],
      newTaskText: 'Next',
    })
  })

  it('returns null for empty, malformed, or incomplete drafts', () => {
    expect(parsePlanDraft(null)).toBeNull()
    expect(parsePlanDraft('broken')).toBeNull()
    expect(parsePlanDraft(JSON.stringify({ updatedAt: 'x', planText: 'Task' }))).toBeNull()
  })

  it('reads, writes, and clears drafts in storage', () => {
    const storage = createStorage()
    const date = '2026-05-02'
    const draft: DailyPlanDraft = {
      updatedAt: '2026-05-02T00:00:00.000Z',
      planText: 'Task',
      selectedTaskIds: [1],
    }

    writePlanDraftToStorage(storage, 'user-1', date, draft)
    expect(storage.getItem(getPlanDraftKey('user-1', date))).toBeTruthy()
    expect(readPlanDraftFromStorage(storage, 'user-1', date)).toEqual(draft)
    expect(readPlanDraftFromStorage(storage, 'user-2', date)).toBeNull()

    clearPlanDraftFromStorage(storage, 'user-1', date)
    expect(readPlanDraftFromStorage(storage, 'user-1', date)).toBeNull()
  })

  it('ignores and sweeps legacy unscoped daily storage keys', () => {
    const storage = createStorage()
    storage.setItem('daily:planDraft:2026-05-02', JSON.stringify({ updatedAt: 'x', planText: 'Legacy', selectedTaskIds: [] }))
    storage.setItem('daily:chat:2026-05-02', '[]')
    storage.setItem(getPlanDraftKey('user-1', '2026-05-02'), JSON.stringify({ updatedAt: 'x', planText: 'Scoped', selectedTaskIds: [] }))
    storage.setItem(getDailyChatStorageKey('user-1', '2026-05-02'), '[]')

    expect(readPlanDraftFromStorage(storage, 'user-2', '2026-05-02')).toBeNull()
    expect(sweepLegacyDailyStorage(storage)).toBe(2)
    expect(storage.getItem('daily:planDraft:2026-05-02')).toBeNull()
    expect(storage.getItem('daily:chat:2026-05-02')).toBeNull()
    expect(storage.getItem(getPlanDraftKey('user-1', '2026-05-02'))).toBeTruthy()
    expect(storage.getItem(getDailyChatStorageKey('user-1', '2026-05-02'))).toBeTruthy()
  })
})
