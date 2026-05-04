type ApiErrorPayload = {
  error?: unknown
  message?: unknown
}

export class FetchJsonError extends Error {
  status: number
  statusText: string
  url: string
  payload: unknown

  constructor(response: Response, message: string, payload?: unknown) {
    super(message)
    this.name = 'FetchJsonError'
    this.status = response.status
    this.statusText = response.statusText
    this.url = response.url
    this.payload = payload
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return value !== null && typeof value === 'object'
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function messageFromPayload(payload: unknown): string | undefined {
  if (!isApiErrorPayload(payload)) return undefined

  if (typeof payload.error === 'string') return payload.error
  if (typeof payload.message === 'string') return payload.message
  return undefined
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = await readResponsePayload(response)

  if (!response.ok) {
    const message = messageFromPayload(payload) || `HTTP ${response.status} ${response.statusText}`
    throw new FetchJsonError(response, message, payload)
  }

  return payload as T
}

export async function expectOk(response: Response): Promise<void> {
  if (response.ok) return

  const payload = await readResponsePayload(response)
  const message = messageFromPayload(payload) || `HTTP ${response.status} ${response.statusText}`
  throw new FetchJsonError(response, message, payload)
}

export function getFetchErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FetchJsonError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}