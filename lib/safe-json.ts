export function safeParseJson<T>(json: unknown, fallback: T): T {
  if (json === null || json === undefined || json === '') return fallback

  if (typeof json !== 'string') {
    if (Array.isArray(fallback) && !Array.isArray(json)) return fallback
    return json as T
  }

  try {
    const parsed = JSON.parse(json)

    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback

    return parsed as T
  } catch {
    console.error('[JSON Parse Error] Failed to parse:', json.substring(0, 100))
    return fallback
  }
}