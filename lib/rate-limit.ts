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
  // Shared auth endpoints limits
  auth: {
    limit: 5,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'auth',
  },
  authRecovery: {
    limit: 3,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'auth-recovery',
  },
  authRegistration: {
    limit: 3,
    windowMs: 60 * 60 * 1000,
    keyPrefix: 'auth-register',
  },
  // AI endpoints - stricter limits (expensive)
  ai: {
    limit: 10, // 10 requests
    windowMs: 60 * 1000, // per minute
    keyPrefix: 'ai',
  },
} as const

// ==================== БЛОКИРОВКА АККАУНТА ====================

const MAX_FAILED_LOGINS = 10
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 минут

interface LockoutEntry {
  failedAttempts: number
  lockedUntil: number | null
}

const lockoutStore = new Map<string, LockoutEntry>()

/**
 * Фиксирует неудачную попытку входа для email.
 * После MAX_FAILED_LOGINS блокирует аккаунт на LOCKOUT_DURATION_MS.
 */
export function recordFailedLogin(email: string): { locked: boolean; attempts: number } {
  const key = email.toLowerCase()
  const entry = lockoutStore.get(key) || { failedAttempts: 0, lockedUntil: null }
  entry.failedAttempts++
  if (entry.failedAttempts >= MAX_FAILED_LOGINS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
    lockoutStore.set(key, entry)
    return { locked: true, attempts: entry.failedAttempts }
  }
  lockoutStore.set(key, entry)
  return { locked: false, attempts: entry.failedAttempts }
}

/**
 * Проверяет, заблокирован ли аккаунт.
 * Возвращает оставшееся время блокировки в секундах или 0.
 */
export function getAccountLockout(email: string): number {
  const entry = lockoutStore.get(email.toLowerCase())
  if (!entry?.lockedUntil) return 0
  const remaining = entry.lockedUntil - Date.now()
  if (remaining <= 0) {
    lockoutStore.delete(email.toLowerCase())
    return 0
  }
  return Math.ceil(remaining / 1000)
}

/**
 * Сбрасывает счётчик при успешном входе.
 */
export function resetFailedLogins(email: string): void {
  lockoutStore.delete(email.toLowerCase())
}
