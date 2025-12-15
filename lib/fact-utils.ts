export function safeParseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function splitLines(text: string | null | undefined): string[] {
  return (text || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function buildFactFromSelection(params: {
  planText: string | null | undefined
  factText: string | null | undefined
  selectedTasksJson: string | null | undefined
}): { factText: string; completedTasks: string[] } {
  const planTasks = splitLines(params.planText)

  const selectedRaw = safeParseJsonArray<string | number>(params.selectedTasksJson)
  const selectedIds = selectedRaw
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0 && id <= planTasks.length)

  if (selectedIds.length > 0 && planTasks.length > 0) {
    const completedTasks = selectedIds
      .map((id) => planTasks[id - 1])
      .filter(Boolean)

    if (completedTasks.length > 0) {
      return { factText: completedTasks.join('\n'), completedTasks }
    }
  }

  const factLines = splitLines(params.factText)
  return { factText: factLines.join('\n'), completedTasks: factLines }
}
