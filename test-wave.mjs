// Quick test for rolling wave parsing changes

const text = `Вот план на 18 месяцев:

[WEEK:2026-03-W4]
1. Определить MVP продукта
2. Собрать требования

[MONTH:2026-04]
1. Запустить прототип
2. Провести тестирование

[QUARTER:2026-Q3]
1. Масштабирование

[HALF_YEAR:2027-H1]
1. Выход на рынок
2. Нанять команду

[YEAR:2028]
1. Выйти на прибыль
`

const lines = text.split('\n')
const goals = []
let currentPeriodType = 'month'
let currentPeriodKey = '2026-03'

for (const line of lines) {
  const trimmed = line.trim()

  const yearMatch = trimmed.match(/\[YEAR:(\d{4})\]/)
  const halfYearMatch = trimmed.match(/\[HALF_YEAR:(\d{4}-H[12])\]/)
  const quarterMatch = trimmed.match(/\[QUARTER:(\d{4}-Q[1-4])\]/)
  const monthMatch = trimmed.match(/\[MONTH:(\d{4}-\d{2})\]/)
  const weekMatch = trimmed.match(/\[WEEK:(\d{4}-\d{2}-W\d+)\]/)

  if (yearMatch) { currentPeriodType = 'year'; currentPeriodKey = yearMatch[1]; continue }
  if (halfYearMatch) { currentPeriodType = 'half_year'; currentPeriodKey = halfYearMatch[1]; continue }
  if (quarterMatch) { currentPeriodType = 'quarter'; currentPeriodKey = quarterMatch[1]; continue }
  if (monthMatch) { currentPeriodType = 'month'; currentPeriodKey = monthMatch[1]; continue }
  if (weekMatch) { currentPeriodType = 'week'; currentPeriodKey = weekMatch[1]; continue }

  const match = trimmed.match(/^(?:\d+[.)]\s*|[-–—•]\s+)(.+)/)
  if (match && match[1].length > 3 && match[1].length < 200) {
    goals.push({ text: match[1].trim(), periodType: currentPeriodType, periodKey: currentPeriodKey })
  }
}

console.log('=== Test 1: extractGoals parsing ===')
goals.forEach(g => console.log(`  [${g.periodType}:${g.periodKey}] ${g.text}`))

const types = goals.map(g => g.periodType)
let allPass = true

function check(label, condition) {
  const status = condition ? '✅' : '❌'
  if (!condition) allPass = false
  console.log(`${status} ${label}`)
}

console.log('\n=== Validation ===')
check('Has week goals', types.includes('week'))
check('Has month goals', types.includes('month'))
check('Has quarter goals', types.includes('quarter'))
check('Has half_year goals', types.includes('half_year'))
check('Has year goals', types.includes('year'))
check('Total goals = 8', goals.length === 8)

// Test 2: half_year key parsing (as in handleAcceptGoals)
console.log('\n=== Test 2: half_year key parsing ===')
for (const key of ['2027-H1', '2027-H2']) {
  const m = key.match(/^(\d{4})-H([12])$/)
  if (m) {
    const year = parseInt(m[1], 10)
    const half = parseInt(m[2], 10)
    const halfDate = new Date(year, (half - 1) * 6, 1)
    const expectedMonth = (half - 1) * 6
    check(`${key} -> year=${year}, half=${half}, month=${halfDate.getMonth()}`, halfDate.getMonth() === expectedMonth)
  } else {
    check(`${key} parsing`, false)
  }
}

// Test 3: formatBlockLabel for half_year
console.log('\n=== Test 3: formatBlockLabel ===')
function formatBlockLabel(periodType, periodKey) {
  if (periodType === 'year') return `${periodKey} год`
  if (periodType === 'half_year') {
    const m = periodKey.match(/^(\d{4})-H([12])$/)
    return m ? `H${m[2]} ${m[1]}` : periodKey
  }
  if (periodType === 'quarter') {
    const m = periodKey.match(/^(\d{4})-Q([1-4])$/)
    return m ? `Q${m[2]} ${m[1]}` : periodKey
  }
  return periodKey
}

check('half_year label: H1 2027', formatBlockLabel('half_year', '2027-H1') === 'H1 2027')
check('quarter label: Q3 2026', formatBlockLabel('quarter', '2026-Q3') === 'Q3 2026')
check('year label: 2028 год', formatBlockLabel('year', '2028') === '2028 год')

console.log('\n' + (allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'))
