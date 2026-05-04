import { describe, expect, it } from 'vitest'
import { buildPaginatedResponse, parsePaginationParams } from '@/lib/pagination'

describe('pagination helpers', () => {
  it('uses defaults when params are missing or invalid', () => {
    expect(parsePaginationParams(new URLSearchParams())).toEqual({ limit: 50, offset: 0 })
    expect(parsePaginationParams(new URLSearchParams('limit=bad&offset=-1'))).toEqual({ limit: 50, offset: 0 })
  })

  it('clamps limit to max and truncates numeric values', () => {
    expect(parsePaginationParams(new URLSearchParams('limit=250&offset=10.8'))).toEqual({ limit: 100, offset: 10 })
    expect(parsePaginationParams(new URLSearchParams('limit=25'), { defaultLimit: 20, maxLimit: 30 })).toEqual({ limit: 25, offset: 0 })
  })

  it('builds hasMore based on returned item count', () => {
    expect(buildPaginatedResponse({ items: [1, 2, 3], total: 10, limit: 3, offset: 0 })).toEqual({
      items: [1, 2, 3],
      total: 10,
      limit: 3,
      offset: 0,
      hasMore: true,
    })
    expect(buildPaginatedResponse({ items: [4], total: 4, limit: 3, offset: 3 }).hasMore).toBe(false)
  })
})