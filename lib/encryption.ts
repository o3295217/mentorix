import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PREFIX = 'enc_v1:'

let encryptionKey: Buffer | null = null

function getKey(): Buffer {
  if (encryptionKey) return encryptionKey

  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error('ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32')
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  encryptionKey = Buffer.from(hex, 'hex')
  return encryptionKey
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return PREFIX + [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decrypt(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) return ciphertext

  const key = getKey()
  const parts = ciphertext.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function isEncryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_KEY
}

// Карта: модель → поля для шифрования
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  DreamGoal: ['goalText'],
  YearGoal: ['goalsJson'],
  PeriodGoal: ['goalsJson'],
  Goal: ['text', 'historyJson'],
  DailyEntry: [
    'planText', 'factText', 'planSnapshotJson', 'extraTasksJson',
    'emotionalState', 'physicalState', 'lifeEvents', 'externalFactors',
    'selectedTasksJson',
  ],
  Evaluation: [
    'feedbackText', 'planVsFactText',
    'alignmentDayWeek', 'alignmentWeekMonth', 'alignmentMonthQuarter',
    'alignmentQuarterHalf', 'alignmentHalfYear', 'alignmentYearDream',
    'healthFlag', 'familyFlag', 'energyFlag',
    'workHealthAlignment', 'workFamilyAlignment', 'workValuesAlignment',
    'recommendationsText', 'suggestedTasksJson',
  ],
  OpenTask: ['taskText'],
  UserProfile: [
    'name', 'occupation', 'industry', 'maritalStatus', 'hobbies',
    'sports', 'location', 'customInterests', 'education',
    'workExperience', 'values', 'challenges', 'other',
  ],
  ProfileBlock: ['title'],
  ProfileCategory: ['title'],
  ProfileItem: ['fieldName', 'fieldValue', 'content'],
  Habit: ['taskText'],
  PeriodEvaluation: [
    'professionalBlock', 'personalBlock', 'socialBlock', 'balanceBlock',
    'patterns', 'trends', 'goalsCompletion', 'alignment', 'blockers',
    'feedbackText', 'recommendationsText', 'insights',
  ],
  WorldContext: ['marketEvents', 'personalEvents', 'constraints', 'notes'],
  UserInsights: [
    'patterns', 'strengths', 'challenges', 'preferences',
    'recommendations', 'motivators', 'weeklySummary',
  ],
  InsightEntry: ['text'],
  CompletedWork: ['text'],
  WorkSummary: ['summaryText', 'keyAchievements'],
  ChatMessage: ['content'],
  PlanningProfile: ['constraints'],
}
