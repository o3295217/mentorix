import { readFile, stat } from 'node:fs/promises'
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
      'creative-director': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      'motion-game-consultant': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      'interactive-frontend': { model: 'openai/gpt-5.6-sol', variant: 'high' },
      reviewer: { model: 'openai/gpt-5.5', variant: 'high' },
      'critical-reviewer': { model: 'openai/gpt-5.6-sol', variant: 'xhigh' },
    })
  })

  it('defines agent2.0_balanced as gpt56 plus read-only free research preparation only', async () => {
    const gpt56 = JSON.parse(await readFile(join(root, '.opencode/scenarios/agent2.0_gpt56.json'), 'utf8')) as {
      model: string
      agent: Record<string, { model: string; variant?: string }>
    }
    const balanced = JSON.parse(await readFile(join(root, '.opencode/scenarios/agent2.0_balanced.json'), 'utf8')) as {
      model: string
      agent: Record<string, { model: string; variant?: string }>
    }

    expect(balanced.model).toBe('openai/gpt-5.6-sol')
    expect(balanced.agent.junior).toEqual({ model: 'openai/gpt-5.4-mini', variant: 'low' })

    for (const [agent, mapping] of Object.entries(gpt56.agent)) {
      if (agent === 'explore') continue
      expect(balanced.agent[agent], `${agent} differs from gpt56`).toEqual(mapping)
    }

    const extraAgents = Object.keys(balanced.agent)
      .filter((agent) => !(agent in gpt56.agent))
      .sort()
    expect(extraAgents).toEqual(['agent-auditor', 'local', 'research-free'])

    expect(balanced.agent.explore).toEqual({ model: 'opencode/north-mini-code-free' })
    expect(balanced.agent['research-free']).toEqual({ model: 'opencode/nemotron-3-ultra-free' })
    expect(balanced.agent['agent-auditor']).toEqual({ model: 'opencode/nemotron-3-ultra-free' })
    expect(balanced.agent.local).toEqual({ model: 'ollama/batiai/qwen3.6-27b:q4-32k' })
    expect(balanced.agent.explore).not.toHaveProperty('variant')
    expect(balanced.agent['research-free']).not.toHaveProperty('variant')
    expect(balanced.agent['agent-auditor']).not.toHaveProperty('variant')
    expect(balanced.agent.local).not.toHaveProperty('variant')

    const freeAgents = Object.entries(balanced.agent)
      .filter(([, mapping]) => mapping.model.startsWith('opencode/'))
      .map(([agent]) => agent)
      .sort()
    expect(freeAgents).toEqual(['agent-auditor', 'explore', 'research-free'])
  })

  it('defines research-free as read-only research helper without execution or review authority', async () => {
    const content = await readFile(join(root, '.opencode/agent/research-free.md'), 'utf8')

    expectFrontmatter(content, {
      mode: 'subagent',
      model: 'opencode/nemotron-3-ultra-free',
    })

    const frontmatter = getFrontmatter(content)
    expect(frontmatter).not.toMatch(/^variant:/m)
    expect(frontmatter).toContain('edit: deny')
    expect(frontmatter).toContain('task: deny')
    expect(extractFrontmatterBlock(content, 'bash')).toEqual([['*', 'deny']])
    for (const inheritedTool of ['read', 'glob', 'grep', 'webfetch']) {
      expect(frontmatter).not.toMatch(new RegExp(`^  ${inheritedTool}:`, 'm'))
    }

    expect(content).toContain('read-only исследователь')
    expect(content).toContain('техническое и продуктовое исследование')
    expect(content).toContain('сравнение документации')
    expect(content).toContain('`file:line`')
    expect(content).toContain('URL')
    expect(content).toContain('Не вноси изменения')
    expect(content).toContain('Не принимай решения о приёмке')
    expect(content).toContain('Не делай неподтверждённых выводов')
    expect(content).toContain('lead должен эскалировать проверку на GPT')
  })

  it('wires balanced launcher and menu without changing the base default', async () => {
    const launcher = await readFile(join(root, 'scripts/opencode-agent2.0_balanced.sh'), 'utf8')
    const launcherStat = await stat(join(root, 'scripts/opencode-agent2.0_balanced.sh'))
    const menu = await readFile(join(root, 'scripts/opencode-start.sh'), 'utf8')

    expect(launcher).toContain('cat .opencode/scenarios/agent2.0_balanced.json')
    expect(launcher).toContain('exec opencode "$@"')
    expect(launcherStat.mode & 0o111).toBeGreaterThan(0)

    expect(menu).toContain('3) balanced')
    expect(menu).toContain('Сценарий [1/2/3]')
    expect(menu).toContain('cat .opencode/scenarios/agent2.0_balanced.json')
    expect(menu).toContain('Запуск: balanced')
    expect(menu).toContain('*)\n    echo "Запуск: base"')
  })

  it('defines agent-auditor as read-only audit helper and wires command/script', async () => {
    const agent = await readFile(join(root, '.opencode/agent/agent-auditor.md'), 'utf8')
    const command = await readFile(join(root, '.opencode/command/audit-agents.md'), 'utf8')
    const lead = await readFile(join(root, '.opencode/agent/lead.md'), 'utf8')
    const scenarios = await readFile(join(root, '.opencode/scenarios/README.md'), 'utf8')
    const metrics = await readFile(join(root, '.opencode/metrics/README.md'), 'utf8')
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    expectFrontmatter(agent, {
      mode: 'subagent',
      model: 'opencode/nemotron-3-ultra-free',
    })
    const frontmatter = getFrontmatter(agent)
    expect(frontmatter).not.toMatch(/^variant:/m)
    expect(frontmatter).toMatch(/^permission: deny$/m)
    expect(frontmatter).not.toMatch(/^permission:\n/m)
    for (const deniedTool of ['read', 'glob', 'grep', 'list', 'webfetch', 'websearch', 'edit', 'task', 'bash']) {
      expect(frontmatter).not.toMatch(new RegExp(`^  ${deniedTool}:`, 'm'))
    }
    expect(agent).toContain('Не вызывай инструменты')
    expect(agent).toContain('Анализируй только deterministic aggregate report')
    expect(agent).toContain('Не проси и не читай сырой')
    expect(agent).toContain('требуется согласование пользователя')
    for (const status of ['KEEP', 'INVESTIGATE_PROVIDER', 'REVIEW_PROMPT', 'CONSIDER_MODEL_CHANGE', 'CONSIDER_DISABLE', 'INSUFFICIENT_EVIDENCE']) {
      expect(agent).toContain(status)
    }

    expectFrontmatter(command, {
      agent: 'lead',
    })
    expect(command).toContain('npm run opencode:agent-audit')
    expect(command).toContain('затем вызови `agent-auditor`')
    expect(command).toContain('только stdout агрегированного отчёта')
    expect(command).toContain('не передавай сырой')
    expect(command).toContain('не раскрывай пользовательское содержимое')
    expect(command).not.toContain('$ARGUMENTS')
    expect(packageJson.scripts?.['opencode:agent-audit']).toBe('node scripts/opencode-agent-audit.mjs')
    expect(lead).toContain('`agent-auditor` | read-only quality auditor')
    expect(lead).toContain('не после каждой задачи')
    expect(lead).toContain('lead сам запускает ровно `npm run opencode:agent-audit`')
    expect(lead).toContain('передаёт только stdout агрегированного отчёта')
    expect(lead).toContain('Не передавай raw')
    expect(lead).toContain('без явного approval')
    expect(scenarios).toContain('Audit агентов')
    expect(scenarios).toContain('`isResume` — только proxy')
    expect(scenarios).toContain('| `research-free` — вспомогательное read-only исследование | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant |')
    expect(metrics).toContain('`>=100 finished`: `CONSIDER_DISABLE`')
    expect(metrics).toContain('Current schema cannot reliably infer lead override/escalation')
    expect(metrics).toContain('`agent2.0_balanced`')
    expect(metrics).toContain('does not print journal paths')
    expect(metrics).toContain('fail-closed (`permission: deny`)')
  })

  it('defines creative and motion consultants as read-only Fable specialists with handoff briefs', async () => {
    const creative = await readFile(join(root, '.opencode/agent/creative-director.md'), 'utf8')
    const motion = await readFile(join(root, '.opencode/agent/motion-game-consultant.md'), 'utf8')

    expectFrontmatter(creative, {
      mode: 'subagent',
      model: 'anthropic/claude-fable-5',
    })
    expectFrontmatter(motion, {
      mode: 'subagent',
      model: 'anthropic/claude-fable-5',
    })

    for (const content of [creative, motion]) {
      const frontmatter = getFrontmatter(content)
      expect(frontmatter).not.toMatch(/^variant:/m)
      expect(content).toContain('edit: deny')
      expect(content).toContain('task: deny')
      expect(extractFrontmatterBlock(content, 'bash')).toEqual([['*', 'deny']])
      expect(content).toContain('не пишешь код')
      expect(content).toContain('Handoff Brief')
      for (const section of [
        'Task/context',
        'Outcome',
        'Scope',
        'States',
        'Motion',
        'A11y',
        'Technical constraints',
        'Acceptance',
        'Reviewer focus',
      ]) {
        expect(content).toContain(section)
      }
    }

    expect(creative).toContain('screenshot critique')
    expect(creative).toContain('русская UX-copy')
    expect(motion).toContain('deterministic game loop')
    expect(motion).toContain('timing, easing')
  })

  it('defines interactive-frontend as a bounded Sol executor with required checks', async () => {
    const content = await readFile(join(root, '.opencode/agent/interactive-frontend.md'), 'utf8')

    expectFrontmatter(content, {
      mode: 'subagent',
      model: 'openai/gpt-5.6-sol',
      variant: 'high',
    })

    const frontmatter = getFrontmatter(content)
    expect(frontmatter).toContain('task: deny')
    for (const rule of [
      '"**": deny',
      '"app/globals.css": allow',
      '"app/page.tsx": allow',
      '"app/layout.tsx": allow',
      '"app/**/page.tsx": allow',
      '"app/**/layout.tsx": allow',
      '"components/**": allow',
      '"hooks/**": allow',
      '"tests/**": allow',
    ]) {
      expect(frontmatter).toContain(rule)
    }
    const editRules = extractFrontmatterBlock(content, 'edit')
    expect(editRules).toEqual([
      ['**', 'deny'],
      ['app/globals.css', 'allow'],
      ['app/page.tsx', 'allow'],
      ['app/layout.tsx', 'allow'],
      ['app/**/page.tsx', 'allow'],
      ['app/**/layout.tsx', 'allow'],
      ['app/api/**', 'deny'],
      ['components/**', 'allow'],
      ['hooks/**', 'allow'],
      ['tests/**', 'allow'],
    ])
    const canEdit = (filePath: string) => evaluateWildcardRules(editRules, filePath)
    expect(canEdit('app/page.tsx')).toBe('allow')
    expect(canEdit('app/layout.tsx')).toBe('allow')
    expect(canEdit('app/goals/page.tsx')).toBe('allow')
    expect(canEdit('app/periods/[id]/layout.tsx')).toBe('allow')
    expect(canEdit('app/api/x/page.tsx')).toBe('deny')
    expect(canEdit('app/api/x/layout.tsx')).toBe('deny')
    expect(canEdit('app/api/x/route.ts')).toBe('deny')
    expect(canEdit('components/Foo.tsx')).toBe('allow')
    expect(canEdit('components/goals/Foo.tsx')).toBe('allow')
    expect(canEdit('hooks/useFoo.ts')).toBe('allow')
    expect(canEdit('hooks/daily/useFoo.ts')).toBe('allow')
    expect(canEdit('tests/opencode/config.test.ts')).toBe('allow')
    expect(canEdit('lib/fetch-json.ts')).toBe('deny')
    expect(canEdit('prisma/schema.prisma')).toBe('deny')
    expect(canEdit('package.json')).toBe('deny')

    expect(extractFrontmatterBlock(content, 'bash')).toEqual([
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

    expect(content).toContain('Не трогай `app/api/`, `lib/`, `prisma/`')
    expect(content).toContain('Не добавляй зависимости без явного approval')
    expect(content).toContain('CSS transitions/animations и WAAPI-first')
    expect(content).toContain('prefers-reduced-motion')
    expect(content).toContain('timers/RAF/listeners/observers всегда делай cleanup')
    expect(content).toContain('Всегда прогоняй')
    expect(content).toContain('`npm run typecheck`, `npm run lint`, `npm run test`')
    expect(content).toContain('Дополнительно запускай `npm run build`')
    expect(content).not.toContain('tiny')
    expect(content).not.toContain('test/build не запускались')
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

  it('documents specialist routing, evidence and non-executable bake-off plan', async () => {
    const lead = await readFile(join(root, '.opencode/agent/lead.md'), 'utf8')
    const scenarios = await readFile(join(root, '.opencode/scenarios/README.md'), 'utf8')
    const specialists = await readFile(join(root, '.opencode/MODEL_SPECIALISTS.md'), 'utf8')
    const evals = await readFile(join(root, '.opencode/evals/creative-specialists.md'), 'utf8')

    for (const doc of [lead, scenarios]) {
      expect(doc).toContain('creative-director')
      expect(doc).toContain('motion-game-consultant')
      expect(doc).toContain('interactive-frontend')
      expect(doc).toContain('Handoff Brief')
      expect(doc).toContain('tiny hover/spacing/transition visual fixes')
      expect(doc).toContain('reviewer')
      expect(doc).toContain('Любая нетривиальная creative/motion/game задача')
      expect(doc).not.toContain('high-impact')
    }

    expect(lead).toContain('`creative-director` или `motion-game-consultant` → `interactive-frontend` → `reviewer`')
    expect(lead).toContain('новая interaction/game logic')
    expect(lead).toContain('новая dependency')

    expect(specialists).toContain('opencode models <provider>')
    expect(specialists).toContain('/connect')
    expect(specialists).toContain('openai/gpt-5.6-sol')
    expect(specialists).toContain('anthropic/claude-fable-5')
    expect(specialists).toContain('Kimi K3 `1679±17`')
    expect(specialists).toContain('Claude Fable 5 `1631±13`')
    expect(specialists).toContain('GPT-5.6 Sol xHigh (codex-harness) `1618±13`')
    expect(specialists).toContain('Claude Fable 5 `1627±15`')
    expect(specialists).toContain('Claude Opus 4.7 Thinking `1581±12`')
    expect(specialists).toContain('Coding Agent Index')
    expect(specialists).toContain('Terminal-Bench 2.1')
    expect(specialists).toContain('DeepSWE')
    expect(specialists).toContain('vendor claims')
    expect(specialists).toContain('No adequate narrow public benchmark')
    expect(specialists).toContain('Gemini 3.1 Pro')
    expect(specialists).toContain('GPT Image 2 / Recraft')
    expect(specialists).toContain('Recraft / Ideogram')
    expect(specialists).toContain('Gemini Omni Flash / Seedance')
    expect(specialists).toContain('Rodin / Meshy')
    expect(specialists).toContain('Do not cite Habr as support')
    expect(specialists).toContain('Never guess provider names or unsupported model IDs')
    for (const url of [
      'https://lmarena.ai/leaderboard/code/webdev',
      'https://lmarena.ai/leaderboard/code/image-to-webdev',
      'https://openai.com/index/gpt-5-6/',
      'https://platform.openai.com/docs/models/gpt-image-2',
      'https://www.anthropic.com/claude',
      'https://artificialanalysis.ai/models',
      'https://www.swebench.com/multimodal.html',
      'https://www.recraft.ai/api',
      'https://docs.ideogram.ai/',
      'https://hyper3d.ai/rodin',
      'https://www.meshy.ai/api',
    ]) {
      expect(specialists).toContain(url)
    }

    expect(evals).toContain('Track A — `creative-director` Handoff Briefs only')
    expect(evals).toContain('Track B — `motion-game-consultant` Handoff Briefs only')
    expect(evals).toContain('Track C — `interactive-frontend` fixed-handoff implementation')
    expect(evals).toContain('Run each task exactly 3 times per candidate')
    expect(evals).toContain('Pin repo SHA')
    expect(evals).toContain('same prompt text, attachments/screenshots, agent permissions, budget, timeout')
    expect(evals).toContain('consultants never edit code')
    expect(evals).toContain('independent `reviewer` evaluates every executor output')
    expect(evals).toContain('Blind scoring rubric')
    expect(evals).toContain('Hard gates')
    expect(evals).toContain('no executable tooling is added yet')
    expect(evals).toContain('wins at least 3 of 4 tasks')
    expect(evals).toContain('role slots')
    expect(evals).not.toContain('8-task project bake-off')
    expect(evals).not.toContain('Game debugging review')
    expect(evals).not.toContain('implement or specify')
  })
})

function expectFrontmatter(content: string, expected: Record<string, string>) {
  const frontmatter = getFrontmatter(content)

  for (const [key, value] of Object.entries(expected)) {
    expect(frontmatter).toMatch(new RegExp(`^${key}: ${escapeRegExp(value)}$`, 'm'))
  }
}

function extractFrontmatterBlock(content: string, key: string): Array<[string, string]> {
  const frontmatter = getFrontmatter(content)
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

function getFrontmatter(content: string) {
  return content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
}

function evaluateWildcardRules(rules: Array<[string, string]>, filePath: string) {
  let action = 'deny'
  for (const [pattern, nextAction] of rules) {
    if (matchesSimpleWildcard(pattern, filePath)) action = nextAction
  }
  return action
}

function matchesSimpleWildcard(pattern: string, filePath: string) {
  const source = pattern
    .split('*')
    .map(escapeRegExp)
    .join('.*')
  return new RegExp(`^${source}$`).test(filePath)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
