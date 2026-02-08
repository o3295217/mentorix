/**
 * Simple in-memory rate limiter for API routes
 * Uses fixed window algorithm
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute
let lastCleanup = Date.now()

function cleanupOldEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
  /** Key prefix for namespacing */
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param options - Rate limit options
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupOldEntries()

  const { limit, windowMs, keyPrefix = '' } = options
  const key = `${keyPrefix}:${identifier}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    }
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Increment count
  entry.count++
  return {
    success: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client identifier from request for pre-auth endpoints (login, register, etc.)
 * 
 * SECURITY: НЕ доверяет X-Forwarded-For — клиент может его подменить.
 * В production за reverse proxy (nginx) используем только заголовок,
 * который proxy устанавливает (X-Real-IP). Для дополнительной защиты
 * rate limit аутентифицированных эндпоинтов используйте userId напрямую.
 */
export function getClientIdentifier(request: Request): string {
  // X-Real-IP устанавливается reverse proxy и не может быть подменён клиентом
  // (при правильной конфигурации nginx: proxy_set_header X-Real-IP $remote_addr)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback: X-Forwarded-For — менее надёжен, но лучше чем ничего
  // Берём последний IP в цепочке (добавленный нашим proxy), а не первый (контролируемый клиентом)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim())
    // Последний IP в цепочке — добавлен нашим reverse proxy
    return ips[ips.length - 1]
  }

  // For local development, use a default
  return 'local-client'
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // AI endpoints - stricter limits (expensive)
  ai: {
    limit: 10, // 10 requests
    windowMs: 60 * 1000, // per minute
    keyPrefix: 'ai',
  },
} as const
