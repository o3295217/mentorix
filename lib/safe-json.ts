export function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback

  try {
    return JSON.parse(json) as T
  } catch {
    console.error('[JSON Parse Error] Failed to parse:', json.substring(0, 100))
    return fallback
  }
}