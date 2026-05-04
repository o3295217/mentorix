export type PaginationParams = {
  limit: number
  offset: number
}

export type PaginationOptions = {
  defaultLimit?: number
  maxLimit?: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function parseNonNegativeInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined

  const integer = Math.trunc(parsed)
  return integer >= 0 ? integer : undefined
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT
  const maxLimit = options.maxLimit ?? MAX_LIMIT
  const rawLimit = parseNonNegativeInteger(searchParams.get('limit'))
  const rawOffset = parseNonNegativeInteger(searchParams.get('offset'))

  const limit = Math.min(rawLimit && rawLimit > 0 ? rawLimit : defaultLimit, maxLimit)
  const offset = rawOffset ?? 0

  return { limit, offset }
}

export function buildPaginatedResponse<T>(params: {
  items: T[]
  total: number
  limit: number
  offset: number
}) {
  const { items, total, limit, offset } = params

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  }
}