export const AUDIT_THRESHOLDS = Object.freeze({
  insufficientEvidenceFinished: 20,
  softWarningFinished: 20,
  promptOrModelFinished: 50,
  disableFinished: 100,
  investigateErrorRate: 0.2,
  investigateResumeRate: 0.3,
  providerErrorRate: 0.1,
  providerDominanceRate: 0.6,
  reviewPromptResumeRate: 0.4,
  modelChangeQualityErrorRate: 0.25,
  disableQualityErrorRate: 0.5,
  disableResumeRate: 0.6,
  shortErrorDurationMs: 30_000,
})

export function parseJsonlRecords(source) {
  const records = []
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      if (record && typeof record === 'object') records.push(record)
    } catch {
      // Broken historical rows are ignored; the journal is append-only evidence.
    }
  }
  return records
}

export function analyzeAgentRuns(records, options = {}) {
  const thresholds = { ...AUDIT_THRESHOLDS, ...(options.thresholds ?? {}) }
  const dedupedRecords = dedupeLifecycleRecords(records)
  const groups = new Map()

  dedupedRecords.forEach((record, index) => {
    if (record.event !== 'started' && record.event !== 'finished') return

    const agent = safeValue(record.agent, 'unknown')
    const resolvedModel = safeValue(record.resolvedModel, 'unknown')
    const scenario = safeValue(record.scenario, 'custom')
    const key = `${agent}\t${resolvedModel}\t${scenario}`
    const group = groups.get(key) ?? createGroup(agent, resolvedModel, scenario)

    if (record.isResume === true) {
      group.resumeKeys.add(getRunIdentity(record) ?? `row-${index}`)
    }

    if (record.event === 'started') {
      group.started += 1
    }

    if (record.event === 'finished') {
      group.finished += 1
      const state = safeValue(record.state, 'unknown')
      if (state === 'completed') group.completed += 1
      else if (state === 'error') group.errors += 1
      else group.unknown += 1

      if (state === 'error' && isSuspectedProviderSystemFailure(record, thresholds)) {
        group.suspectedProviderSystemErrors += 1
      }

      const durationMs = safeNumber(record.durationMs)
      if (durationMs !== null) group.durations.push(durationMs)

      if (record.usageAvailable === true) {
        group.usageFinished += 1
        const cost = safeNumber(record.cost)
        const totalTokens = safeNumber(record.totalTokens)
        if (cost !== null) group.costs.push(cost)
        if (totalTokens !== null) group.totalTokens.push(totalTokens)
        group.inputTokens += safeNumber(record.inputTokens) ?? 0
        group.outputTokens += safeNumber(record.outputTokens) ?? 0
        group.reasoningTokens += safeNumber(record.reasoningTokens) ?? 0
        group.cacheReadTokens += safeNumber(record.cacheReadTokens) ?? 0
        group.cacheWriteTokens += safeNumber(record.cacheWriteTokens) ?? 0
      }
    }

    groups.set(key, group)
  })

  const summaries = [...groups.values()].map((group) => finalizeGroup(group, thresholds))
  summaries.sort(compareSummaries)

  return {
    totalRecords: records.length,
    dedupedRecords: dedupedRecords.length,
    duplicateRows: Math.max(0, records.length - dedupedRecords.length),
    thresholds,
    groups: summaries,
  }
}

export function buildAuditReport(source, options = {}) {
  const analysis = analyzeAgentRuns(parseJsonlRecords(source), options)
  const lines = []

  lines.push('OpenCode agent audit')
  lines.push(`records: raw=${analysis.totalRecords}, after_dedupe=${analysis.dedupedRecords}, duplicate_lifecycle_rows=${analysis.duplicateRows}`)
  lines.push('Safety: read-only report; no prompts/results/user content are printed; no configs or journals are modified.')
  lines.push('Important: isResume is a resume/rework proxy only, not proof of quality REWORK. Current schema cannot prove lead override/escalation or first-pass acceptance.')
  lines.push(`Thresholds: <${analysis.thresholds.insufficientEvidenceFinished} finished => INSUFFICIENT_EVIDENCE; >=${analysis.thresholds.softWarningFinished} => soft investigate warnings; >=${analysis.thresholds.promptOrModelFinished} => REVIEW_PROMPT/CONSIDER_MODEL_CHANGE allowed; >=${analysis.thresholds.disableFinished} => CONSIDER_DISABLE may be suggested, never automatic.`)
  lines.push('')

  if (analysis.groups.length === 0) {
    lines.push('No readable started/finished task records found.')
    return lines.join('\n')
  }

  for (const group of analysis.groups) {
    lines.push(`${group.agent} | ${group.resolvedModel} | ${group.scenario}`)
    lines.push(`  recommendation: ${group.recommendation} — ${group.recommendationReason}`)
    if (group.softWarnings.length > 0) lines.push(`  soft_warnings: ${group.softWarnings.join('; ')}`)
    lines.push(`  sampleSize(finished): ${group.finished}; started: ${group.started}; completed: ${group.completed}; errors: ${group.errors}; unfinished: ${group.unfinished}; unknown: ${group.unknown}`)
    lines.push(`  rates: error=${formatPercent(group.errorRate)}; resumeProxy=${group.resumeAttempts}/${group.resumeDenominator} (${formatPercent(group.resumeRate)}); usageCoverage=${formatPercent(group.usageCoverage)}`)
    lines.push(`  provider/system suspicion: suspected=${group.suspectedProviderSystemErrors}; suspectedQualityErrors=${group.suspectedQualityErrors}; heuristic=v2 error with explicit no-usage/zero-token signal and duration<=${analysis.thresholds.shortErrorDurationMs}ms`)
    lines.push(`  duration: avgMs=${formatNumber(group.avgDurationMs)}; p50Ms=${formatNumber(group.p50DurationMs)}; p95Ms=${formatNumber(group.p95DurationMs)}`)
    lines.push(`  economy: totalCost=${formatCost(group.totalCost)}; avgCost=${formatCost(group.avgCost)}; totalTokens=${group.totalTokens}; avgTokens=${group.avgTokens}; input=${group.inputTokens}; output=${group.outputTokens}; reasoning=${group.reasoningTokens}; cacheRead=${group.cacheReadTokens}; cacheWrite=${group.cacheWriteTokens}`)
    lines.push(`  evidence: ${group.evidence.join('; ')}`)
    lines.push('  action: no automatic prompt/model/disable changes; user approval required before any staffing/config change.')
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export function dedupeLifecycleRecords(records) {
  const deduped = []
  const indexByIdentity = new Map()

  for (const record of records) {
    const identity = getLifecycleIdentity(record)
    if (!identity) {
      deduped.push(record)
      continue
    }

    const existingIndex = indexByIdentity.get(identity)
    if (existingIndex === undefined) {
      indexByIdentity.set(identity, deduped.length)
      deduped.push(record)
      continue
    }

    deduped[existingIndex] = mergeLifecycleRecords(deduped[existingIndex], record)
  }

  return deduped
}

function createGroup(agent, resolvedModel, scenario) {
  return {
    agent,
    resolvedModel,
    scenario,
    started: 0,
    finished: 0,
    completed: 0,
    errors: 0,
    unknown: 0,
    suspectedProviderSystemErrors: 0,
    resumeKeys: new Set(),
    durations: [],
    usageFinished: 0,
    costs: [],
    totalTokens: [],
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

function finalizeGroup(group, thresholds) {
  const finished = group.finished
  const started = group.started
  const unfinished = Math.max(0, started - finished)
  const resumeAttempts = group.resumeKeys.size
  const resumeDenominator = Math.max(started, resumeAttempts)
  const suspectedQualityErrors = Math.max(0, group.errors - group.suspectedProviderSystemErrors)
  const summary = {
    agent: group.agent,
    resolvedModel: group.resolvedModel,
    scenario: group.scenario,
    started,
    finished,
    completed: group.completed,
    errors: group.errors,
    unfinished,
    unknown: group.unknown,
    resumeAttempts,
    resumeDenominator,
    errorRate: rate(group.errors, finished),
    resumeRate: rate(resumeAttempts, resumeDenominator),
    usageCoverage: rate(group.usageFinished, finished),
    suspectedProviderSystemErrors: group.suspectedProviderSystemErrors,
    suspectedQualityErrors,
    avgDurationMs: average(group.durations),
    p50DurationMs: percentile(group.durations, 0.5),
    p95DurationMs: percentile(group.durations, 0.95),
    totalCost: roundMetric(sum(group.costs)),
    avgCost: group.costs.length > 0 ? roundMetric(sum(group.costs) / group.costs.length) : null,
    totalTokens: sum(group.totalTokens),
    avgTokens: group.totalTokens.length > 0 ? Math.round(sum(group.totalTokens) / group.totalTokens.length) : 0,
    inputTokens: group.inputTokens,
    outputTokens: group.outputTokens,
    reasoningTokens: group.reasoningTokens,
    cacheReadTokens: group.cacheReadTokens,
    cacheWriteTokens: group.cacheWriteTokens,
    recommendation: 'KEEP',
    recommendationReason: 'metrics are below deterministic action thresholds',
    softWarnings: [],
    evidence: [],
  }

  Object.assign(summary, classifySummary(summary, thresholds))
  return summary
}

function classifySummary(summary, thresholds) {
  const evidence = [
    `finished=${summary.finished}`,
    `errorRate=${formatPercent(summary.errorRate)}`,
    `resumeProxyRate=${formatPercent(summary.resumeRate)}`,
    `suspectedProviderSystemErrors=${summary.suspectedProviderSystemErrors}`,
  ]
  const softWarnings = []
  const providerDominance = summary.errors > 0 ? summary.suspectedProviderSystemErrors / summary.errors : 0

  if (summary.finished < thresholds.insufficientEvidenceFinished) {
    return {
      recommendation: 'INSUFFICIENT_EVIDENCE',
      recommendationReason: `finished sample < ${thresholds.insufficientEvidenceFinished}; no prompt/model/disable recommendation`,
      softWarnings,
      evidence,
    }
  }

  if (
    summary.suspectedProviderSystemErrors >= 3
    && summary.errorRate >= thresholds.providerErrorRate
    && providerDominance >= thresholds.providerDominanceRate
  ) {
    return {
      recommendation: 'INVESTIGATE_PROVIDER',
      recommendationReason: 'most errors match provider/system heuristic; inspect availability/quota/network before judging quality',
      softWarnings,
      evidence: [...evidence, `providerDominance=${formatPercent(providerDominance)}`],
    }
  }

  if (summary.finished < thresholds.promptOrModelFinished) {
    if (summary.errorRate >= thresholds.investigateErrorRate) softWarnings.push('error rate reached soft investigate threshold; collect more runs before staffing recommendation')
    if (summary.resumeRate >= thresholds.investigateResumeRate) softWarnings.push('isResume proxy reached soft investigate threshold; verify actual REWORK manually')
    return {
      recommendation: 'KEEP',
      recommendationReason: `finished sample < ${thresholds.promptOrModelFinished}; only soft investigation is allowed`,
      softWarnings,
      evidence,
    }
  }

  if (
    summary.finished >= thresholds.disableFinished
    && providerDominance < thresholds.providerDominanceRate
    && (
      (summary.suspectedQualityErrors >= 50 && rate(summary.suspectedQualityErrors, summary.finished) >= thresholds.disableQualityErrorRate)
      || (summary.resumeAttempts >= 60 && summary.resumeRate >= thresholds.disableResumeRate)
    )
  ) {
    return {
      recommendation: 'CONSIDER_DISABLE',
      recommendationReason: `finished >= ${thresholds.disableFinished} with sustained severe non-provider signal; never automatic`,
      softWarnings,
      evidence,
    }
  }

  if (rate(summary.suspectedQualityErrors, summary.finished) >= thresholds.modelChangeQualityErrorRate) {
    return {
      recommendation: 'CONSIDER_MODEL_CHANGE',
      recommendationReason: `non-provider error rate >= ${formatPercent(thresholds.modelChangeQualityErrorRate)} at finished >= ${thresholds.promptOrModelFinished}`,
      softWarnings,
      evidence,
    }
  }

  if (summary.resumeRate >= thresholds.reviewPromptResumeRate) {
    return {
      recommendation: 'REVIEW_PROMPT',
      recommendationReason: `isResume proxy rate >= ${formatPercent(thresholds.reviewPromptResumeRate)} at finished >= ${thresholds.promptOrModelFinished}; verify actual REWORK manually`,
      softWarnings,
      evidence,
    }
  }

  if (summary.errorRate >= thresholds.investigateErrorRate) softWarnings.push('error rate reached soft investigate threshold but not prompt/model-change threshold')
  if (summary.resumeRate >= thresholds.investigateResumeRate) softWarnings.push('isResume proxy reached soft investigate threshold but not prompt-review threshold')

  return {
    recommendation: 'KEEP',
    recommendationReason: 'no deterministic prompt/model/disable gate reached',
    softWarnings,
    evidence,
  }
}

function isSuspectedProviderSystemFailure(record, thresholds) {
  if (safeValue(record.state, 'unknown') !== 'error') return false
  if (record.schemaVersion !== 2) return false
  const durationMs = safeNumber(record.durationMs)
  if (durationMs === null || durationMs > thresholds.shortErrorDurationMs) return false
  const totalTokens = safeNumber(record.totalTokens)
  const inputTokens = safeNumber(record.inputTokens)
  const outputTokens = safeNumber(record.outputTokens)
  const explicitNoUsage = record.usageAvailable === false
  const explicitZeroTokens = totalTokens === 0 || (inputTokens === 0 && outputTokens === 0)

  return explicitNoUsage || explicitZeroTokens
}

function getLifecycleIdentity(record) {
  if (record.event !== 'started' && record.event !== 'finished') return null
  if (!isReliableCallId(record.callId)) return null
  return [safeIdentityValue(record.parentSessionId), record.callId.trim(), record.event].join('\t')
}

function getRunIdentity(record) {
  if (!isReliableCallId(record.callId)) return null
  return [safeIdentityValue(record.parentSessionId), record.callId.trim()].join('\t')
}

function isReliableCallId(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  return !/^\d{10,}-\d+$/.test(value.trim())
}

function safeIdentityValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '<missing-parent-session>'
}

function mergeLifecycleRecords(left, right) {
  const preferred = compareRecordCompleteness(right, left) > 0 ? right : left
  const merged = { ...preferred }

  merged.isResume = Boolean(left.isResume || right.isResume)

  if (left.event === 'finished') {
    merged.usageAvailable = Boolean(left.usageAvailable || right.usageAvailable)
    merged.usageMessageCount = maxNumberOrPreferred(left.usageMessageCount, right.usageMessageCount, preferred.usageMessageCount)
    merged.durationMs = maxNumberOrPreferred(left.durationMs, right.durationMs, preferred.durationMs)
    merged.cost = maxNumberOrPreferred(left.cost, right.cost, preferred.cost)
    merged.totalTokens = maxNumberOrPreferred(left.totalTokens, right.totalTokens, preferred.totalTokens)
    merged.inputTokens = maxNumberOrPreferred(left.inputTokens, right.inputTokens, preferred.inputTokens)
    merged.outputTokens = maxNumberOrPreferred(left.outputTokens, right.outputTokens, preferred.outputTokens)
    merged.reasoningTokens = maxNumberOrPreferred(left.reasoningTokens, right.reasoningTokens, preferred.reasoningTokens)
    merged.cacheReadTokens = maxNumberOrPreferred(left.cacheReadTokens, right.cacheReadTokens, preferred.cacheReadTokens)
    merged.cacheWriteTokens = maxNumberOrPreferred(left.cacheWriteTokens, right.cacheWriteTokens, preferred.cacheWriteTokens)
  }

  return merged
}

function compareRecordCompleteness(left, right) {
  const leftScore = recordCompletenessScore(left)
  const rightScore = recordCompletenessScore(right)
  if (leftScore !== rightScore) return leftScore - rightScore

  const leftTime = Date.parse(left.timestamp ?? '')
  const rightTime = Date.parse(right.timestamp ?? '')
  return (safeNumber(leftTime) ?? 0) - (safeNumber(rightTime) ?? 0)
}

function recordCompletenessScore(record) {
  return [
    record.usageAvailable === true ? 1 : 0,
    safeNumber(record.usageMessageCount) ?? 0,
    safeNumber(record.totalTokens) ?? 0,
    safeNumber(record.inputTokens) ?? 0,
    safeNumber(record.outputTokens) ?? 0,
    safeNumber(record.reasoningTokens) ?? 0,
    safeNumber(record.cacheReadTokens) ?? 0,
    safeNumber(record.cacheWriteTokens) ?? 0,
    typeof record.cost === 'number' ? 1 : 0,
    typeof record.durationMs === 'number' ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)
}

function maxNumberOrPreferred(left, right, preferred) {
  const values = [left, right].filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return preferred ?? null
  return Math.max(...values)
}

function compareSummaries(left, right) {
  const risk = recommendationRank(right.recommendation) - recommendationRank(left.recommendation)
  if (risk !== 0) return risk
  const errorDelta = right.errorRate - left.errorRate
  if (errorDelta !== 0) return errorDelta
  return `${left.agent}\t${left.resolvedModel}\t${left.scenario}`.localeCompare(`${right.agent}\t${right.resolvedModel}\t${right.scenario}`)
}

function recommendationRank(value) {
  return {
    CONSIDER_DISABLE: 6,
    CONSIDER_MODEL_CHANGE: 5,
    REVIEW_PROMPT: 4,
    INVESTIGATE_PROVIDER: 3,
    KEEP: 2,
    INSUFFICIENT_EVIDENCE: 1,
  }[value] ?? 0
}

function safeValue(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

function average(values) {
  return values.length > 0 ? Math.round(sum(values) / values.length) : null
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))
  return sorted[index]
}

function roundMetric(value) {
  return Number(value.toFixed(6))
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value) {
  return value === null ? 'n/a' : String(value)
}

function formatCost(value) {
  return value === null ? 'n/a' : String(value)
}
