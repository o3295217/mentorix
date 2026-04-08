// Автономный скрипт шифрования — не требует tsx, lib/, scripts/
// Запуск: node /tmp/encrypt.js

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc_v1:';

const hex = process.env.ENCRYPTION_KEY;
if (!hex || hex.length !== 64) {
  console.error('ENCRYPTION_KEY not set or invalid (need 64 hex chars)');
  process.exit(1);
}
const KEY = Buffer.from(hex, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

const ENCRYPTED_FIELDS = {
  dreamGoal: ['goalText'],
  yearGoal: ['goalsJson'],
  periodGoal: ['goalsJson'],
  goal: ['text', 'historyJson'],
  dailyEntry: ['planText', 'factText', 'planSnapshotJson', 'extraTasksJson', 'emotionalState', 'physicalState', 'lifeEvents', 'externalFactors', 'selectedTasksJson'],
  evaluation: ['feedbackText', 'planVsFactText', 'alignmentDayWeek', 'alignmentWeekMonth', 'alignmentMonthQuarter', 'alignmentQuarterHalf', 'alignmentHalfYear', 'alignmentYearDream', 'healthFlag', 'familyFlag', 'energyFlag', 'workHealthAlignment', 'workFamilyAlignment', 'workValuesAlignment', 'recommendationsText', 'suggestedTasksJson'],
  openTask: ['taskText'],
  userProfile: ['name', 'occupation', 'industry', 'maritalStatus', 'hobbies', 'sports', 'location', 'customInterests', 'education', 'workExperience', 'values', 'challenges', 'other'],
  profileBlock: ['title'],
  profileCategory: ['title'],
  profileItem: ['fieldName', 'fieldValue', 'content'],
  habit: ['taskText'],
  periodEvaluation: ['professionalBlock', 'personalBlock', 'socialBlock', 'balanceBlock', 'patterns', 'trends', 'goalsCompletion', 'alignment', 'blockers', 'feedbackText', 'recommendationsText', 'insights'],
  worldContext: ['marketEvents', 'personalEvents', 'constraints', 'notes'],
  userInsights: ['patterns', 'strengths', 'challenges', 'preferences', 'recommendations', 'motivators', 'weeklySummary'],
  insightEntry: ['text'],
  completedWork: ['text'],
  workSummary: ['summaryText', 'keyAchievements'],
  chatMessage: ['content'],
  planningProfile: ['constraints'],
};

const prisma = new PrismaClient();

async function migrateModel(modelName, fields) {
  const delegate = prisma[modelName];
  if (!delegate || !delegate.findMany) {
    console.log('  skip', modelName);
    return;
  }
  const records = await delegate.findMany();
  let enc = 0, skip = 0;
  for (const record of records) {
    const updates = {};
    for (const field of fields) {
      const v = record[field];
      if (typeof v === 'string' && v.length > 0 && !isEncrypted(v)) {
        updates[field] = encrypt(v);
      }
    }
    if (Object.keys(updates).length > 0) {
      await delegate.update({ where: { id: record.id }, data: updates });
      enc++;
    } else {
      skip++;
    }
  }
  console.log('  ✅ ' + modelName + ': ' + enc + ' encrypted, ' + skip + ' skipped (' + records.length + ' total)');
}

(async () => {
  console.log('🔐 Encrypting existing data...\n');
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    await migrateModel(model, fields);
  }
  console.log('\n✅ Done.');
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
