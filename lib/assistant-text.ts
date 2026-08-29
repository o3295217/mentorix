// Очистка текста ответа модели от служебных огрызков tool-синтаксиса.
//
// Живой случай: в сообщение чата планирования просочилось «</anionale> </invoke>» — хвосты
// служебной разметки вызова инструментов, которые модель иногда «допечатывает» в текстовый блок.
// Пользователю это видно как мусор в конце ответа.
//
// Режем ТОЛЬКО теги-слова: закрывающие теги с латинским именем (в обычной русской речи они не
// встречаются вовсе) и открывающие теги из списка служебных имён. Сравнения вроде «<15 мин»,
// «>2 часа», «a < b» не трогаем: за угловой скобкой там нет имени тега.

const SERVICE_TAG_WORDS = [
  'antml',
  'anionale',
  'invoke',
  'parameter',
  'function_calls',
  'function_results',
  'tool_use',
  'tool_result',
  'antthinking',
  'thinking',
] as const

// Любой закрывающий тег с латинским именем: </invoke>, </anionale>, </invoke>.
const CLOSING_TAG_PATTERN = /<\s*\/\s*[A-Za-z][A-Za-z0-9_:.-]*\s*>/g

// Открывающие теги — только служебные имена, с атрибутами или без:
// <invoke name="...">, <parameter name="x">, <anionale>, <thinking/>.
const SERVICE_OPENING_TAG_PATTERN = new RegExp(
  `<(?:${SERVICE_TAG_WORDS.join('|')})[A-Za-z0-9_:.-]*(?:\\s[^<>]*)?/?>`,
  'gi',
)

// Минимальная длина оборванного имени тега, которую считаем служебной. Одна-две буквы после
// «<» — слишком слабый признак, чтобы резать хвост живого текста.
const MIN_PARTIAL_TAG_NAME_LENGTH = 3

// «invoke» → «inv(?:o(?:k(?:e)?)?)?» — любой префикс слова от MIN_PARTIAL_TAG_NAME_LENGTH букв.
function buildWordPrefixPattern(word: string): string {
  const optionalTail = word
    .slice(MIN_PARTIAL_TAG_NAME_LENGTH)
    .split('')
    .reduceRight((tail, char) => `(?:${char}${tail})?`, '')
  return `${word.slice(0, MIN_PARTIAL_TAG_NAME_LENGTH)}${optionalTail}`
}

// Оборванный хвост служебного тега в конце текста: стрим закончился на «</invo» или «<par».
const TRAILING_PARTIAL_TAG_PATTERN = new RegExp(
  `(?:</[A-Za-z][A-Za-z0-9_:.-]*|<(?:${SERVICE_TAG_WORDS.map(word => buildWordPrefixPattern(word)).join('|')})[A-Za-z0-9_:.-]*(?:\\s[^<>]*)?)$`,
  'i',
)

function removeServiceTags(text: string): string {
  return text.replace(CLOSING_TAG_PATTERN, '').replace(SERVICE_OPENING_TAG_PATTERN, '')
}

// Прибираем пробелы, оставшиеся на месте вырезанных тегов. Вызывается только когда что-то
// действительно вырезано, поэтому валидный текст возвращается байт в байт.
function tidyWhitespace(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Очищает готовый текст ответа. Текст без служебных тегов возвращается без изменений. */
export function sanitizeAssistantText(text: string): string {
  const cleaned = removeServiceTags(text).replace(TRAILING_PARTIAL_TAG_PATTERN, '')
  return cleaned === text ? text : tidyWhitespace(cleaned)
}

/**
 * Незакрытый хвост, который может оказаться началом служебного тега: «</invo», «<para».
 * Такой хвост придерживаем в стриме, пока не придёт следующая порция.
 */
function findHeldTagStart(text: string): number {
  const openIndex = text.lastIndexOf('<')
  if (openIndex === -1) return -1
  const tail = text.slice(openIndex)
  if (tail.includes('>')) return -1
  if (!/^<\/?[A-Za-z]/.test(tail)) return -1
  // Пробелы перед подозрительным хвостом придерживаем вместе с ним: иначе от выброшенного
  // «</anion» в конце ответа останется висячий пробел. Окажется обычным текстом — вернём вместе.
  let holdStart = openIndex
  while (holdStart > 0 && (text[holdStart - 1] === ' ' || text[holdStart - 1] === '\t')) holdStart--
  return holdStart
}

export type AssistantTextSanitizer = {
  /** Очищает очередную порцию стрима и возвращает то, что уже безопасно показать. */
  push(chunk: string): string
  /** Отдаёт придержанный хвост в конце стрима; оборванный служебный тег отбрасывается. */
  flush(): string
}

/**
 * Потоковый вариант: тег может быть разорван между дельтами стрима, поэтому подозрительный
 * хвост придерживается до следующей порции, а на закрытии стрима либо отдаётся, либо
 * отбрасывается, если это оборванный служебный тег.
 */
export function createAssistantTextSanitizer(): AssistantTextSanitizer {
  let pending = ''

  return {
    push(chunk: string): string {
      if (!chunk) return ''
      const combined = pending + chunk
      const cleaned = removeServiceTags(combined)
      const holdIndex = findHeldTagStart(cleaned)
      const emitted = holdIndex === -1 ? cleaned : cleaned.slice(0, holdIndex)
      pending = holdIndex === -1 ? '' : cleaned.slice(holdIndex)
      // Пробелы прибираем только там, где действительно что-то вырезали: иначе порция
      // валидного текста изменилась бы на ровном месте.
      return cleaned === combined ? emitted : emitted.replace(/[ \t]{2,}/g, ' ')
    },
    flush(): string {
      const tail = pending
      pending = ''
      if (!tail) return ''
      return TRAILING_PARTIAL_TAG_PATTERN.test(tail) ? '' : tail
    },
  }
}
