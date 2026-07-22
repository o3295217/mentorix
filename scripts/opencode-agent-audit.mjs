#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildAuditReport } from '../.opencode/lib/agent-audit-core.mjs'

const journalPath = resolve(process.argv[2] ?? '.opencode/metrics/agent-runs.jsonl')

if (!existsSync(journalPath)) {
  console.log('OpenCode agent journal not found.')
  console.log('No audit to show yet.')
  process.exit(0)
}

console.log(buildAuditReport(readFileSync(journalPath, 'utf8')))
