import { afterEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { encryptionMiddleware } from '@/lib/prisma-encryption'
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption'

const VALID_KEY = 'b'.repeat(64)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('prisma encryption middleware', () => {
  it('encrypts and decrypts configured JSON fields as parsed values', async () => {
    vi.stubEnv('ENCRYPTION_KEY', VALID_KEY)

    const params: Prisma.MiddlewareParams = {
      model: 'WorkSummary',
      action: 'create',
      args: {
        data: {
          summaryText: 'summary',
          keyAchievements: ['first', 'second'],
        },
      },
      dataPath: [],
      runInTransaction: false,
    }

    const result = await encryptionMiddleware(params, async (nextParams) => {
      const data = nextParams.args.data as Record<string, unknown>
      expect(typeof data.summaryText).toBe('string')
      expect(isEncrypted(data.summaryText as string)).toBe(true)
      expect(isEncrypted(data.keyAchievements as string)).toBe(true)
      expect(JSON.parse(decrypt(data.keyAchievements as string))).toEqual(['first', 'second'])

      return {
        summaryText: data.summaryText,
        keyAchievements: data.keyAchievements,
      }
    })

    expect(result).toEqual({
      summaryText: 'summary',
      keyAchievements: ['first', 'second'],
    })
  })

  it('leaves plaintext JSON values from direct scripts usable on read', async () => {
    vi.stubEnv('ENCRYPTION_KEY', VALID_KEY)

    const params: Prisma.MiddlewareParams = {
      model: 'WorkSummary',
      action: 'findFirst',
      args: {},
      dataPath: [],
      runInTransaction: false,
    }

    const result = await encryptionMiddleware(params, async () => ({
      summaryText: 'plain summary',
      keyAchievements: ['script achievement'],
    }))

    expect(result).toEqual({
      summaryText: 'plain summary',
      keyAchievements: ['script achievement'],
    })
  })

  it('encrypts and decrypts DailySchedule JSON through DailyEntry relation', async () => {
    vi.stubEnv('ENCRYPTION_KEY', VALID_KEY)

    const scheduleJson = {
      version: 1,
      timezone: 'Europe/Moscow',
      dayStartMinutes: 480,
      dayEndMinutes: 1080,
      blocks: [{ id: 'task-1', taskIndex: 1, taskText: 'Sensitive task', startMinutes: 540, durationMinutes: 60 }],
    }

    const params: Prisma.MiddlewareParams = {
      model: 'DailySchedule',
      action: 'create',
      args: { data: { scheduleJson } },
      dataPath: [],
      runInTransaction: false,
    }

    const result = await encryptionMiddleware(params, async (nextParams) => {
      const data = nextParams.args.data as Record<string, unknown>
      expect(isEncrypted(data.scheduleJson as string)).toBe(true)
      expect(JSON.parse(decrypt(data.scheduleJson as string))).toEqual(scheduleJson)

      return { scheduleJson: data.scheduleJson }
    })

    expect(result).toEqual({ scheduleJson })

    const relationResult = await encryptionMiddleware(
      {
        model: 'DailyEntry',
        action: 'findFirst',
        args: { include: { schedule: true } },
        dataPath: [],
        runInTransaction: false,
      },
      async () => ({ id: 1, schedule: { scheduleJson: encrypt(JSON.stringify(scheduleJson)) } })
    )

    expect(relationResult).toEqual({ id: 1, schedule: { scheduleJson } })
  })
})
