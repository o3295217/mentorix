import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeParseJson } from '@/lib/safe-json'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    expect(safeParseJson<{ ok: boolean }>('{"ok":true}', { ok: false })).toEqual({ ok: true })
  })

  it('returns fallback for empty or invalid JSON', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(safeParseJson(undefined, ['fallback'])).toEqual(['fallback'])
    expect(safeParseJson('not json', { value: 1 })).toEqual({ value: 1 })
    expect(consoleError).toHaveBeenCalledWith('[JSON Parse Error] Failed to parse:', 'not json')
  })

  it('returns already parsed JSON values unchanged', () => {
    expect(safeParseJson({ ok: true }, { ok: false })).toEqual({ ok: true })
    expect(safeParseJson(['a', 'b'], [])).toEqual(['a', 'b'])
  })
})