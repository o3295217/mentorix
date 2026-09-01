import { describe, expect, it } from 'vitest'
import { oldRuleWeekStart, remapWeekKey } from '@/lib/week-key-migration'

// Пересчёт недельных ключей: старое правило понедельника → ISO 8601 (правило четверга)
describe('remapWeekKey', () => {
  it('сдвигает номер в месяце, начинающемся вт–чт: 2026-09-W1 (с 07.09) → 2026-09-W2', () => {
    // Первый понедельник сентября 2026 — 7-е, его четверг 10.09 — второй четверг месяца
    expect(oldRuleWeekStart(2026, 8, 1).getDate()).toBe(7)
    expect(remapWeekKey('2026-09-W1')).toBe('2026-09-W2')
  })

  it('не меняет ключ в месяце, начинающемся пт–пн: 2026-08-W4 (с 24.08) → 2026-08-W4', () => {
    expect(oldRuleWeekStart(2026, 7, 4).getDate()).toBe(24)
    expect(remapWeekKey('2026-08-W4')).toBe('2026-08-W4')
  })

  it('переносит легаси-ключ пятой недели в следующий месяц: 2026-08-W5 (с 31.08) → 2026-09-W1', () => {
    // Четверг недели 31.08–06.09 — это 03.09, неделя принадлежит сентябрю
    expect(oldRuleWeekStart(2026, 7, 5).getDate()).toBe(31)
    expect(remapWeekKey('2026-08-W5')).toBe('2026-09-W1')
  })

  it('не трогает ключи других периодов', () => {
    expect(remapWeekKey('2026-08')).toBeNull()
    expect(remapWeekKey('2026-Q3')).toBeNull()
    expect(remapWeekKey('2026-H1')).toBeNull()
    expect(remapWeekKey('2026')).toBeNull()
  })
})
