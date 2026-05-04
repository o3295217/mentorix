export function safeParseJson<T>(json: unknown, fallback: T): T {
  if (json === null || json === undefined || json === '') return fallback

  if (typeof json !== 'string') return json as T

  try {
    return JSON.parse(json) as T
  } catch {
    console.error('[JSON Parse Error] Failed to parse:', json.substring(0, 100))
    return fallback
  }
}