import type { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lockDailyEntryForScheduleMutation } from '@/lib/daily-schedule-lock'

describe('lockDailyEntryForScheduleMutation', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('locks the mapped daily_entries table row with a parameterized id', async () => {
    const queryRaw = vi.fn().mockResolvedValue([])
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient

    await lockDailyEntryForScheduleMutation(tx, 42)

    expect(queryRaw).toHaveBeenCalledOnce()
    const call = queryRaw.mock.calls[0] as [TemplateStringsArray, number]
    const sql = Array.from(call[0]).join('?')

    expect(sql).toBe('SELECT id FROM "daily_entries" WHERE id = ? FOR UPDATE')
    expect(sql).not.toContain('"DailyEntry"')
    expect(call[1]).toBe(42)
  })
})
