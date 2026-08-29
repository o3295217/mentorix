import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAssistantTextSanitizer, sanitizeAssistantText } from '@/lib/assistant-text'

afterEach(() => {
  vi.unstubAllEnvs()
})

function pushAll(chunks: string[]): string {
  const sanitizer = createAssistantTextSanitizer()
  return chunks.map(chunk => sanitizer.push(chunk)).join('') + sanitizer.flush()
}

describe('sanitizeAssistantText', () => {
  it('leaves a valid assistant reply byte for byte', () => {
    const text = 'Собрал расписание — проверь карточку и нажми «Применить».\n\nНа сбор списка заложил полтора часа, поправь, если иначе.'

    expect(sanitizeAssistantText(text)).toBe(text)
  })

  it('does not touch comparisons and angle brackets in normal speech', () => {
    const text = 'Перерыв <15 мин смысла не имеет, а задача >2 часов требует отдыха: 5 < 7 и 7 > 5.'

    expect(sanitizeAssistantText(text)).toBe(text)
  })

  it('strips the live tool-syntax leftovers from the end of the reply', () => {
    const text = 'Собрал расписание — проверь карточку и нажми «Применить».</anionale> </invoke>'

    expect(sanitizeAssistantText(text)).toBe('Собрал расписание — проверь карточку и нажми «Применить».')
  })

  it('strips opening service tags with attributes', () => {
    const text = 'Готово. <invoke name="propose_daily_schedule"><parameter name="version">3</parameter> Проверь карточку.'

    expect(sanitizeAssistantText(text)).toBe('Готово. 3 Проверь карточку.')
  })

  it('strips antml-like constructions in any casing', () => {
    expect(sanitizeAssistantText('Текст <invoke name="x"> и хвост </INVOKE>')).toBe('Текст и хвост')
    expect(sanitizeAssistantText('Текст <antml_parameter> дальше')).toBe('Текст дальше')
  })

  it('drops a service tag truncated by the end of the stream', () => {
    expect(sanitizeAssistantText('Проверь карточку.</invo')).toBe('Проверь карточку.')
    expect(sanitizeAssistantText('Проверь карточку. <invoke name="prop')).toBe('Проверь карточку.')
  })

  it('keeps a lone angle bracket and a short non-service fragment at the end', () => {
    expect(sanitizeAssistantText('Уложимся, если задача <')).toBe('Уложимся, если задача <')
    expect(sanitizeAssistantText('Норма при загрузке <8')).toBe('Норма при загрузке <8')
  })
})

describe('createAssistantTextSanitizer', () => {
  it('passes a clean stream through unchanged, chunk by chunk', () => {
    const chunks = ['Собрал расписание', ' — проверь карточку', ' и нажми «Применить».']

    expect(pushAll(chunks)).toBe('Собрал расписание — проверь карточку и нажми «Применить».')
  })

  it('removes a service tag split across stream deltas', () => {
    expect(pushAll(['Проверь карточку.', '</inv', 'oke>', ' Готово.'])).toBe('Проверь карточку. Готово.')
    expect(pushAll(['Текст ', '<invoke na', 'me="x">', 'дальше'])).toBe('Текст дальше')
  })

  it('never leaks a partial tag before it is resolved', () => {
    const sanitizer = createAssistantTextSanitizer()

    expect(sanitizer.push('Проверь карточку.')).toBe('Проверь карточку.')
    expect(sanitizer.push('</invo')).toBe('')
    expect(sanitizer.push('ke>')).toBe('')
    expect(sanitizer.flush()).toBe('')
  })

  it('drops a service tag left unfinished when the stream ends', () => {
    expect(pushAll(['Проверь карточку.', ' </anion'])).toBe('Проверь карточку.')
  })

  it('releases a held fragment that turned out to be normal text', () => {
    expect(pushAll(['Сравни a ', '< b — это меньше'])).toBe('Сравни a < b — это меньше')
    expect(pushAll(['Формат ', '<x'])).toBe('Формат <x')
  })
})
