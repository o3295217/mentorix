import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'

const promptSource = readFileSync('lib/prompts/daily.ts', 'utf8')

describe('daily evaluation prompt', () => {
  it('forbids recommending night work and keeps recommendations for tomorrow', () => {
    expect(promptSource).toContain('не на «сегодня ночью»')
    expect(promptSource).toContain('сон и восстановление неприкосновенны')
  })

  it('forbids inventing the user chronotype outside the stored profile', () => {
    expect(promptSource).toContain('Утверждения о хронотипе и «сильном времени» пользователя бери ТОЛЬКО из его профиля понимания')
    expect(promptSource).toContain('Выдумывать «ночь — твоё сильное время» запрещено')
  })

  it('requires recommendations to respect the understanding profile', () => {
    expect(promptSource).toContain('Рекомендация не имеет права противоречить профилю понимания пользователя')
  })
})
