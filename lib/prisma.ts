import { PrismaClient } from '@prisma/client'
import { encryptionMiddleware } from './prisma-encryption'
import { createAuditMiddleware } from './prisma-audit'
import { userSoftDeleteMiddleware } from './prisma-user-soft-delete'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient()
  client.$use(encryptionMiddleware)
  client.$use(createAuditMiddleware(client))
  client.$use(userSoftDeleteMiddleware)
  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
