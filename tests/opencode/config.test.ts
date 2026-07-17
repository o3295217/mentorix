import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('opencode model strategy config', () => {
  it('pins base built-in agent overrides without replacing built-in prompts', async () => {
    const base = JSON.parse(await readFile(join(root, 'opencode.json'), 'utf8')) as {
      agent?: Record<string, { model?: string; variant?: string; prompt?: string; mode?: string; permission?: unknown }>
    }

    expect(base.agent).toMatchObject({
      explore: { model: 'anthropic/claude-haiku-4-5' },
      general: { model: 'anthropic/claude-sonnet-5', variant: 'high' },
    })
    expect(base.agent?.explore).not.toHaveProperty('variant')
    for (const agent of ['explore', 'general']) {
      expect(base.agent?.[agent]).not.toHaveProperty('prompt')
      expect(base.agent?.[agent]).not.toHaveProperty('mode')
      expect(base.agent?.[agent]).not.toHaveProperty('permission')
    }
  })

  it('pins agent2.0_gpt56 overlay models and variants', async () => {
    const overlay = JSON.parse(await readFile(join(root, '.opencode/scenarios/agent2.0_gpt56.json'), 'utf8')) as {
      agent: Record<string, { model: string; variant?: string }>
    }

    expect(overlay.agent).toMatchObject({
      lead: { model: 'openai/gpt-5.6-sol', variant: 'high' },
      architecture: { model: 'openai/gpt-5.5', variant: 'high' },
      backend: { model: 'openai/gpt-5.5', variant: 'high' },
      logic: { model: 'openai/gpt-5.5', variant: 'high' },
      frontend: { model: 'openai/gpt-5.5', variant: 'medium' },
      design: { model: 'openai/gpt-5.5', variant: 'medium' },
      scenario: { model: 'openai/gpt-5.5', variant: 'medium' },
      specialist: { model: 'openai/gpt-5.5', variant: 'medium' },
      junior: { model: 'openai/gpt-5.4-mini', variant: 'low' },
      explore: { model: 'openai/gpt-5.4-mini', variant: 'low' },
      general: { model: 'openai/gpt-5.5', variant: 'medium' },
      reviewer: { model: 'openai/gpt-5.5', variant: 'high' },
      'critical-reviewer': { model: 'openai/gpt-5.6-sol', variant: 'xhigh' },
    })
  })

  it('keeps reviewer agents read-only with safe review prompts', async () => {
    const reviewer = await readFile(join(root, '.opencode/agent/reviewer.md'), 'utf8')
    const critical = await readFile(join(root, '.opencode/agent/critical-reviewer.md'), 'utf8')

    expectFrontmatter(reviewer, {
      mode: 'subagent',
      model: 'anthropic/claude-sonnet-5',
      variant: 'high',
    })
    expectFrontmatter(critical, {
      mode: 'subagent',
      model: 'anthropic/claude-fable-5',
      variant: 'max',
    })

    for (const content of [reviewer, critical]) {
      expect(content).toContain('edit: deny')
      expect(content).toContain('task: deny')
      expect(content).toContain('"*": deny')
      const bashRules = extractFrontmatterBlock(content, 'bash')
      expect(bashRules).toEqual([
        ['*', 'deny'],
        ['git status', 'allow'],
        ['git status --short', 'allow'],
        ['git diff', 'allow'],
        ['git diff --stat', 'allow'],
        ['git diff --name-only', 'allow'],
        ['git diff --check', 'allow'],
        ['npm run typecheck', 'allow'],
        ['npm run lint', 'allow'],
        ['npm run test', 'allow'],
        ['npm run build', 'allow'],
      ])
      expect(bashRules.slice(1).every(([pattern]) => !pattern.includes('*'))).toBe(true)
      expect(content).toContain('без аргументов, `;`, `&&`, `||`, пайпов')
      expect(content).toContain('VERDICT: ACCEPT')
      expect(content).toContain('VERDICT: REWORK')
      expect(content).toContain('Не доверяй')
    }

    expect(critical).toContain('Auth/session/security')
    expect(critical).toContain('Prisma/data safety')
    expect(critical).toContain('Docker/deploy/security')
  })
})

function expectFrontmatter(content: string, expected: Record<string, string>) {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''

  for (const [key, value] of Object.entries(expected)) {
    expect(frontmatter).toMatch(new RegExp(`^${key}: ${escapeRegExp(value)}$`, 'm'))
  }
}

function extractFrontmatterBlock(content: string, key: string): Array<[string, string]> {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const lines = frontmatter.split('\n')
  const start = lines.findIndex((line) => line === `  ${key}:`)
  expect(start).toBeGreaterThanOrEqual(0)

  const rules: Array<[string, string]> = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('    ')) break
    const match = line.match(/^    "(.+)": (allow|ask|deny)$/)
    expect(match, `unexpected ${key} rule: ${line}`).not.toBeNull()
    if (match) rules.push([match[1], match[2]])
  }

  return rules
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
