export function getEncryptionKeyHex(): string | undefined {
  return process.env.ENCRYPTION_KEY?.trim()
}

export function assertEncryptionConfig() {
  const hex = getEncryptionKeyHex()

  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required when NODE_ENV=production. Generate with: openssl rand -hex 32')
    }
    return
  }

  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32')
  }
}
