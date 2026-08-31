import { prisma } from '@/lib/prisma'
import { DailySchedule, DailyScheduleSchema, MAX_MINUTES_IN_DAY, getBlockEndMinutes } from '@/lib/daily-schedule'

// НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ.
//
// Персональное окно активности пользователя, выведенное ИЗ ЕГО ПОВЕДЕНИЯ, а не из
// универсальных представлений о «правильном» режиме. Два источника сигнала:
//   1) часы, в которые расставлены задачи в ПРИНЯТЫХ расписаниях (строки daily_schedules
//      появляются только при применении предложения или ручном сохранении — черновики
//      живут в metadataJson чат-сообщений и сюда не попадают);
//   2) время суток, в которое пользователь заполняет план дня (createdAt/updatedAt
//      daily_entries), переведённое в локальные минуты по таймзоне пользователя.
//
// Время выполнения самой оценки сигналом НЕ является и здесь не участвует.
// Таймзона берётся только из scheduleJson.timezone принятых расписаний. Если её нет или
// она не распознаётся — сигнал заполнения плана просто пропускается, угадывать нельзя.

export const OBSERVED_RHYTHM_WINDOW_DAYS = 14
export const OBSERVED_RHYTHM_MIN_SAMPLE_DAYS = 3

export type ObservedDayRhythm = {
  observedStartMinutes: number
  observedEndMinutes: number
  sampleDays: number
  windowDays: number
}

// Один день наблюдения: принятое расписание + отметки времени заполнения плана.
export type ObservedDayRhythmSample = {
  dateKey: string
  scheduleJson: unknown
  planFilledAt: Array<Date | null | undefined>
}

function toDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// Минуты от начала локальных суток пользователя. null — если таймзона не поддерживается.
export function getLocalMinutesOfDay(date: Date, timeZone: string): number | null {
  if (Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date)
    const hour = Number(parts.find(part => part.type === 'hour')?.value)
    const minute = Number(parts.find(part => part.type === 'minute')?.value)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return (hour % 24) * 60 + minute
  } catch {
    return null
  }
}

// Интервал активности одного принятого расписания: объявленное окно, расширенное
// фактическими блоками. Для валидных расписаний блоки лежат внутри окна, но на
// исторических записях полагаться на это нельзя.
function getScheduleInterval(schedule: DailySchedule): { start: number; end: number } {
  let start = schedule.version === 3 ? schedule.planningStartMinutes : schedule.dayStartMinutes
  let end = schedule.version === 3 ? schedule.activityEndMinutes : schedule.dayEndMinutes

  for (const block of schedule.blocks) {
    start = Math.min(start, block.startMinutes)
    end = Math.max(end, getBlockEndMinutes(block))
  }

  return { start: clampMinutes(start), end: clampMinutes(end) }
}

function clampMinutes(value: number): number {
  return Math.max(0, Math.min(MAX_MINUTES_IN_DAY, Math.round(value)))
}

// Медиана — устойчивая к выбросам агрегация: один экстремальный день не сдвигает окно.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function resolveTimeZone(schedules: DailySchedule[]): string | null {
  for (const schedule of schedules) {
    const timeZone = schedule.timezone.trim()
    if (timeZone.length > 0 && isSupportedTimeZone(timeZone)) return timeZone
  }
  return null
}

// Чистая агрегация: из выборки дней собирает персональное окно активности.
// null — если принятых расписаний меньше OBSERVED_RHYTHM_MIN_SAMPLE_DAYS.
export function computeObservedDayRhythm(
  samples: ObservedDayRhythmSample[],
  options?: { windowDays?: number }
): ObservedDayRhythm | null {
  const windowDays = options?.windowDays ?? OBSERVED_RHYTHM_WINDOW_DAYS

  const scheduleByDate = new Map<string, DailySchedule>()
  const filledAtByDate = new Map<string, Array<Date | null | undefined>>()

  for (const sample of samples) {
    const validation = DailyScheduleSchema.safeParse(sample.scheduleJson)
    if (!validation.success) continue
    if (scheduleByDate.has(sample.dateKey)) continue
    scheduleByDate.set(sample.dateKey, validation.data)
    filledAtByDate.set(sample.dateKey, sample.planFilledAt)
  }

  if (scheduleByDate.size < OBSERVED_RHYTHM_MIN_SAMPLE_DAYS) return null

  const schedules = [...scheduleByDate.values()]
  const timeZone = resolveTimeZone(schedules)

  const scheduleStarts: number[] = []
  const scheduleEnds: number[] = []
  const earliestFills: number[] = []
  const latestFills: number[] = []

  for (const [dateKey, schedule] of scheduleByDate) {
    const interval = getScheduleInterval(schedule)
    scheduleStarts.push(interval.start)
    scheduleEnds.push(interval.end)

    if (!timeZone) continue
    const fillMinutes: number[] = []
    for (const filledAt of filledAtByDate.get(dateKey) ?? []) {
      if (!filledAt) continue
      const minutes = getLocalMinutesOfDay(filledAt, timeZone)
      if (minutes === null) continue
      fillMinutes.push(minutes)
    }
    if (fillMinutes.length === 0) continue
    earliestFills.push(Math.min(...fillMinutes))
    latestFills.push(Math.max(...fillMinutes))
  }

  let observedStartMinutes = median(scheduleStarts)
  let observedEndMinutes = median(scheduleEnds)

  // Время заполнения плана только РАСШИРЯЕТ окно: пользователь точно бодрствовал в этот
  // момент. Сузить окно оно не может — иначе редкий поздний план схлопнул бы день.
  if (earliestFills.length >= OBSERVED_RHYTHM_MIN_SAMPLE_DAYS) {
    observedStartMinutes = Math.min(observedStartMinutes, median(earliestFills))
  }
  if (latestFills.length >= OBSERVED_RHYTHM_MIN_SAMPLE_DAYS) {
    observedEndMinutes = Math.max(observedEndMinutes, median(latestFills))
  }

  if (observedEndMinutes < observedStartMinutes) {
    observedEndMinutes = observedStartMinutes
  }

  return {
    observedStartMinutes: clampMinutes(observedStartMinutes),
    observedEndMinutes: clampMinutes(observedEndMinutes),
    sampleDays: scheduleByDate.size,
    windowDays,
  }
}

// Загрузка выборки из БД. Расшифровка scheduleJson прозрачна: идёт через prisma-клиент проекта.
export async function getObservedDayRhythm(
  userId: string,
  options?: { now?: Date; windowDays?: number }
): Promise<ObservedDayRhythm | null> {
  const now = options?.now ?? new Date()
  const windowDays = options?.windowDays ?? OBSERVED_RHYTHM_WINDOW_DAYS
  const since = new Date(now.getTime())
  since.setUTCDate(since.getUTCDate() - windowDays)

  const rows = await prisma.dailySchedule.findMany({
    where: { dailyEntry: { userId, date: { gte: since, lte: now } } },
    select: {
      scheduleJson: true,
      dailyEntry: { select: { date: true, createdAt: true, updatedAt: true } },
    },
    orderBy: { dailyEntry: { date: 'desc' } },
    take: windowDays,
  })

  return computeObservedDayRhythm(
    rows.map(row => ({
      dateKey: toDateKey(row.dailyEntry.date),
      scheduleJson: row.scheduleJson,
      planFilledAt: [row.dailyEntry.createdAt, row.dailyEntry.updatedAt],
    })),
    { windowDays }
  )
}
