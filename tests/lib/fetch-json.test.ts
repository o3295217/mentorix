import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectOk, fetchJson, FetchJsonError, getFetchErrorMessage } from '@/lib/fetch-json'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchJson', () => {
  it('returns parsed JSON for ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))

    await expect(fetchJson<{ ok: boolean }>('/api/test')).resolves.toEqual({ ok: true })
  })

  it('throws FetchJsonError with API error message for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"Nope"}', { status: 400, statusText: 'Bad Request' })))

    await expect(fetchJson('/api/test')).rejects.toMatchObject({
      name: 'FetchJsonError',
      status: 400,
      message: 'Nope',
    })
  })

  it('checks non-JSON responses and formats fallback messages', async () => {
    const response = new Response('broken', { status: 502, statusText: 'Bad Gateway' })

    await expect(expectOk(response)).rejects.toBeInstanceOf(FetchJsonError)
    expect(getFetchErrorMessage(new Error('network down'), 'fallback')).toBe('network down')
    expect(getFetchErrorMessage('unknown', 'fallback')).toBe('fallback')
  })
})