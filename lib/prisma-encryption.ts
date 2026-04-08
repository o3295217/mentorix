import { Prisma } from '@prisma/client'
import { encrypt, decrypt, isEncryptionEnabled, ENCRYPTED_FIELDS } from './encryption'

// Шифрует указанные поля в объекте data
function encryptFields(model: string, data: Record<string, unknown>): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model]
  if (!fields) return data

  const result = { ...data }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value.length > 0) {
      result[field] = encrypt(value)
    }
  }
  return result
}

// Расшифровывает указанные поля в объекте (результат запроса)
function decryptFields(model: string, record: Record<string, unknown>): Record<string, unknown> {
  const fields = ENCRYPTED_FIELDS[model]
  if (!fields) return record

  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && value.length > 0) {
      record[field] = decrypt(value)
    }
  }
  return record
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
      if (value !== null && typeof value === 'object' && ENCRYPTED_FIELDS[capitalize(key)]) {
        (result as Record<string, unknown>)[key] = decryptResult(capitalize(key), value)
      }
    }
  }
  return result
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Prisma middleware для автоматического шифрования/расшифровки
export const encryptionMiddleware: Prisma.Middleware = async (params, next) => {
  if (!isEncryptionEnabled()) return next(params)

  const model = params.model
  if (!model || !ENCRYPTED_FIELDS[model]) return next(params)

  // Шифрование при записи
  if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
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

  if (params.action === 'createMany' || params.action === 'updateMany') {
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
    return decryptResult(model, result)
  }

  return result
}
