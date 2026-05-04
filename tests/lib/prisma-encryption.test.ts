import { afterEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { encryptionMiddleware } from '@/lib/prisma-encryption'
import { decrypt, isEncrypted } from '@/lib/encryption'

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
})