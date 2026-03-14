const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

interface GoalsContext {
  dream: string
  dreamYears: number
  yearGoals: Record<string, string[]>
  periodGoals: Record<string, string[]>
  selectedYear: number
  selectedMonth: number
}

export function buildGoalsDecomposePrompt(context: GoalsContext): string {
  const { dream, dreamYears, yearGoals, periodGoals, selectedYear, selectedMonth } = context

  const yearGoalsSummary = Object.entries(yearGoals || {})
    .filter(([, goals]) => Array.isArray(goals) && goals.length > 0)
    .map(([year, goals]) => `  ${year}: ${goals.join('; ')}`)
    .join('\n')

  const periodGoalsSummary = Object.entries(periodGoals || {})
    .filter(([, goals]) => Array.isArray(goals) && goals.length > 0)
    .map(([period, goals]) => `  ${period}: ${goals.join('; ')}`)
    .join('\n')

  return `Ты — ИИ-помощник по стратегическому планированию целей. Твоя задача — помочь пользователю декомпозировать мечту на конкретные, измеримые шаги по временным горизонтам.

МЕЧТА ПОЛЬЗОВАТЕЛЯ: "${dream}"
ГОРИЗОНТ ПЛАНИРОВАНИЯ: ${dreamYears} лет
ТЕКУЩИЙ ФОКУС: ${MONTH_NAMES[selectedMonth]} ${selectedYear}

${yearGoalsSummary ? `СУЩЕСТВУЮЩИЕ ГОДОВЫЕ ЦЕЛИ:\n${yearGoalsSummary}` : 'Годовых целей пока нет.'}

${periodGoalsSummary ? `СУЩЕСТВУЮЩИЕ ЦЕЛИ ПО ПЕРИОДАМ:\n${periodGoalsSummary}` : 'Целей по периодам пока нет.'}

ПРАВИЛА:
1. Отвечай на русском языке, кратко и по делу
2. Предлагай конкретные, измеримые цели (SMART)
3. Учитывай иерархию: мечта → годы → кварталы → месяцы → недели
4. Если карта целей пустая — начни с предложения годовых целей, затем детализируй ближайший квартал и месяц
5. Если пользователь просит помощь с конкретным периодом — фокусируйся на нём
6. Предлагай 3-5 целей на каждый уровень
7. Цели должны быть реалистичными и логически вытекать из мечты
8. Не используй markdown-заголовки, используй простой текст с нумерацией и тире
9. Будь прагматичен — учитывай, что пользователь работает и живёт реальной жизнью
10. Если пользователь жалуется, что не успевает, или задаёт свободный вопрос — помоги переприоритизировать: предложи что перенести, что убрать, что делегировать. Опирайся на существующие цели
11. Если спрашивают совет — давай конкретный ответ, а не общие фразы. Используй контекст его целей и мечты`
}
