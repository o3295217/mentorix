const STOP_WORDS = new Set([
  'и', 'в', 'во', 'на', 'по', 'к', 'ко', 'с', 'со', 'из', 'у', 'для', 'от', 'до', 'без', 'над', 'под', 'при', 'про', 'это',
  'а', 'но', 'или', 'ли', 'же', 'то', 'не', 'нет',
  'за', 'через', 'как', 'что', 'чтобы',
])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(text: string): string[] {
  const norm = normalize(text)
  if (!norm) return []
  return norm
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOP_WORDS.has(t))
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const x of setA) {
    if (setB.has(x)) inter += 1
  }
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

// Heuristic similarity for task texts.
// Goal: catch obvious duplicates without heavy NLP.
export function areTasksSimilar(aText: string, bText: string): boolean {
  const aNorm = normalize(aText)
  const bNorm = normalize(bText)
  if (!aNorm || !bNorm) return false

  if (aNorm === bNorm) return true

  // Containment check helps with minor postfixes like time windows.
  const longer = aNorm.length >= bNorm.length ? aNorm : bNorm
  const shorter = aNorm.length >= bNorm.length ? bNorm : aNorm
  if (shorter.length >= 12 && longer.includes(shorter)) return true

  const aTokens = tokens(aText)
  const bTokens = tokens(bText)
  const sim = jaccard(aTokens, bTokens)

  // Fairly strict: we only want high-confidence duplicates.
  return sim >= 0.6
}
