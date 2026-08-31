import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGoalsDecomposePrompt } from '@/lib/prompts/goals-decompose'
import { getWeekOfDate, parseWeekKey } from '@/lib/goals-utils'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const buildPrompt = (today: Date): string => {
  vi.useFakeTimers()
  vi.setSystemTime(today)
  return buildGoalsDecomposePrompt({
    dream: 'Запустить свой SaaS-продукт',
    dreamMonths: 18,
    yearGoals: {},
    periodGoals: {},
    selectedYear: today.getFullYear(),
    selectedMonth: today.getMonth(),
  })
}

// Перечень недель, который код передаёт модели готовым
const planWeekKeys = (prompt: string): string[] => {
  const blockStart = prompt.indexOf('ПЕРЕЧЕНЬ НЕДЕЛЬ ДЛЯ ПЛАНА')
  expect(blockStart).toBeGreaterThan(-1)
  const block = prompt.slice(blockStart)
  const blockEnd = block.indexOf('ЗАПРЕЩЕНО придумывать')
  expect(blockEnd).toBeGreaterThan(-1)
  return [...block.slice(0, blockEnd).matchAll(/\[WEEK:(\d{4}-\d{2}-W\d+)\]/g)].map((m) => m[1])
}

const CASES: { label: string; today: Date; expectedFirst: string }[] = [
  { label: 'W4 августа 2026 — впереди стыковая неделя', today: new Date(2026, 7, 24, 10), expectedFirst: '2026-09-W1' },
  { label: 'четверг W4 августа 2026', today: new Date(2026, 7, 27, 10), expectedFirst: '2026-09-W1' },
  { label: 'понедельник стыковой недели 31.08.2026', today: new Date(2026, 7, 31, 10), expectedFirst: '2026-09-W2' },
  { label: 'вторник 01.09.2026 — идёт неделя 2026-09-W1', today: new Date(2026, 8, 1, 10), expectedFirst: '2026-09-W2' },
  { label: 'воскресенье 06.09.2026 — конец стыковой недели', today: new Date(2026, 8, 6, 10), expectedFirst: '2026-09-W2' },
  { label: 'месяц с понедельника, июнь 2026', today: new Date(2026, 5, 22, 10), expectedFirst: '2026-07-W1' },
  { label: 'февраль 2027 ровно из 4 недель', today: new Date(2027, 1, 15, 10), expectedFirst: '2027-02-W4' },
  { label: 'стык года, декабрь 2026', today: new Date(2026, 11, 28, 10), expectedFirst: '2027-01-W1' },
]

describe('buildGoalsDecomposePrompt — перечень недель', () => {
  it.each(CASES)('$label: список непрерывен, без дырок и дублей', ({ today, expectedFirst }) => {
    const keys = planWeekKeys(buildPrompt(today))

    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys[0]).toBe(expectedFirst)

    const starts = keys.map((key) => parseWeekKey(key).weekStart)
    // Планирование начинается со следующей недели после текущей
    const currentWeekStart = getWeekOfDate(today).start
    expect(Math.round((starts[0].getTime() - currentWeekStart.getTime()) / 86_400_000)).toBe(7)

    // Ни одна неделя не потеряна на стыке месяцев
    for (let i = 1; i < starts.length; i++) {
      expect(Math.round((starts[i].getTime() - starts[i - 1].getTime()) / 86_400_000)).toBe(7)
    }

    // Каждый ключ действительно принадлежит своему месяцу-владельцу
    for (const key of keys) {
      expect(getWeekOfDate(parseWeekKey(key).weekStart).key).toBe(key)
    }
  })

  it('живой кейс: 24.08.2026 — стыковая неделя 31.08–06.09 передаётся модели явно', () => {
    const prompt = buildPrompt(new Date(2026, 7, 24, 10))

    // Неделя 31.08–06.09 существует ровно под одним ключом — сентябрьским
    expect(prompt).toContain('[WEEK:2026-09-W1] — 31.08–06.09')
    expect(prompt).toContain('[WEEK:2026-09-W2] — 07.09–13.09')
    expect(planWeekKeys(prompt)).toEqual([
      '2026-09-W1',
      '2026-09-W2',
      '2026-09-W3',
      '2026-09-W4',
    ])
    // Августовской W5 не существует: у августа 2026 всего 4 четверга
    expect(prompt).not.toContain('2026-08-W5')
  })

  it('не перечисляет прошедшие и текущую неделю', () => {
    const prompt = buildPrompt(new Date(2026, 7, 24, 10))
    const keys = planWeekKeys(prompt)

    expect(keys).not.toContain('2026-08-W4')
    expect(keys).not.toContain('2026-08-W3')
    expect(prompt).toContain('Текущая неделя: 2026-08-W4 (24.08–30.08)')
  })

  it('текущая неделя определяется по её четвергу, даже если понедельник в прошлом месяце', () => {
    const prompt = buildPrompt(new Date(2026, 8, 1, 10))

    expect(prompt).toContain('Текущая неделя: 2026-09-W1 (31.08–06.09)')
    // Текущая неделя не может попасть в собственный план
    expect(planWeekKeys(prompt)).not.toContain('2026-09-W1')
    expect(planWeekKeys(prompt)[0]).toBe('2026-09-W2')
  })

  it('31.08.2026 — первый день недели, принадлежащей уже сентябрю', () => {
    const prompt = buildPrompt(new Date(2026, 7, 31, 10))

    expect(prompt).toContain('Текущая неделя: 2026-09-W1 (31.08–06.09)')
    const keys = planWeekKeys(prompt)
    expect(keys).not.toContain('2026-09-W1')
    // Окно планирования отсчитывается от месяца-владельца: остаток сентября + октябрь
    expect(keys[0]).toBe('2026-09-W2')
    expect(keys).toContain('2026-10-W1')
  })

  it('пример плана в промпте использует ровно те же ключи недель', () => {
    const prompt = buildPrompt(new Date(2026, 7, 24, 10))
    const keys = planWeekKeys(prompt)

    const exampleStart = prompt.indexOf('Пример плана на 18 месяцев')
    expect(exampleStart).toBeGreaterThan(-1)
    const exampleKeys = [
      ...prompt.slice(exampleStart).matchAll(/\[WEEK:(\d{4}-\d{2}-W\d+)\]/g),
    ].map((m) => m[1])

    expect(exampleKeys).toEqual(keys)
  })

  it('не описывает месяц как «4 недели» — количество берётся из перечня', () => {
    const prompt = buildPrompt(new Date(2026, 7, 24, 10))

    expect(prompt).not.toContain('W1-W4')
    expect(prompt).not.toContain('4 недели следующего месяца')
  })

  it('объясняет модели правило четверга, а не понедельника', () => {
    const prompt = buildPrompt(new Date(2026, 7, 24, 10))

    expect(prompt).toContain('её ЧЕТВЕРГ')
    expect(prompt).toContain('месяц её четверга')
    expect(prompt).not.toContain('месяцу своего ПОНЕДЕЛЬНИКА')
  })

  it('граница года: список переходит из декабря в январь без разрыва', () => {
    const keys = planWeekKeys(buildPrompt(new Date(2026, 11, 15, 10)))

    expect(keys).toContain('2026-12-W5')
    expect(keys).toContain('2027-01-W1')
    const dec = keys.indexOf('2026-12-W5')
    expect(keys[dec + 1]).toBe('2027-01-W1')
  })
})
