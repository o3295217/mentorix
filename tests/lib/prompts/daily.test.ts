import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { buildUserDataPrompt } from '@/lib/prompts/daily'
import { DailyEvaluationRequest } from '@/lib/prompts/types'

const promptSource = readFileSync('lib/prompts/daily.ts', 'utf8')

function buildRequest(overrides: Partial<DailyEvaluationRequest> = {}): DailyEvaluationRequest {
  return {
    date: '10.08.2026',
    planText: 'Задача 1',
    factText: 'Задача 1 сделана',
    goals: {
      dreamGoal: 'Своя продуктовая компания',
      yearGoals: [],
      halfYearGoals: [],
      quarterGoals: [],
      monthGoals: [],
      weekGoals: [],
    },
    openTasks: [],
    ...overrides,
  }
}

describe('daily evaluation prompt', () => {
  it('keeps recommendations for tomorrow and forbids "work right now"', () => {
    expect(promptSource).toContain('Рекомендации — на ЗАВТРА')
    expect(promptSource).toContain('НИКОГДА не предлагай «сядь поработай прямо сейчас»')
  })

  it('binds the late/early boundary to the observed activity window, not to a universal curfew', () => {
    expect(promptSource).toContain('Единственная граница «поздно/рано» — секция «НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ» в данных')
    expect(promptSource).toContain('НЕ выводят работу за пределы наблюдённого окна активности пользователя')
    expect(promptSource).toContain('Внутри окна поздние часы ЛЕГИТИМНЫ')
    expect(promptSource).toContain('Универсального правила «после 22:00 нельзя» не существует')
  })

  it('forbids reading the evaluation time as a signal about the user rhythm', () => {
    expect(promptSource).toContain('Время выполнения самой оценки — НЕ сигнал о режиме пользователя')
    expect(promptSource).toContain('Никаких выводов «уже поздно», «ночь на дворе», «пора спать» из него не делай')
  })

  it('falls back to the understanding profile when the rhythm is not observed', () => {
    expect(promptSource).toContain('Если режим НЕ наблюдён (мало данных) — действуй консервативно')
    expect(promptSource).toContain('НЕ изобретай хронотип')
  })

  it('forbids inventing the user chronotype outside the stored profile', () => {
    expect(promptSource).toContain('Утверждения о хронотипе и «сильном времени» пользователя бери ТОЛЬКО из его профиля понимания')
    expect(promptSource).toContain('Выдумывать «ночь — твоё сильное время» запрещено')
  })

  it('requires recommendations to respect the understanding profile', () => {
    expect(promptSource).toContain('Рекомендация не имеет права противоречить профилю понимания пользователя')
  })
})

describe('daily evaluation user prompt', () => {
  it('renders the observed rhythm window with the sample size', () => {
    const prompt = buildUserDataPrompt(buildRequest({
      observedRhythm: {
        observedStartMinutes: 11 * 60 + 30,
        observedEndMinutes: 24 * 60,
        sampleDays: 9,
        windowDays: 14,
      },
    }))

    expect(prompt).toContain('НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ: активность примерно 11:30–24:00 (по 9 принятым планам за 14 дней)')
  })

  it('says the rhythm is not observed when there is not enough data', () => {
    expect(buildUserDataPrompt(buildRequest())).toContain('НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ: режим не наблюдён (мало данных)')
    expect(buildUserDataPrompt(buildRequest({ observedRhythm: null }))).toContain('НАБЛЮДЁННЫЙ РЕЖИМ ДНЯ: режим не наблюдён (мало данных)')
  })
})
