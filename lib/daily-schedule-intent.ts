const CHANGE_VERBS = ['исправь', 'измени', 'передвинь', 'переставь', 'сдвинь', 'обнови', 'разложи', 'распиши']
const SCHEDULE_TERMS = ['расписан', 'график', 'календар', 'таймлайн', 'шкал', 'блок', 'карточк', 'слот', 'задач', 'план']
const TIME_TERMS = ['врем', 'час', 'минут', 'утр', 'дн', 'вечер', 'ноч', 'после', 'до ', 'на ', 'с ', 'к ', ':', '00', '15', '30', '45']

function normalizeIntentText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

function isQuestion(text: string): boolean {
  return text.includes('?') || /^(почему|зачем|как|что|когда|где|сколько|можешь ли|можно ли)\b/.test(text)
}

export function isStrictScheduleChangeRequest(input: string): boolean {
  const text = normalizeIntentText(input)
  if (!text || isQuestion(text)) return false
  const hasVerb = CHANGE_VERBS.some(verb => text.includes(verb))
  if (!hasVerb) return false
  const hasScheduleSemantics = SCHEDULE_TERMS.some(term => text.includes(term))
  const hasTimeSemantics = TIME_TERMS.some(term => text.includes(term)) || /\b\d{1,2}([:.]\d{2})?\b/.test(text)
  return hasScheduleSemantics && hasTimeSemantics
}

export function isStrictScheduleConfirmation(input: string): boolean {
  const text = normalizeIntentText(input).replace(/[.!]+$/g, '').trim()
  if (!text || isQuestion(text)) return false
  if (/\b(не надо|не нужно|нет|отмена|отмени|погоди|стой)\b/.test(text)) return false
  if (/\b(но|только|если|объясни|расскажи|почему|зачем|как)\b/.test(text)) return false
  if (text.length > 40) return false
  return /^(да|давай|ок|окей|ага|угу|размести|замени|применяй|примени|подтверждаю|подтверждаю замену|согласен|согласна)$/.test(text)
}
