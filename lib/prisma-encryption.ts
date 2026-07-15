import { Prisma } from '@prisma/client'
import { encrypt, decrypt, isEncrypted, isEncryptionEnabled, ENCRYPTED_FIELDS, ENCRYPTED_JSON_FIELDS } from './encryption'

const RELATION_MODEL_BY_MODEL: Record<string, Record<string, string>> = {
  User: {
    dreamGoals: 'DreamGoal',
    yearGoals: 'YearGoal',
    periodGoals: 'PeriodGoal',
    goals: 'Goal',
    dailyEntries: 'DailyEntry',
    openTasks: 'OpenTask',
    profile: 'UserProfile',
    profileBlocks: 'ProfileBlock',
    habits: 'Habit',
    insights: 'UserInsights',
    insightEntries: 'InsightEntry',
    periodEvaluations: 'PeriodEvaluation',
    worldContexts: 'WorldContext',
    chatMessages: 'ChatMessage',
    completedWork: 'CompletedWork',
    workSummaries: 'WorkSummary',
    planningProfile: 'PlanningProfile',
  },
  DailyEntry: { evaluation: 'Evaluation', schedule: 'DailySchedule' },
  DailySchedule: { dailyEntry: 'DailyEntry' },
  Evaluation: { dailyEntry: 'DailyEntry' },
  Goal: { parent: 'Goal', children: 'Goal' },
  ProfileBlock: { categories: 'ProfileCategory', items: 'ProfileItem' },
  ProfileCategory: { block: 'ProfileBlock', items: 'ProfileItem' },
  ProfileItem: { block: 'ProfileBlock', category: 'ProfileCategory' },
}

// Шифрует указанные поля в объекте data
function encryptFields(model: string, data: Record<string, unknown>): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model]
  if (!fields) return data

  const result = { ...data }
  const jsonFields = new Set(ENCRYPTED_JSON_FIELDS[model] || [])
  for (const field of fields) {
    const value = result[field]
    if (jsonFields.has(field)) {
      result[field] = encryptJsonField(value)
    } else if (typeof value === 'string' && value.length > 0) {
      result[field] = isEncrypted(value) ? value : encrypt(value)
    }
  }
  return result
}

// Расшифровывает указанные поля в объекте (результат запроса)
function decryptFields(model: string, record: Record<string, unknown>): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model]
  if (!fields) return record

  const jsonFields = new Set(ENCRYPTED_JSON_FIELDS[model] || [])
  for (const field of fields) {
    const value = record[field]
    if (jsonFields.has(field)) {
      record[field] = decryptJsonField(value)
    } else if (typeof value === 'string' && value.length > 0) {
      record[field] = decrypt(value)
    }
  }
  return record
}

function encryptJsonField(value: unknown): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    if (value.length === 0 || isEncrypted(value)) return value
    return encrypt(value)
  }

  return encrypt(JSON.stringify(value))
}

function decryptJsonField(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value

  const plaintext = decrypt(value)
  try {
    return JSON.parse(plaintext)
  } catch {
    return plaintext
  }
}

// Рекурсивно расшифровывает результат (объект, массив, или вложенные связи)
function decryptResult(model: string, result: unknown): unknown {
  if (result === null || result === undefined) return result
  if (Array.isArray(result)) {
    return result.map(item => decryptResult(model, item))
  }
  if (typeof result === 'object') {
    decryptFields(model, result as Record<string, unknown>)
    // Расшифровываем вложенные связи
    for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
      const relationModel = getRelationModel(model, key)
      if (value !== null && typeof value === 'object' && relationModel) {
        (result as Record<string, unknown>)[key] = decryptResult(relationModel, value)
      }
    }
  }
  return result
}

function getRelationModel(model: string, relationKey: string): string | undefined {
  return RELATION_MODEL_BY_MODEL[model]?.[relationKey]
}

// Prisma middleware для автоматического шифрования/расшифровки
export const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  if (!isEncryptionEnabled()) return next(params)

  const model = params.model
  if (!model) return next(params)
  const hasEncryptedFields = !!ENCRYPTED_FIELDS[model]
  const hasEncryptedRelations = !!RELATION_MODEL_BY_MODEL[model]

  // Шифрование при записи
  if (hasEncryptedFields && (params.action === 'create' || params.action === 'update' || params.action === 'upsert')) {
    if (params.args.data) {
      params.args.data = encryptFields(model, params.args.data)
    }
    // upsert имеет create и update
    if (params.action === 'upsert') {
      if (params.args.create) {
        params.args.create = encryptFields(model, params.args.create)
      }
      if (params.args.update) {
        params.args.update = encryptFields(model, params.args.update)
      }
    }
  }

  if (hasEncryptedFields && (params.action === 'createMany' || params.action === 'updateMany')) {
    if (params.args.data) {
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item: Record<string, unknown>) =>
          encryptFields(model, item)
        )
      } else {
        params.args.data = encryptFields(model, params.args.data)
      }
    }
  }

  // Выполняем запрос
  const result = await next(params)

  // Расшифровка при чтении
  if (
    params.action === 'findUnique' ||
    params.action === 'findFirst' ||
    params.action === 'findMany' ||
    params.action === 'create' ||
    params.action === 'update' ||
    params.action === 'upsert'
  ) {
    if (hasEncryptedFields || hasEncryptedRelations) {
      return decryptResult(model, result)
    }
  }

  return result
}
