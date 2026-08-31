import { describe, expect, it } from 'vitest'
import {
  OBSERVED_RHYTHM_MIN_SAMPLE_DAYS,
  OBSERVED_RHYTHM_WINDOW_DAYS,
  ObservedDayRhythmSample,
  computeObservedDayRhythm,
  getLocalMinutesOfDay,
} from '@/lib/observed-day-rhythm'

const MOSCOW = 'Europe/Moscow' // UTC+3 круглый год, без переходов на летнее время

function scheduleJson(options: {
  start: number
  end: number
  timezone?: string
  blocks?: Array<{ start: number; duration: number }>
}) {
  const timezone = options.timezone ?? MOSCOW
  const blocks = (options.blocks ?? [{ start: options.start, duration: 60 }]).map((block, index) => ({
    id: `block-${index}`,
    kind: 'task' as const,
    taskIndex: index + 1,
    taskText: `Задача ${index + 1}`,
    category: 'main' as const,
    isFixed: false,
    startMinutes: block.start,
    durationMinutes: block.duration,
  }))

  return {
    version: 3,
    timezone,
    dayStartMinutes: options.start,
    dayEndMinutes: options.end,
    planningBasis: 'day_start',
    planningStartMinutes: options.start,
    workEndMinutes: options.end,
    activityEndMinutes: options.end,
    blocks,
  }
}

// Локальное московское время суток -> UTC-момент того же дня
function moscowMoment(dateKey: string, hours: number, minutes: number): Date {
  return new Date(`${dateKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+03:00`)
}

function daySample(options: {
  dateKey: string
  start: number
  end: number
  timezone?: string
  blocks?: Array<{ start: number; duration: number }>
  filledAt?: Array<Date | null | undefined>
}): ObservedDayRhythmSample {
  return {
    dateKey: options.dateKey,
    scheduleJson: scheduleJson(options),
    planFilledAt: options.filledAt ?? [],
  }
}

function dateKey(day: number): string {
  return `2026-08-${String(day).padStart(2, '0')}`
}

describe('getLocalMinutesOfDay', () => {
  it('переводит момент в локальные минуты суток пользователя', () => {
    expect(getLocalMinutesOfDay(new Date('2026-08-10T20:30:00Z'), MOSCOW)).toBe(23 * 60 + 30)
    expect(getLocalMinutesOfDay(new Date('2026-08-10T00:15:00Z'), MOSCOW)).toBe(3 * 60 + 15)
  })

  it('возвращает null на нераспознанной таймзоне', () => {
    expect(getLocalMinutesOfDay(new Date('2026-08-10T20:30:00Z'), 'Not/AZone')).toBeNull()
  })
})

describe('computeObservedDayRhythm', () => {
  it('сводит принятые расписания в медианное окно активности', () => {
    const samples = [
      daySample({ dateKey: dateKey(10), start: 9 * 60, end: 21 * 60 }),
      daySample({ dateKey: dateKey(11), start: 9 * 60 + 30, end: 21 * 60 + 30 }),
      daySample({ dateKey: dateKey(12), start: 8 * 60 + 30, end: 20 * 60 + 30 }),
      daySample({ dateKey: dateKey(13), start: 9 * 60, end: 21 * 60 }),
      daySample({ dateKey: dateKey(14), start: 9 * 60, end: 21 * 60 }),
    ]

    expect(computeObservedDayRhythm(samples)).toEqual({
      observedStartMinutes: 9 * 60,
      observedEndMinutes: 21 * 60,
      sampleDays: 5,
      windowDays: OBSERVED_RHYTHM_WINDOW_DAYS,
    })
  })

  it('не сужает окно принятого плана, даже если блоки стоят только в его середине', () => {
    const samples = [10, 11, 12].map(day => daySample({
      dateKey: dateKey(day),
      start: 10 * 60,
      end: 23 * 60,
      blocks: [{ start: 12 * 60, duration: 60 }, { start: 15 * 60, duration: 90 }],
    }))

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 10 * 60,
      observedEndMinutes: 23 * 60,
    })
  })

  it('не сдвигает окно из-за одного экстремального дня', () => {
    const samples = [
      ...[10, 11, 12, 13, 14, 15].map(day => daySample({ dateKey: dateKey(day), start: 7 * 60, end: 22 * 60 })),
      daySample({ dateKey: dateKey(16), start: 0, end: 1440 }),
    ]

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 7 * 60,
      observedEndMinutes: 22 * 60,
      sampleDays: 7,
    })
  })

  it('признаёт поздний режим, если пользователь регулярно так живёт', () => {
    const samples = [11, 12, 13, 14, 15].map(day => daySample({
      dateKey: dateKey(day),
      start: 11 * 60,
      end: 24 * 60,
    }))

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 11 * 60,
      observedEndMinutes: 24 * 60,
    })
  })

  it('расширяет окно временем заполнения плана, но не сужает его', () => {
    const samples = [11, 12, 13, 14].map(day => daySample({
      dateKey: dateKey(day),
      start: 9 * 60,
      end: 21 * 60,
      // План собирается поздно вечером и правится ещё позже
      filledAt: [moscowMoment(dateKey(day), 22, 40), moscowMoment(dateKey(day), 23, 30)],
    }))

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 9 * 60,
      observedEndMinutes: 23 * 60 + 30,
    })
  })

  it('игнорирует время заполнения плана, если таймзона не распознана', () => {
    const samples = [11, 12, 13, 14].map(day => daySample({
      dateKey: dateKey(day),
      start: 9 * 60,
      end: 21 * 60,
      timezone: 'Not/AZone',
      filledAt: [new Date('2026-08-10T20:40:00Z')],
    }))

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 9 * 60,
      observedEndMinutes: 21 * 60,
      sampleDays: 4,
    })
  })

  it('игнорирует единичные отметки заполнения: их меньше порога выборки', () => {
    const samples = [11, 12, 13, 14].map(day => daySample({
      dateKey: dateKey(day),
      start: 9 * 60,
      end: 21 * 60,
      filledAt: day === 11 ? [moscowMoment(dateKey(day), 2, 15)] : [],
    }))

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      observedStartMinutes: 9 * 60,
      observedEndMinutes: 21 * 60,
    })
  })

  it('возвращает null, когда принятых планов меньше порога', () => {
    const samples = [11, 12].map(day => daySample({ dateKey: dateKey(day), start: 9 * 60, end: 21 * 60 }))

    expect(samples.length).toBeLessThan(OBSERVED_RHYTHM_MIN_SAMPLE_DAYS)
    expect(computeObservedDayRhythm(samples)).toBeNull()
  })

  it('пропускает битые расписания и не считает их днями наблюдения', () => {
    const samples: ObservedDayRhythmSample[] = [
      { dateKey: dateKey(10), scheduleJson: null, planFilledAt: [] },
      { dateKey: dateKey(11), scheduleJson: { version: 3, timezone: '' }, planFilledAt: [] },
      daySample({ dateKey: dateKey(12), start: 9 * 60, end: 21 * 60 }),
      daySample({ dateKey: dateKey(13), start: 9 * 60, end: 21 * 60 }),
    ]

    expect(computeObservedDayRhythm(samples)).toBeNull()
  })

  it('не считает один календарный день дважды', () => {
    const samples = [
      daySample({ dateKey: dateKey(10), start: 9 * 60, end: 21 * 60 }),
      daySample({ dateKey: dateKey(10), start: 3 * 60, end: 23 * 60 }),
      daySample({ dateKey: dateKey(11), start: 9 * 60, end: 21 * 60 }),
      daySample({ dateKey: dateKey(12), start: 9 * 60, end: 21 * 60 }),
    ]

    expect(computeObservedDayRhythm(samples)).toMatchObject({
      sampleDays: 3,
      observedStartMinutes: 9 * 60,
      observedEndMinutes: 21 * 60,
    })
  })
})
