import { prisma } from './prisma'

type AuditAction =
  | 'login' | 'logout' | 'register' | 'login_failed' | 'lockout'
  | 'password_change' | 'password_reset'
  | 'read' | 'create' | 'update' | 'delete'

interface AuditOptions {
  userId?: string | null
  action: AuditAction
  resource?: string
  resourceId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Записывает событие в аудит-лог.
 * Не бросает ошибки — логирование не должно ломать основной flow.
 */
export function audit(options: AuditOptions): void {
  prisma.auditLog.create({
    data: {
      userId: options.userId ?? null,
      action: options.action,
      resource: options.resource,
      resourceId: options.resourceId,
      details: options.details,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    },
  }).catch((err) => {
    console.error('Audit log error:', err)
  })
}

/**
 * Извлекает IP и User-Agent из Request для аудит-лога.
 */
export function getAuditContext(request: Request) {
  const ipAddress =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    undefined
  const userAgent = request.headers.get('user-agent') || undefined
  return { ipAddress, userAgent }
}
