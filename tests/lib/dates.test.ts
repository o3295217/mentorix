import { describe, expect, it } from 'vitest'
import { parseDateParam, validateAiDateRange } from '@/lib/dates'

describe('parseDateParam', () => {
  it('parses date-only values as local dates', () => {
    const date = parseDateParam('2026-05-01')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(4)
    expect(date.getDate()).toBe(1)
  })
})

describe('validateAiDateRange', () => {
  it('accepts an inclusive one-year range', () => {
    expect(validateAiDateRange({
      periodType: 'year',
      startDate: parseDateParam('2026-01-01'),
      endDate: parseDateParam('2026-12-31'),
      label: 'Base period',
    })).toEqual({ success: true, days: 365 })
  })

  it('rejects invalid, reversed, and oversized ranges', () => {
    expect(validateAiDateRange({
      periodType: 'week',
      startDate: new Date('invalid'),
      endDate: parseDateParam('2026-05-01'),
      label: 'Period',
    }).success).toBe(false)

    expect(validateAiDateRange({
      periodType: 'week',
      startDate: parseDateParam('2026-05-08'),
      endDate: parseDateParam('2026-05-01'),
      label: 'Period',
    }).success).toBe(false)

    expect(validateAiDateRange({
      periodType: 'custom',
      startDate: parseDateParam('2026-01-01'),
      endDate: parseDateParam('2027-01-03'),
      label: 'Custom period',
    }).success).toBe(false)
  })
})