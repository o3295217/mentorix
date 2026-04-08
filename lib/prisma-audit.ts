import { Prisma } from '@prisma/client'

// Модели, для которых логируем write-операции
const AUDITED_MODELS = new Set([
  'DailyEntry', 'Evaluation', 'Goal', 'DreamGoal', 'YearGoal', 'PeriodGoal',
  'OpenTask', 'Habit', 'UserProfile', 'ProfileBlock', 'ProfileItem',
  'PeriodEvaluation', 'WorldContext', 'UserInsights', 'ChatMessage',
  'CompletedWork', 'WorkSummary', 'PlanningProfile',
])

const WRITE_ACTIONS = new Set(['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'])

// Контекст текущего запроса (задаётся из API-роута через setAuditContext)
let currentRequestContext: { userId?: string; ipAddress?: string; userAgent?: string } = {}

export function setAuditContext(ctx: { userId?: string; ipAddress?: string; userAgent?: string }) {
  currentRequestContext = ctx
}

/**
 * Prisma middleware для автоматического аудит-логирования write-операций.
 * Запись лога fire-and-forget — не замедляет ответ.
 */
export const auditMiddleware: Prisma.Middleware = async (params, next) => {
  const result = await next(params)

  const model = params.model
  if (!model || !AUDITED_MODELS.has(model) || !WRITE_ACTIONS.has(params.action)) {
    return result
  }

  let action: string
  if (params.action.startsWith('create')) action = 'create'
  else if (params.action.startsWith('update') || params.action === 'upsert') action = 'update'
  else action = 'delete'

  const resourceId = result?.id?.toString() || params.args?.where?.id?.toString() || undefined

  // Логируем через прямой импорт prisma (AuditLog не в AUDITED_MODELS — рекурсии не будет)
  const { prisma: db } = require('./prisma')
  db.auditLog.create({
    data: {
      userId: currentRequestContext.userId || null,
      action,
      resource: model,
      resourceId: resourceId || null,
      ipAddress: currentRequestContext.ipAddress || null,
      userAgent: currentRequestContext.userAgent || null,
    },
  }).catch((err: unknown) => {
    console.error('Audit middleware error:', err)
  })

  return result
}
