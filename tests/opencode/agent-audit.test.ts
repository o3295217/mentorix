import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { analyzeAgentRuns, buildAuditReport, parseJsonlRecords } from '../../.opencode/lib/agent-audit-core.mjs'

const execFileAsync = promisify(execFile)

describe('opencode agent audit', () => {
  it('builds deterministic grouped report without task descriptions or user content', () => {
    const records = [
      started('call-1', { description: 'secret user content', agent: 'backend', model: 'm1', scenario: 'base' }),
      finished('call-1', { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', durationMs: 100, usageAvailable: true, totalTokens: 30, inputTokens: 10, outputTokens: 20, cost: 0.03 }),
      started('call-2', { agent: 'backend', model: 'm1', scenario: 'base', isResume: true }),
      finished('call-2', { agent: 'backend', model: 'm1', scenario: 'base', state: 'error', durationMs: 10, usageAvailable: false }),
    ]
    const source = `${records.map((record) => JSON.stringify(record)).join('\n')}\n{broken`
    const report = buildAuditReport(source, { journalPath: '/tmp/agent-runs.jsonl' })

    expect(report).toContain('OpenCode agent audit')
    expect(report).not.toContain('/tmp/agent-runs.jsonl')
    expect(report).not.toContain('/Users/')
    expect(report).toContain('backend | m1 | base')
    expect(report).toContain('sampleSize(finished): 2')
    expect(report).toContain('resumeProxy=1/2 (50.0%)')
    expect(report).toContain('provider/system suspicion: suspected=1')
    expect(report).toContain('totalCost=0.03')
    expect(report).toContain('totalTokens=30')
    expect(report).toContain('no automatic prompt/model/disable changes')
    expect(report).not.toContain('secret user content')
    expect(report).not.toContain('prompt text')
    expect(report).not.toContain('assistant output')
  })

  it('deduplicates lifecycle rows and reads schema v1/v2-compatible records', () => {
    const records = [
      { ...started('dup-call', { agent: 'backend', model: 'm1', scenario: 'base' }), schemaVersion: 1 },
      { ...started('dup-call', { agent: 'backend', model: 'm1', scenario: 'base' }), schemaVersion: 1 },
      { ...finished('dup-call', { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', durationMs: 100 }), schemaVersion: 1 },
      { ...finished('dup-call', { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', durationMs: 200, usageAvailable: true, totalTokens: 42, inputTokens: 10, outputTokens: 20, reasoningTokens: 3, cacheReadTokens: 4, cacheWriteTokens: 5, cost: 0.12 }), schemaVersion: 2 },
      finished('unique-finished', { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', durationMs: 300 }),
    ]

    const analysis = analyzeAgentRuns(records)
    expect(analysis.totalRecords).toBe(5)
    expect(analysis.duplicateRows).toBe(2)
    expect(analysis.groups).toHaveLength(1)
    expect(analysis.groups[0]).toMatchObject({
      started: 1,
      finished: 2,
      completed: 2,
      usageCoverage: 0.5,
      totalCost: 0.12,
      totalTokens: 42,
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 3,
      cacheReadTokens: 4,
      cacheWriteTokens: 5,
    })
  })

  it('suppresses staffing recommendations below 20 finished runs', () => {
    const records = manyFinished(19, { agent: 'junior', model: 'm2', scenario: 'custom', state: 'error', usageAvailable: true, durationMs: 120_000, totalTokens: 100 })

    const [group] = analyzeAgentRuns(records).groups
    expect(group.recommendation).toBe('INSUFFICIENT_EVIDENCE')
    expect(group.recommendationReason).toContain('no prompt/model/disable recommendation')
  })

  it('separates suspected provider instability from quality signals', () => {
    const providerRecords = manyFinished(30, { agent: 'explore', model: 'free-model', scenario: 'agent2.0_balanced', state: 'error', usageAvailable: false, durationMs: 5_000 })
    const qualityRecords = manyFinished(50, { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', usageAvailable: true, durationMs: 120_000, totalTokens: 100 }, 100)
    qualityRecords.push(...manyFinished(17, { agent: 'backend', model: 'm1', scenario: 'base', state: 'error', usageAvailable: true, durationMs: 120_000, totalTokens: 100 }, 200))

    const groups = analyzeAgentRuns([...providerRecords, ...qualityRecords]).groups
    const provider = groups.find((group) => group.agent === 'explore')
    const quality = groups.find((group) => group.agent === 'backend')

    expect(provider).toMatchObject({ recommendation: 'INVESTIGATE_PROVIDER', suspectedProviderSystemErrors: 30, suspectedQualityErrors: 0 })
    expect(quality).toMatchObject({ recommendation: 'CONSIDER_MODEL_CHANGE', suspectedProviderSystemErrors: 0, suspectedQualityErrors: 17 })
  })

  it('uses cautious provider heuristic across schema versions and usage/duration combinations', () => {
    const records = [
      finished('v1-short-no-usage', { agent: 'v1', state: 'error', schemaVersion: 1, usageAvailable: false, durationMs: 1_000 }),
      finished('v2-long-no-usage', { agent: 'long', state: 'error', usageAvailable: false, durationMs: 120_000 }),
      finished('v2-short-no-usage', { agent: 'short', state: 'error', usageAvailable: false, durationMs: 1_000 }),
      finished('v2-quality-usage', { agent: 'quality', state: 'error', usageAvailable: true, durationMs: 120_000, totalTokens: 100, inputTokens: 60, outputTokens: 40 }),
    ]

    const groups = analyzeAgentRuns(records).groups
    expect(groups.find((group) => group.agent === 'v1')).toMatchObject({ suspectedProviderSystemErrors: 0, suspectedQualityErrors: 1 })
    expect(groups.find((group) => group.agent === 'long')).toMatchObject({ suspectedProviderSystemErrors: 0, suspectedQualityErrors: 1 })
    expect(groups.find((group) => group.agent === 'short')).toMatchObject({ suspectedProviderSystemErrors: 1, suspectedQualityErrors: 0 })
    expect(groups.find((group) => group.agent === 'quality')).toMatchObject({ suspectedProviderSystemErrors: 0, suspectedQualityErrors: 1 })
  })

  it('applies 20/50/100 recommendation boundaries for resume and disable gates', () => {
    const below20 = manyStartedFinished(19, { agent: 'below20', isResume: true })
    const at20 = manyStartedFinished(20, { agent: 'at20', isResume: true }, 100)
    const at50 = manyStartedFinished(50, { agent: 'at50', isResume: true }, 200)
    const at99 = manyFinished(99, { agent: 'at99', state: 'error', usageAvailable: true, durationMs: 90_000, totalTokens: 100 }, 300)
    const at100 = manyFinished(100, { agent: 'at100', state: 'error', usageAvailable: true, durationMs: 90_000, totalTokens: 100 }, 500)

    const groups = analyzeAgentRuns([...below20, ...at20, ...at50, ...at99, ...at100]).groups

    expect(groups.find((group) => group.agent === 'below20')).toMatchObject({ recommendation: 'INSUFFICIENT_EVIDENCE' })
    expect(groups.find((group) => group.agent === 'at20')).toMatchObject({ recommendation: 'KEEP' })
    expect(groups.find((group) => group.agent === 'at20')?.softWarnings.join('\n')).toContain('isResume proxy reached soft investigate threshold')
    expect(groups.find((group) => group.agent === 'at50')).toMatchObject({ recommendation: 'REVIEW_PROMPT' })
    expect(groups.find((group) => group.agent === 'at99')).toMatchObject({ recommendation: 'CONSIDER_MODEL_CHANGE' })
    expect(groups.find((group) => group.agent === 'at100')).toMatchObject({ recommendation: 'CONSIDER_DISABLE' })
  })

  it('allows consider_disable only after severe sustained non-provider evidence and never as auto-action', () => {
    const records = [
      ...manyFinished(50, { agent: 'logic', model: 'm1', scenario: 'base', state: 'completed', usageAvailable: true, durationMs: 90_000, totalTokens: 100 }),
      ...manyFinished(50, { agent: 'logic', model: 'm1', scenario: 'base', state: 'error', usageAvailable: true, durationMs: 90_000, totalTokens: 100 }, 50),
    ]

    const [group] = analyzeAgentRuns(records).groups
    const report = buildAuditReport(records.map((record) => JSON.stringify(record)).join('\n'))
    expect(group.recommendation).toBe('CONSIDER_DISABLE')
    expect(group.recommendationReason).toContain('never automatic')
    expect(report).toContain('user approval required')
    expect(report).not.toContain('disable: true')
  })

  it('parses JSONL and exposes script output for package command wiring', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-audit-'))
    try {
      const journalPath = join(dir, 'agent-runs.jsonl')
      await writeFile(journalPath, [
        JSON.stringify(started('call-script', { agent: 'backend', model: 'm1', scenario: 'base' })),
        JSON.stringify(finished('call-script', { agent: 'backend', model: 'm1', scenario: 'base', state: 'completed', durationMs: 100 })),
        '{broken',
      ].join('\n'))

      const parsed = parseJsonlRecords(await import('node:fs/promises').then((fs) => fs.readFile(journalPath, 'utf8')))
      expect(parsed).toHaveLength(2)

      const result = await execFileAsync('node', ['scripts/opencode-agent-audit.mjs', journalPath])
      expect(result.stdout).toContain('OpenCode agent audit')
      expect(result.stdout).toContain('backend | m1 | base')
      expect(result.stdout).toContain('INSUFFICIENT_EVIDENCE')
      expect(result.stdout).not.toContain(dir)
      expect(result.stdout).not.toContain('/Users/')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('does not print missing journal paths or user home paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-audit-missing-'))
    try {
      const missingPath = join(dir, 'missing-agent-runs.jsonl')
      const result = await execFileAsync('node', ['scripts/opencode-agent-audit.mjs', missingPath])
      expect(result.stdout).toContain('OpenCode agent journal not found.')
      expect(result.stdout).toContain('No audit to show yet.')
      expect(result.stdout).not.toContain(missingPath)
      expect(result.stdout).not.toContain(dir)
      expect(result.stdout).not.toContain('/Users/')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

function started(callId: string, options: Record<string, unknown> = {}) {
  return {
    schemaVersion: options.schemaVersion ?? 2,
    event: 'started',
    timestamp: '2026-01-01T00:00:00.000Z',
    parentSessionId: 'parent',
    callId,
    description: options.description ?? '',
    agent: options.agent ?? 'backend',
    resolvedModel: options.model ?? 'm1',
    scenario: options.scenario ?? 'base',
    isResume: options.isResume ?? false,
    resumedTaskId: options.isResume ? 'previous-task' : null,
    returnedTaskId: null,
    state: null,
    durationMs: null,
  }
}

function finished(callId: string, options: Record<string, unknown> = {}) {
  return {
    schemaVersion: options.schemaVersion ?? 2,
    event: 'finished',
    timestamp: '2026-01-01T00:01:00.000Z',
    parentSessionId: 'parent',
    callId,
    description: options.description ?? '',
    agent: options.agent ?? 'backend',
    resolvedModel: options.model ?? 'm1',
    scenario: options.scenario ?? 'base',
    isResume: options.isResume ?? false,
    resumedTaskId: options.isResume ? 'previous-task' : null,
    returnedTaskId: `task-${callId}`,
    state: options.state ?? 'completed',
    durationMs: options.durationMs ?? 100,
    usageAvailable: options.usageAvailable ?? false,
    usageMessageCount: options.usageAvailable ? 1 : 0,
    inputTokens: options.inputTokens ?? null,
    outputTokens: options.outputTokens ?? null,
    reasoningTokens: options.reasoningTokens ?? null,
    cacheReadTokens: options.cacheReadTokens ?? null,
    cacheWriteTokens: options.cacheWriteTokens ?? null,
    totalTokens: options.totalTokens ?? null,
    cost: options.cost ?? null,
  }
}

function manyFinished(count: number, options: Record<string, unknown>, offset = 0) {
  return Array.from({ length: count }, (_, index) => finished(`call-${offset + index}`, options))
}

function manyStartedFinished(count: number, options: Record<string, unknown>, offset = 0) {
  return Array.from({ length: count }, (_, index) => {
    const callId = `call-${offset + index}`
    return [started(callId, options), finished(callId, options)]
  }).flat()
}
