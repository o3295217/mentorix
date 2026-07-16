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

for (const line of readFileSync(journalPath, 'utf8').split(/\r?\n/)) {
  if (!line.trim()) continue
  let record
  try {
    record = JSON.parse(line)
  } catch {
    continue
  }

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
  }

  if (record.event === 'started') {
    group.started += 1
    if (record.isResume) group.resumeAttempts += 1
  } else if (record.event === 'finished') {
    group.finished += 1
    if (record.state === 'completed') group.completed += 1
    if (record.state === 'error') group.errors += 1
    if (typeof record.durationMs === 'number') group.durations.push(record.durationMs)
  }

  groups.set(key, group)
}

if (groups.size === 0) {
  console.log(`OpenCode agent journal has no readable records: ${journalPath}`)
  process.exit(0)
}

console.log(`OpenCode agent stats: ${journalPath}`)
console.log('agent\tmodel\tscenario\tstarted\tfinished\tcompleted\terrors\tunfinished\tresumeAttempts\tcompletionRate\tavgDurationMs')

for (const group of [...groups.values()].sort(compareGroups)) {
  const unfinished = Math.max(0, group.started - group.finished)
  const completionRate = group.finished > 0 ? `${((group.completed / group.finished) * 100).toFixed(1)}%` : '0.0%'
  const avgDurationMs = group.durations.length > 0
    ? Math.round(group.durations.reduce((sum, value) => sum + value, 0) / group.durations.length)
    : 0

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
    avgDurationMs,
  ].join('\t'))
}

function safeValue(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function compareGroups(left, right) {
  return `${left.agent}\t${left.model}\t${left.scenario}`.localeCompare(`${right.agent}\t${right.model}\t${right.scenario}`)
}
