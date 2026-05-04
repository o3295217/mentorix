import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma, type PrismaClient } from '@prisma/client'

type AuditRequestContext = {
  userId?: string
  ipAddress?: string
  userAgent?: string
}

// Модели, для которых логируем write-операции
const AUDITED_MODELS = new Set([
  'User',
  'DailyEntry', 'Evaluation', 'Goal', 'DreamGoal', 'YearGoal', 'PeriodGoal',
  'OpenTask', 'Habit', 'UserProfile', 'ProfileBlock', 'ProfileItem',
  'PeriodEvaluation', 'WorldContext', 'UserInsights', 'ChatMessage',
  'CompletedWork', 'WorkSummary', 'PlanningProfile',
])

const WRITE_ACTIONS = new Set(['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'])

const auditContextStorage = new AsyncLocalStorage<AuditRequestContext>()

export function setAuditContext(ctx: AuditRequestContext) {
  auditContextStorage.enterWith(ctx)
}

export function getAuditRequestContext(): AuditRequestContext {
  return auditContextStorage.getStore() ?? {}
}

/**
 * Prisma middleware для автоматического аудит-логирования write-операций.
 * Запись лога fire-and-forget — не замедляет ответ.
 */
export function createAuditMiddleware(db: PrismaClient): Prisma.Middleware {
  return async (params, next) => {
    const model = params.model
    const actionName = params.action
    const resourceIdFromWhere = params.args?.where?.id?.toString() || undefined

    const result = await next(params)

    if (!model || !AUDITED_MODELS.has(model) || !WRITE_ACTIONS.has(actionName)) {
      return result
    }

    let action: string
    if (actionName.startsWith('create')) action = 'create'
    else if (actionName.startsWith('update') || actionName === 'upsert') action = 'update'
    else action = 'delete'

    const resourceId = result?.id?.toString() || resourceIdFromWhere
    const requestContext = getAuditRequestContext()

    db.auditLog.create({
      data: {
        userId: requestContext.userId || null,
        action,
        resource: model,
        resourceId: resourceId || null,
        ipAddress: requestContext.ipAddress || null,
        userAgent: requestContext.userAgent || null,
      },
    }).catch((err: unknown) => {
      console.error('Audit middleware error:', err)
    })

    return result
  }
}
