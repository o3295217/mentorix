const DEFAULT_APP_URL = 'http://localhost:3000'

export function getAppUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL

  try {
    return new URL(rawUrl).origin
  } catch {
    return DEFAULT_APP_URL
  }
}

export function getAppHost(): string {
  return new URL(getAppUrl()).host
}