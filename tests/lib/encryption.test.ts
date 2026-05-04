import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertEncryptionConfig, decrypt, encrypt, isEncrypted, isEncryptionEnabled } from '@/lib/encryption'

const VALID_KEY = 'a'.repeat(64)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('encryption helpers', () => {
  it('encrypts and decrypts a value', () => {
    vi.stubEnv('ENCRYPTION_KEY', VALID_KEY)

    const encrypted = encrypt('секретный текст')

    expect(encrypted).not.toBe('секретный текст')
    expect(isEncrypted(encrypted)).toBe(true)
    expect(decrypt(encrypted)).toBe('секретный текст')
  })

  it('returns plaintext unchanged when value is not encrypted', () => {
    expect(isEncrypted('plain')).toBe(false)
    expect(decrypt('plain')).toBe('plain')
  })

  it('validates production encryption config', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ENCRYPTION_KEY', '')

    expect(() => assertEncryptionConfig()).toThrow(/ENCRYPTION_KEY is required/)

    vi.stubEnv('ENCRYPTION_KEY', 'not-a-key')
    expect(() => assertEncryptionConfig()).toThrow(/64 hex characters/)

    vi.stubEnv('ENCRYPTION_KEY', VALID_KEY)
    expect(isEncryptionEnabled()).toBe(true)
  })
})