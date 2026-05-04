import { describe, expect, it } from 'vitest'
import { hashToken } from '@/lib/auth'

describe('hashToken', () => {
  it('is deterministic and does not expose the raw token', () => {
    const token = 'reset-token-value'
    const hash = hashToken(token)

    expect(hash).toBe(hashToken(token))
    expect(hash).not.toBe(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})