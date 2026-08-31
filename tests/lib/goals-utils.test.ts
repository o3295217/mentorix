import { describe, expect, it } from 'vitest'
import {
  formatWeekRange,
  getMonthWeekKeys,
  getMonthWeeks,
  getPeriodKey,
  getWeekOfDate,
  getWeekStart,
  parseWeekKey,
  resolvePeriodMeta,
} from '@/lib/goals-utils'

// Неделя принадлежит месяцу своего ЧЕТВЕРГА (ISO 8601)
const range = (week: { start: Date; end: Date }) => formatWeekRange(week)

describe('getMonthWeeks — правило четверга', () => {
  it('август 2026 — 4 недели, последняя 24.08–30.08', () => {
    const weeks = getMonthWeeks(2026, 7)

    expect(weeks).toHaveLength(4)
    expect(weeks.map(range)).toEqual([
      '03.08–09.08',
      '10.08–16.08',
      '17.08–23.08',
      '24.08–30.08',
    ])
    // Неделя 31.08–06.09 в августе НЕ появляется — её четверг 03.09
    expect(weeks.some((w) => w.start.getDate() === 31)).toBe(false)
  })

  it('сентябрь 2026 — W1 это стыковая 31.08–06.09', () => {
    const weeks = getMonthWeeks(2026, 8)

    expect(weeks).toHaveLength(4)
    expect(weeks[0].key).toBe('2026-09-W1')
    expect(range(weeks[0])).toBe('31.08–06.09')
    expect(weeks[0].start.getMonth()).toBe(7) // понедельник — ещё август
    expect(range(weeks[3])).toBe('21.09–27.09')
  })

  it('октябрь 2026 — W1 это 28.09–04.10, всего 5 недель', () => {
    const weeks = getMonthWeeks(2026, 9)

    expect(weeks).toHaveLength(5)
    expect(range(weeks[0])).toBe('28.09–04.10')
    expect(range(weeks[4])).toBe('26.10–01.11')
  })

  it('месяц, начинающийся с понедельника (июнь 2026) — W1 с 1-го числа', () => {
    const weeks = getMonthWeeks(2026, 5)

    expect(weeks).toHaveLength(4)
    expect(range(weeks[0])).toBe('01.06–07.06')
    expect(range(weeks[3])).toBe('22.06–28.06')
  })

  it('февраль 2027 начинается с понедельника и укладывается ровно в 4 недели', () => {
    const weeks = getMonthWeeks(2027, 1)

    expect(weeks).toHaveLength(4)
    expect(range(weeks[0])).toBe('01.02–07.02')
    expect(range(weeks[3])).toBe('22.02–28.02')
  })

  it('високосный февраль 2024 — 5 недель, W1 начинается ещё в январе', () => {
    const weeks = getMonthWeeks(2024, 1)

    expect(weeks).toHaveLength(5)
    expect(range(weeks[0])).toBe('29.01–04.02')
    expect(range(weeks[4])).toBe('26.02–03.03')
  })

  it('граница года: декабрь 2026 W5 = 28.12–03.01, январь 2027 W1 = 04.01', () => {
    const dec = getMonthWeeks(2026, 11)
    const jan = getMonthWeeks(2027, 0)

    expect(dec).toHaveLength(5)
    expect(range(dec[0])).toBe('30.11–06.12')
    expect(dec[4].key).toBe('2026-12-W5')
    expect(range(dec[4])).toBe('28.12–03.01')
    expect(dec[4].end.getFullYear()).toBe(2027)

    expect(jan[0].key).toBe('2027-01-W1')
    expect(range(jan[0])).toBe('04.01–10.01')
    // Стык года без дырки
    const diff = Math.round((jan[0].start.getTime() - dec[4].start.getTime()) / 86_400_000)
    expect(diff).toBe(7)
  })

  it('в каждом месяце 4 или 5 недель, все начинаются с понедельника, четверг внутри месяца', () => {
    for (let year = 2024; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        const weeks = getMonthWeeks(year, month)
        expect(weeks.length).toBeGreaterThanOrEqual(4)
        expect(weeks.length).toBeLessThanOrEqual(5)
        weeks.forEach((week, i) => {
          expect(week.start.getDay()).toBe(1)
          expect(week.end.getDay()).toBe(0)
          expect(week.num).toBe(i + 1)
          const thursday = new Date(week.start)
          thursday.setDate(thursday.getDate() + 3)
          expect(thursday.getMonth()).toBe(month)
          expect(thursday.getFullYear()).toBe(year)
        })
      }
    }
  })

  it('недели соседних месяцев стыкуются без дырок и без дублей — включая границу года', () => {
    const all = []
    for (let month = 0; month < 12; month++) all.push(...getMonthWeeks(2026, month))
    all.push(...getMonthWeeks(2027, 0))

    expect(new Set(all.map((w) => w.key)).size).toBe(all.length)
    for (let i = 1; i < all.length; i++) {
      const diff = Math.round((all[i].start.getTime() - all[i - 1].start.getTime()) / 86_400_000)
      expect(diff).toBe(7)
    }
  })
})

describe('getMonthWeekKeys', () => {
  it('возвращает ключи в порядке недель месяца', () => {
    expect(getMonthWeekKeys(2026, 8)).toEqual(['2026-09-W1', '2026-09-W2', '2026-09-W3', '2026-09-W4'])
    expect(getMonthWeekKeys(2026, 9)).toHaveLength(5)
  })
})

describe('getWeekStart', () => {
  it('понедельник остаётся собой, воскресенье относится к прошедшему понедельнику', () => {
    expect(getWeekStart(new Date(2026, 7, 31)).getDate()).toBe(31)
    expect(getWeekStart(new Date(2026, 8, 6)).getDate()).toBe(31)
    expect(getWeekStart(new Date(2026, 8, 7)).getDate()).toBe(7)
  })
})

describe('getWeekOfDate — месяц определяется четвергом', () => {
  it('31.08.2026 и 01.09.2026 попадают в сентябрь W1', () => {
    expect(getWeekOfDate(new Date(2026, 7, 31)).key).toBe('2026-09-W1')
    expect(getWeekOfDate(new Date(2026, 8, 1)).key).toBe('2026-09-W1')
    expect(getWeekOfDate(new Date(2026, 8, 6)).key).toBe('2026-09-W1')
  })

  it('28.09.2026 уже относится к октябрю W1', () => {
    const week = getWeekOfDate(new Date(2026, 8, 28))
    expect(week.key).toBe('2026-10-W1')
    expect(week.month).toBe(9)
    expect(week.num).toBe(1)
  })

  it('граница года: 31.12.2026 — декабрь W5, 04.01.2027 — январь W1', () => {
    expect(getWeekOfDate(new Date(2026, 11, 31)).key).toBe('2026-12-W5')
    expect(getWeekOfDate(new Date(2027, 0, 3)).key).toBe('2026-12-W5')
    expect(getWeekOfDate(new Date(2027, 0, 4)).key).toBe('2027-01-W1')
  })

  it('согласован с getMonthWeeks для каждого дня недели', () => {
    for (let month = 0; month < 12; month++) {
      for (const week of getMonthWeeks(2026, month)) {
        for (let day = 0; day < 7; day++) {
          const d = new Date(week.start)
          d.setDate(d.getDate() + day)
          expect(getWeekOfDate(d).key).toBe(week.key)
        }
      }
    }
  })
})

describe('round-trip ключ ↔ даты', () => {
  it('parseWeekKey возвращает понедельник недели, даже если он в прошлом месяце', () => {
    const parsed = parseWeekKey('2026-09-W1')
    expect(parsed.weekStart.getDate()).toBe(31)
    expect(parsed.weekStart.getMonth()).toBe(7) // август
    expect(parsed.weekNum).toBe(1)
    expect(parsed.month).toBe(8) // месяц-владелец — сентябрь

    expect(parseWeekKey('2026-10-W1').weekStart.getDate()).toBe(28)
    expect(parseWeekKey('2026-12-W5').weekStart.getDate()).toBe(28)
  })

  it('parseWeekKey и getMonthWeeks дают одни и те же даты', () => {
    for (let month = 0; month < 12; month++) {
      for (const week of getMonthWeeks(2026, month)) {
        expect(parseWeekKey(week.key).weekStart.getTime()).toBe(week.start.getTime())
      }
    }
  })

  it('getPeriodKey строит тот же ключ, что getWeekOfDate', () => {
    expect(getPeriodKey('week', new Date(2026, 7, 31))).toBe('2026-09-W1')
    expect(getPeriodKey('week', new Date(2026, 8, 28))).toBe('2026-10-W1')
    for (let month = 0; month < 12; month++) {
      for (const week of getMonthWeeks(2026, month)) {
        expect(getPeriodKey('week', week.start)).toBe(week.key)
        expect(getPeriodKey('week', week.end)).toBe(week.key)
      }
    }
  })

  it('resolvePeriodMeta отдаёт понедельник недели — совместимо с хранением по датам', () => {
    const meta = resolvePeriodMeta('2026-09-W1')
    expect(meta?.periodType).toBe('week')
    expect(meta?.date.getDate()).toBe(31)
    expect(meta?.date.getMonth()).toBe(7)
  })
})
