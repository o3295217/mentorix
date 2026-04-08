/**
 * Миграция существующих данных: шифрование всех чувствительных полей.
 * 
 * Запуск:
 *   ENCRYPTION_KEY=<your-key> npx tsx scripts/encrypt-existing-data.ts
 * 
 * Безопасно запускать повторно — уже зашифрованные поля пропускаются.
 */

import { PrismaClient } from '@prisma/client'
import { encrypt, isEncrypted, ENCRYPTED_FIELDS } from '../lib/encryption'

const prisma = new PrismaClient()

async function migrateModel(modelName: string, fields: string[]) {
  const delegate = (prisma as unknown as Record<string, unknown>)[
    modelName.charAt(0).toLowerCase() + modelName.slice(1)
  ] as { findMany: () => Promise<Record<string, unknown>[]>; update: (args: unknown) => Promise<unknown> }

  if (!delegate?.findMany) {
    console.log(`  ⏭  ${modelName}: модель не найдена в Prisma Client, пропускаю`)
    return
  }

  const records = await delegate.findMany()
  let encrypted = 0
  let skipped = 0

  for (const record of records) {
    const updates: Record<string, string> = {}

    for (const field of fields) {
      const value = record[field]
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        updates[field] = encrypt(value)
      }
    }

    if (Object.keys(updates).length > 0) {
      await delegate.update({
        where: { id: record.id },
        data: updates,
      })
      encrypted++
    } else {
      skipped++
    }
  }

  console.log(`  ✅ ${modelName}: ${encrypted} зашифровано, ${skipped} пропущено (всего ${records.length})`)
}

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY не задан. Установите перед запуском:')
    console.error('   export ENCRYPTION_KEY=$(openssl rand -hex 32)')
    process.exit(1)
  }

  console.log('🔐 Начинаю шифрование существующих данных...\n')

  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    await migrateModel(model, fields)
  }

  console.log('\n✅ Миграция завершена.')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка миграции:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
