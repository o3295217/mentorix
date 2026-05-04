// Load .env.local manually
const fs = require('fs')
const envLines = fs.readFileSync('.env.local', 'utf8').split('\n')
envLines.forEach(line => {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
})
const crypto = require('crypto')
const PREFIX = 'enc_v1:'

function decrypt(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith(PREFIX)) return ciphertext || ''
  const hex = process.env.ENCRYPTION_KEY
  const key = Buffer.from(hex, 'hex')
  const parts = ciphertext.slice(PREFIX.length).split(':')
  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 28 апреля хранится как 2026-04-27T19:00:00Z (UTC+3 смещение)
  const entry = await prisma.dailyEntry.findFirst({
    where: { date: { gte: new Date('2026-04-27'), lt: new Date('2026-04-28') } },
    include: { evaluation: true }
  })
  if (!entry) { console.log('Запись не найдена'); return }

  const planText = decrypt(entry.planText || '')
  const selectedJson = decrypt(entry.selectedTasksJson || '')
  const extraJson = decrypt(entry.extraTasksJson || '')

  console.log('=== ПЛАН ДНЯ 28 АПРЕЛЯ ===')
  const planTasks = planText.split('\n').filter(t => t.trim())
  planTasks.forEach((t, i) => console.log((i+1) + '.', t))

  console.log('\n=== ВЫПОЛНЕННЫЕ (selectedTasksJson) ===')
  let selected = []
  try { selected = JSON.parse(selectedJson) } catch {}
  console.log('IDs:', selected)
  selected.forEach(id => {
    const task = planTasks[id - 1]
    if (task) console.log('  ✓', task)
  })

  console.log('\n=== НЕ ВЫПОЛНЕННЫЕ ===')
  planTasks.forEach((t, i) => {
    if (!selected.includes(i + 1)) console.log('  ✗', t)
  })

  console.log('\n=== EXTRA ЗАДАЧИ (сверх плана) ===')
  try { 
    const extras = JSON.parse(extraJson)
    if (extras.length === 0) console.log('нет')
    else extras.forEach(t => console.log('-', t))
  } catch { console.log(extraJson) }

  console.log('\n=== suggestedTasksJson (предложено ИИ) ===')
  const sug = entry.evaluation?.suggestedTasksJson
  if (sug) {
    try {
      const arr = JSON.parse(sug)
      if (arr.length === 0) console.log('пустой массив')
      else arr.forEach(t => console.log('-', t.taskText, '|', t.taskType))
    } catch { console.log(sug) }
  } else {
    console.log('null — ИИ не предложил задач или все уже перенесены')
  }

  // Также покажем OpenTask созданные в этот день
  console.log('\n=== OpenTask созданные 28-29 апреля ===')
  const openTasks = await prisma.openTask.findMany({
    where: { createdAt: { gte: new Date('2026-04-28'), lt: new Date('2026-04-30') } },
    orderBy: { createdAt: 'asc' }
  })
  if (openTasks.length === 0) console.log('нет')
  openTasks.forEach(t => {
    console.log('id:', t.id, '| type:', t.taskType, '| isClosed:', t.isClosed)
    console.log('text:', decrypt(t.taskText))
    console.log('created:', t.createdAt.toISOString())
  })

  await prisma.$disconnect()
}

main().catch(console.error)
