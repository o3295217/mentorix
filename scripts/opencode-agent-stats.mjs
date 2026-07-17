#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const journalPath = resolve(process.argv[2] ?? '.opencode/metrics/agent-runs.jsonl')

if (!existsSync(journalPath)) {
  console.log(`OpenCode agent journal not found: ${journalPath}`)
  console.log('No statistics to show yet.')
  process.exit(0)
}

const groups = new Map()
const records = []

for (const line of readFileSync(journalPath, 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue
  let record
  try {
    record = JSON.parse(line)
  } catch {
    continue
  }

  records.push(record)
}

for (const record of dedupeLifecycleRecords(records)) {
  const agent = safeValue(record.agent, 'unknown')
  const model = safeValue(record.resolvedModel, 'unknown')
  const scenario = safeValue(record.scenario, 'custom')
  const key = `${agent}\t${model}\t${scenario}`
  const group = groups.get(key) ?? {
    agent,
    model,
    scenario,
    started: 0,
    finished: 0,
    completed: 0,
    errors: 0,
    resumeAttempts: 0,
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

  if (record.event === 'started') {
    group.started += 1
    if (record.isResume) group.resumeAttempts += 1
  } else if (record.event === 'finished') {
    group.finished += 1
    if (record.state === 'completed') group.completed += 1
    if (record.state === 'error') group.errors += 1
    if (typeof record.durationMs === 'number') group.durations.push(record.durationMs)
    if (record.usageAvailable === true) {
      group.usageFinished += 1
      if (typeof record.cost === 'number') group.costs.push(record.cost)
      if (typeof record.totalTokens === 'number') group.totalTokens.push(record.totalTokens)
      group.inputTokens += safeNumber(record.inputTokens)
      group.outputTokens += safeNumber(record.outputTokens)
      group.reasoningTokens += safeNumber(record.reasoningTokens)
      group.cacheReadTokens += safeNumber(record.cacheReadTokens)
      group.cacheWriteTokens += safeNumber(record.cacheWriteTokens)
    }
  }

  groups.set(key, group)
}

if (groups.size === 0) {
  console.log(`OpenCode agent journal has no readable records: ${journalPath}`)
  process.exit(0)
}

console.log(`OpenCode agent stats: ${journalPath}`)
console.log('agent\tmodel\tscenario\tstarted\tfinished\tcompleted\terrors\tunfinished\tresumeAttempts\tcompletionRate\terrorRate\tavgDurationMs\tusageCoverage\ttotalCost\tavgCost\ttotalTokens\tavgTokens\tinputTokens\toutputTokens\treasoningTokens\tcacheReadTokens\tcacheWriteTokens')

for (const group of [...groups.values()].sort(compareGroups)) {
  const unfinished = Math.max(0, group.started - group.finished)
  const completionRate = group.finished > 0 ? `${((group.completed / group.finished) * 100).toFixed(1)}%` : '0.0%'
  const errorRate = group.finished > 0 ? `${((group.errors / group.finished) * 100).toFixed(1)}%` : '0.0%'
  const usageCoverage = group.finished > 0 ? `${((group.usageFinished / group.finished) * 100).toFixed(1)}%` : '0.0%'
  const avgDurationMs = group.durations.length > 0
    ? Math.round(group.durations.reduce((sum, value) => sum + value, 0) / group.durations.length)
    : 0
  const totalCost = roundMetric(group.costs.reduce((sum, value) => sum + value, 0))
  const avgCost = group.costs.length > 0 ? roundMetric(totalCost / group.costs.length) : '0'
  const totalTokens = group.totalTokens.reduce((sum, value) => sum + value, 0)
  const avgTokens = group.totalTokens.length > 0 ? Math.round(totalTokens / group.totalTokens.length) : 0

  console.log([
    group.agent,
    group.model,
    group.scenario,
    group.started,
    group.finished,
    group.completed,
    group.errors,
    unfinished,
    group.resumeAttempts,
    completionRate,
    errorRate,
    avgDurationMs,
    usageCoverage,
    totalCost,
    avgCost,
    totalTokens,
    avgTokens,
    group.inputTokens,
    group.outputTokens,
    group.reasoningTokens,
    group.cacheReadTokens,
    group.cacheWriteTokens,
  ].join('\t'))
}

function safeValue(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function roundMetric(value) {
  return Number(value.toFixed(6)).toString()
}

function dedupeLifecycleRecords(records) {
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

function getLifecycleIdentity(record) {
  if (record.event !== 'started' && record.event !== 'finished') return null
  if (!isReliableCallId(record.callId)) return null

  return [safeIdentityValue(record.parentSessionId), record.callId.trim(), record.event].join('\t')
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

  if (left.event === 'started') {
    merged.isResume = Boolean(left.isResume || right.isResume)
  }

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
  return safeNumber(leftTime) - safeNumber(rightTime)
}

function recordCompletenessScore(record) {
  return [
    record.usageAvailable === true ? 1 : 0,
    safeNumber(record.usageMessageCount),
    safeNumber(record.totalTokens),
    safeNumber(record.inputTokens),
    safeNumber(record.outputTokens),
    safeNumber(record.reasoningTokens),
    safeNumber(record.cacheReadTokens),
    safeNumber(record.cacheWriteTokens),
    typeof record.cost === 'number' ? 1 : 0,
    typeof record.durationMs === 'number' ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)
}

function maxNumberOrPreferred(left, right, preferred) {
  const values = [left, right].filter((value) => typeof value === 'number' && Number.isFinite(value))
  if (values.length === 0) return preferred ?? null
  return Math.max(...values)
}

function compareGroups(left, right) {
  return `${left.agent}\t${left.model}\t${left.scenario}`.localeCompare(`${right.agent}\t${right.model}\t${right.scenario}`)
}
