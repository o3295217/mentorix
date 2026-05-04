import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = new Date()

  const [sessions, passwordResetTokens, emailVerificationTokens] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    }),
  ])

  console.log(JSON.stringify({
    timestamp: now.toISOString(),
    deleted: {
      sessions: sessions.count,
      passwordResetTokens: passwordResetTokens.count,
      emailVerificationTokens: emailVerificationTokens.count,
    },
  }))
}

main()
  .catch((error) => {
    console.error('[cleanup-expired] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
