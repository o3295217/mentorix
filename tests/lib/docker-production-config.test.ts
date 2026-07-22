import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const productionUrl = 'https://mentorix.aionlab.ru'

interface DeployFixture {
  rootDir: string
  repoDir: string
  fakeBinDir: string
  deployScript: string
  gitLog: string
  sshLog: string
  rsyncLog: string
}

describe('production Docker public URL contract', () => {
  it('passes exactly one public build arg and keeps NEXT_PUBLIC_APP_URL required at runtime', async () => {
    const compose = await readFile(join(root, 'docker-compose.production.yml'), 'utf8')

    expect(extractAppBuildArgs(compose)).toEqual({
      NEXT_PUBLIC_APP_URL: '${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL in .env.production}',
    })
    expect(compose).toContain(
      '- NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL in .env.production}'
    )
  })

  it('keeps env files, backups, keys and secrets out of Docker build context', async () => {
    const dockerignore = await readFile(join(root, '.dockerignore'), 'utf8')
    const entries = new Set(
      dockerignore
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
    )

    expect(entries).toContain('.env*')
    expect(entries).toContain('**/.env*')
    expect([...entries].some(entry => entry.startsWith('!.env') || entry.startsWith('!**/.env'))).toBe(false)
    for (const pattern of [
      'keys/',
      'keys/**',
      '**/keys/',
      '**/keys/**',
      '*.pem',
      '**/*.pem',
      '*.key',
      '**/*.key',
      '*.p12',
      '**/*.p12',
      '*.pfx',
      '**/*.pfx',
      'secrets/',
      'secrets/**',
      '**/secrets/',
      '**/secrets/**',
      '.secrets/',
      '.secrets/**',
      '**/.secrets/',
      '**/.secrets/**',
      'backups/',
      'backups/**',
      '**/backups/',
      '**/backups/**',
      'backup/',
      'backup/**',
      '**/backup/',
      '**/backup/**',
      'logs/',
      'logs/**',
      '**/logs/',
      '**/logs/**',
      '.tg-bot-token',
      '**/.tg-bot-token',
      '.tg-bot-env',
      '**/.tg-bot-env',
      '*.bak',
      '**/*.bak',
      '*.backup',
      '**/*.backup',
      '*.dump',
      '**/*.dump',
      '*.sql',
      '**/*.sql',
      '*.sql.gz',
      '**/*.sql.gz',
      '*.sql.gz.enc',
      '**/*.sql.gz.enc',
    ]) {
      expect(entries).toContain(pattern)
    }
    expect(entries).toContain('!prisma/migrations/**/migration.sql')
    expectOrdered(dockerignore, '*.sql', '!prisma/migrations/**/migration.sql')
    expectOrdered(dockerignore, '**/*.sql', '!prisma/migrations/**/migration.sql')
    expect(entries).toContain('scripts/*')
    expect(entries).toContain('!scripts/cleanup-expired.mjs')
    expect(entries).toContain('!scripts/validate-public-app-url.mjs')
  })

  it('uses the shared validator before copying source and building', async () => {
    const dockerfile = await readFile(join(root, 'Dockerfile'), 'utf8')

    expect(dockerfile).toContain('ARG NEXT_PUBLIC_APP_URL')
    expect(dockerfile).toContain(
      'COPY scripts/validate-public-app-url.mjs ./scripts/validate-public-app-url.mjs'
    )
    expect(dockerfile).toContain('RUN node ./scripts/validate-public-app-url.mjs "$NEXT_PUBLIC_APP_URL"')
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}')
    expect(indexOfRequired(dockerfile, 'RUN node ./scripts/validate-public-app-url.mjs')).toBeLessThan(
      indexOfRequired(dockerfile, 'COPY . .')
    )
    expect(indexOfRequired(dockerfile, 'ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}')).toBeLessThan(
      indexOfRequired(dockerfile, 'RUN npm run build')
    )
    expect(dockerfile).toContain('ENV BUILT_NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}')
    expect(dockerfile).toContain(
      'COPY --from=builder /app/scripts/validate-public-app-url.mjs /app/scripts/validate-public-app-url.mjs'
    )
    expect(dockerfile).not.toMatch(/COPY\s+\.env\.production\b/)
  })

  it('validates runtime URL equality before migrations at container startup', async () => {
    const entrypoint = await readFile(join(root, 'docker-entrypoint.sh'), 'utf8')

    expect(entrypoint).toContain(
      'node /app/scripts/validate-public-app-url.mjs "${NEXT_PUBLIC_APP_URL:-}" --equals "${BUILT_NEXT_PUBLIC_APP_URL:-}"'
    )
    expect(indexOfRequired(entrypoint, 'validate-public-app-url.mjs')).toBeLessThan(
      indexOfRequired(entrypoint, 'prisma/build/index.js migrate deploy')
    )
  })

  it('uses the same production domain in env example and deploy health URL', async () => {
    const envExample = await readFile(join(root, '.env.production.example'), 'utf8')
    const deployScript = await readFile(join(root, 'deploy/deploy-contabo.sh'), 'utf8')

    expect(envExample).toContain(`NEXT_PUBLIC_APP_URL=${productionUrl}`)
    expect(deployScript).toContain(`PUBLIC_HEALTH_URL="\${PUBLIC_HEALTH_URL:-${productionUrl}/api/health}"`)
    expect(deployScript).toContain(`echo "Приложение: ${productionUrl}"`)
  })

  it('uses direct Anthropic production config without proxy env or Wrangler', async () => {
    const compose = await readFile(join(root, 'docker-compose.production.yml'), 'utf8')
    const envExample = await readFile(join(root, '.env.production.example'), 'utf8')
    const localEnvExample = await readFile(join(root, '.env.example'), 'utf8')
    const anthropic = await readFile(join(root, 'lib/anthropic.ts'), 'utf8')
    const deployScript = await readFile(join(root, 'deploy/deploy-contabo.sh'), 'utf8')

    expect(compose).toContain(
      '- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in .env.production}'
    )
    for (const content of [compose, envExample, localEnvExample, anthropic]) {
      expect(content).not.toContain('ANTHROPIC_PROXY_URL')
      expect(content).not.toContain('ANTHROPIC_PROXY_SECRET')
      expect(content).not.toContain('x-proxy-secret')
      expect(content).not.toContain('baseURL')
    }
    expect(deployScript).toContain('api.anthropic.com/v1/messages')
    expect(deployScript).toContain('Production preflight на сервере: прямой Anthropic, без Cloudflare/Wrangler')
    expect(deployScript).toContain('.env.production не найден на сервере')
    expect(deployScript).toContain('curl -sS -o /dev/null -w')
    expect(deployScript).not.toMatch(/\bwrangler\s+(deploy|login|dev)\b/)
  })

  it('keeps Contabo deploy transport non-interactive and fail-fast', async () => {
    const deployScript = await readFile(join(root, 'deploy/deploy-contabo.sh'), 'utf8')

    expect(deployScript).toContain('export GIT_TERMINAL_PROMPT=0')
    expect(deployScript).toContain('export GIT_ASKPASS=/bin/false')
    expect(deployScript).toContain('export SSH_ASKPASS=/bin/false')
    expect(deployScript).toContain('export GIT_SSH_COMMAND="$SSH_COMMAND"')
    expect(deployScript).toContain('-o BatchMode=yes')
    expect(deployScript).toContain('-o StrictHostKeyChecking=yes')
    expect(deployScript).toContain('-o NumberOfPasswordPrompts=0')
    expect(deployScript).toContain('-o PasswordAuthentication=no')
    expect(deployScript).toContain('-o KbdInteractiveAuthentication=no')
    expect(deployScript).toContain('ssh -n')
    expect(deployScript).toContain('-e "$SSH_COMMAND"')
    expect(deployScript).toContain('sudo -n systemctl restart tg-bot')
    expect(deployScript).toContain('git -c core.askPass=/bin/false -c push.gpgSign=false push -- "$UPSTREAM_REMOTE" "HEAD:$UPSTREAM_MERGE" </dev/null')
    expect(deployScript).toContain('branch.$BRANCH.remote')
    expect(deployScript).toContain('branch.$BRANCH.merge')
    expect(deployScript).toContain('Локальный upstream remote')
    expect(deployScript).toContain('git --no-pager status --porcelain')
    expect(deployScript).not.toContain('StrictHostKeyChecking=accept-new')
    expect(deployScript).not.toContain('git status --short')
  })

  it('runs the Contabo deploy script against fake transports without interactive stdin', async () => {
    await withTempDeployFixture(async fixture => {
      const result = runDeployFixture(fixture)

      expect(result.status).toBe(0)
      expect(result.output).not.toContain(fixture.rootDir)
      expect(result.output).not.toContain(process.env.USER ?? '__missing_user__')
      expect(await readFile(fixture.gitLog, 'utf8')).toContain(
        'git|-c|core.askPass=/bin/false|-c|push.gpgSign=false|push|--|origin|HEAD:refs/heads/main|stdin=eof'
      )
      const sshLog = await readFile(fixture.sshLog, 'utf8')
      expect(sshLog).toContain('BatchMode=yes')
      expect(sshLog).toContain('StrictHostKeyChecking=yes')
      expect(sshLog).toContain('stdin=eof')
      const rsyncLog = await readFile(fixture.rsyncLog, 'utf8')
      expect(rsyncLog).toContain('-e|ssh -o BatchMode=yes -o StrictHostKeyChecking=yes')
      expect(rsyncLog).toContain('stdin=eof')
    })
  })

  it('blocks deploy before push when git status fails in the standalone deploy script', async () => {
    await withTempDeployFixture(async fixture => {
      const result = runDeployFixture(fixture, { FAKE_DEPLOY_GIT_STATUS_FAIL: '1' })

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('Не удалось проверить состояние рабочей копии')
      expect(await readFile(fixture.gitLog, 'utf8')).not.toContain('|push|')
      await expect(readFile(fixture.sshLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('uses direct Telegram API in operational scripts without stale proxy env or headers', async () => {
    const monitor = await readFile(join(root, 'scripts/monitor.sh'), 'utf8')
    const tgBot = await readFile(join(root, 'scripts/tg-bot.sh'), 'utf8')

    for (const script of [monitor, tgBot]) {
      expect(script).toContain('https://api.telegram.org/bot${TG_BOT_TOKEN}/')
      expect(script).not.toContain('TG_API_BASE')
      expect(script).not.toContain('TG_PROXY_SECRET')
      expect(script).not.toContain('x-tg-proxy-secret')
      expect(script).not.toContain('workers.dev')
    }
  })

  it('keeps dormant Worker package scripts fail-closed and free of Wrangler commands', async () => {
    for (const workerDir of ['cloudflare-proxy', 'cloudflare-tg-proxy']) {
      const packageJson = await readFile(join(root, workerDir, 'package.json'), 'utf8')
      expect(packageJson).not.toMatch(/\bwrangler\b/)
      expect(packageJson).toContain('Dormant fallback')

      for (const script of ['dev', 'deploy']) {
        expect(() => execFileSync('npm', ['run', script], {
          cwd: join(root, workerDir),
          stdio: 'pipe',
        }), `${workerDir} npm run ${script} must fail closed`).toThrow()
      }
    }
  })

  it('keeps deploy rsync aligned with Docker secret and dump exclusions while preserving Prisma migration SQL', async () => {
    const deployScript = await readFile(join(root, 'deploy/deploy-contabo.sh'), 'utf8')

    for (const pattern of [
      "--exclude '.env*'",
      "--exclude 'keys/'",
      "--exclude 'secrets/'",
      "--exclude '.secrets/'",
      "--exclude 'backups/'",
      "--exclude 'backup/'",
      "--exclude 'logs/'",
      "--exclude '*.pem'",
      "--exclude '*.key'",
      "--exclude '*.p12'",
      "--exclude '*.pfx'",
      "--exclude '*.bak'",
      "--exclude '*.backup'",
      "--exclude '*.dump'",
      "--exclude '*.sql'",
      "--exclude '*.sql.gz'",
      "--exclude '*.sql.gz.enc'",
      "--exclude '.tg-bot-token'",
      "--exclude '.tg-bot-env'",
    ]) {
      expect(deployScript).toContain(pattern)
    }
    expect(deployScript).toContain("--include '/prisma/migrations/**/migration.sql'")
    expectOrdered(deployScript, "--include '/prisma/migrations/**/migration.sql'", "--exclude '*.sql'")
  })

  it('keeps Docker context exclusions aligned with rsync sensitive artifact exclusions', async () => {
    const dockerignore = await readFile(join(root, '.dockerignore'), 'utf8')
    const deployScript = await readFile(join(root, 'deploy/deploy-contabo.sh'), 'utf8')
    const dockerEntries = new Set(
      dockerignore
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
    )

    const expectedAlignment: Array<[string, string[]]> = [
      ["--exclude '.env*'", ['.env*', '**/.env*']],
      ["--exclude 'backups/'", ['backups/', 'backups/**', '**/backups/', '**/backups/**']],
      ["--exclude 'backup/'", ['backup/', 'backup/**', '**/backup/', '**/backup/**']],
      ["--exclude 'logs/'", ['logs/', 'logs/**', '**/logs/', '**/logs/**']],
      ["--exclude 'data/'", ['data/']],
      ["--exclude '*.db'", ['*.db']],
      ["--exclude '*.db-journal'", ['*.db-journal']],
      ["--exclude '*.pem'", ['*.pem', '**/*.pem']],
      ["--exclude '*.key'", ['*.key', '**/*.key']],
      ["--exclude '*.p12'", ['*.p12', '**/*.p12']],
      ["--exclude '*.pfx'", ['*.pfx', '**/*.pfx']],
      ["--exclude '*.bak'", ['*.bak', '**/*.bak']],
      ["--exclude '*.backup'", ['*.backup', '**/*.backup']],
      ["--exclude '*.dump'", ['*.dump', '**/*.dump']],
      ["--exclude '*.sql'", ['*.sql', '**/*.sql', '!prisma/migrations/**/migration.sql']],
      ["--exclude '*.sql.gz'", ['*.sql.gz', '**/*.sql.gz']],
      ["--exclude '*.sql.gz.enc'", ['*.sql.gz.enc', '**/*.sql.gz.enc']],
      ["--exclude '.tg-bot-token'", ['.tg-bot-token', '**/.tg-bot-token']],
      ["--exclude '.tg-bot-env'", ['.tg-bot-env', '**/.tg-bot-env']],
      ["--exclude 'keys/'", ['keys/', 'keys/**', '**/keys/', '**/keys/**']],
      ["--exclude 'secrets/'", ['secrets/', 'secrets/**', '**/secrets/', '**/secrets/**']],
      ["--exclude '.secrets/'", ['.secrets/', '.secrets/**', '**/.secrets/', '**/.secrets/**']],
      ["--exclude '.opencode/'", ['.opencode']],
      ["--exclude 'coverage/'", ['coverage']],
    ]

    for (const [rsyncExclude, dockerPatterns] of expectedAlignment) {
      expect(deployScript).toContain(rsyncExclude)
      for (const pattern of dockerPatterns) {
        expect(dockerEntries, `${rsyncExclude} should align with ${pattern}`).toContain(pattern)
      }
    }
  })

  it('shared validator accepts valid public HTTPS URLs and rejects malformed or unsafe values', () => {
    expectValidatorSuccess(productionUrl)
    expectValidatorSuccess('https://example.com/path')

    for (const invalid of [
      '',
      '   ',
      'https://',
      'http://mentorix.aionlab.ru',
      'ftp://mentorix.aionlab.ru',
      'https://user@mentorix.aionlab.ru',
      'https://user:pass@mentorix.aionlab.ru',
      ' https://mentorix.aionlab.ru',
      'https://mentorix.aionlab.ru ',
      'not-a-url',
    ]) {
      expectValidatorFailure(invalid)
    }

    execFileSync('node', [validatorPath(), productionUrl, '--equals', productionUrl], { stdio: 'pipe' })
    expect(() =>
      execFileSync('node', [validatorPath(), productionUrl, '--equals', 'https://other.example.com'], { stdio: 'pipe' })
    ).toThrow()
  })
})

function extractAppBuildArgs(compose: string): Record<string, string> {
  const lines = compose.split('\n')
  const appIndex = lines.findIndex(line => line === '  app:')
  expect(appIndex).toBeGreaterThanOrEqual(0)

  const nextServiceIndex = lines.findIndex((line, index) => index > appIndex && /^  [a-zA-Z0-9_-]+:$/.test(line))
  const appLines = lines.slice(appIndex, nextServiceIndex === -1 ? lines.length : nextServiceIndex)

  const buildIndex = appLines.findIndex(line => line === '    build:')
  expect(buildIndex).toBeGreaterThanOrEqual(0)
  const afterBuild = appLines.slice(buildIndex + 1)
  const buildLines = afterBuild.slice(0, afterBuild.findIndex(line => /^    \S/.test(line)) + 1 || afterBuild.length)
  const argsIndex = buildLines.findIndex(line => line === '      args:')
  expect(argsIndex).toBeGreaterThanOrEqual(0)

  const args: Record<string, string> = {}
  for (const line of buildLines.slice(argsIndex + 1)) {
    if (!line.startsWith('        ')) break
    if (line.trim().startsWith('#')) continue
    const match = line.match(/^        ([A-Z0-9_]+): (.+)$/)
    expect(match, `unexpected build arg line: ${line}`).not.toBeNull()
    if (match) args[match[1]] = match[2]
  }

  return args
}

function indexOfRequired(value: string, search: string): number {
  const index = value.indexOf(search)
  expect(index, `missing ${search}`).toBeGreaterThanOrEqual(0)
  return index
}

function expectOrdered(value: string, before: string, after: string): void {
  expect(indexOfRequired(value, before)).toBeLessThan(indexOfRequired(value, after))
}

async function withTempDeployFixture(run: (fixture: DeployFixture) => Promise<void>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'contabo-deploy-test-'))
  const repoDir = join(rootDir, 'repo')
  const fakeBinDir = join(rootDir, 'bin')
  const deployDir = join(repoDir, 'deploy')
  const deployScript = join(deployDir, 'deploy-contabo.sh')
  const gitLog = join(rootDir, 'git.log')
  const sshLog = join(rootDir, 'ssh.log')
  const rsyncLog = join(rootDir, 'rsync.log')

  try {
    await mkdir(repoDir)
    await mkdir(fakeBinDir)
    await mkdir(deployDir)
    await copyFile(join(root, 'deploy', 'deploy-contabo.sh'), deployScript)
    await chmod(deployScript, 0o755)
    await installDeployFakeGit(fakeBinDir)
    await installDeployFakeSsh(fakeBinDir)
    await installDeployFakeRsync(fakeBinDir)
    await installDeployFakeCurl(fakeBinDir)

    await run({ rootDir, repoDir, fakeBinDir, deployScript, gitLog, sshLog, rsyncLog })
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
}

function runDeployFixture(fixture: DeployFixture, extraEnv: Record<string, string> = {}) {
  const result = spawnSync('bash', [fixture.deployScript], {
    cwd: fixture.repoDir,
    input: '',
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.fakeBinDir}:${process.env.PATH ?? ''}`,
      FAKE_DEPLOY_GIT_LOG: fixture.gitLog,
      FAKE_DEPLOY_SSH_LOG: fixture.sshLog,
      FAKE_DEPLOY_RSYNC_LOG: fixture.rsyncLog,
      ...extraEnv,
    },
    timeout: 20_000,
  })

  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

async function installDeployFakeGit(fakeBinDir: string) {
  const gitPath = join(fakeBinDir, 'git')
  await writeFile(
    gitPath,
    `#!/bin/sh
stdin_state=eof
if IFS= read -r unexpected; then stdin_state=has-input; fi
log_args() {
  printf 'git' >> "$FAKE_DEPLOY_GIT_LOG"
  for arg in "$@"; do printf '|%s' "$arg" >> "$FAKE_DEPLOY_GIT_LOG"; done
  printf '|stdin=%s\n' "$stdin_state" >> "$FAKE_DEPLOY_GIT_LOG"
}
case "$*" in
  '--no-pager status --porcelain')
    log_args "$@"
    [ "\${FAKE_DEPLOY_GIT_STATUS_FAIL:-0}" = "1" ] && exit 61
    exit 0
    ;;
  'rev-parse --abbrev-ref HEAD') log_args "$@"; printf 'main\n'; exit 0 ;;
  'config --get branch.main.remote') log_args "$@"; printf 'origin\n'; exit 0 ;;
  'config --get branch.main.merge') log_args "$@"; printf 'refs/heads/main\n'; exit 0 ;;
  'remote get-url origin') log_args "$@"; printf 'git@example.local:repo.git\n'; exit 0 ;;
esac
if [ "\${1:-}" = "-c" ] && [ "\${2:-}" = "core.askPass=/bin/false" ] && [ "\${3:-}" = "-c" ] && [ "\${4:-}" = "push.gpgSign=false" ] && [ "\${5:-}" = "push" ]; then
  log_args "$@"
  exit 0
fi
log_args "$@"
exit 99
`
  )
  await chmod(gitPath, 0o755)
}

async function installDeployFakeSsh(fakeBinDir: string) {
  const sshPath = join(fakeBinDir, 'ssh')
  await writeFile(
    sshPath,
    `#!/bin/sh
stdin_state=eof
if IFS= read -r unexpected; then stdin_state=has-input; fi
printf 'ssh' >> "$FAKE_DEPLOY_SSH_LOG"
for arg in "$@"; do printf '|%s' "$arg" >> "$FAKE_DEPLOY_SSH_LOG"; done
printf '|stdin=%s\n' "$stdin_state" >> "$FAKE_DEPLOY_SSH_LOG"
case "$*" in
  *"curl -sS -o /dev/null -w"*) printf '401'; exit 0 ;;
  *"docker inspect"*) printf 'healthy\n'; exit 0 ;;
  *) exit 0 ;;
esac
`
  )
  await chmod(sshPath, 0o755)
}

async function installDeployFakeRsync(fakeBinDir: string) {
  const rsyncPath = join(fakeBinDir, 'rsync')
  await writeFile(
    rsyncPath,
    `#!/bin/sh
stdin_state=eof
if IFS= read -r unexpected; then stdin_state=has-input; fi
printf 'rsync' >> "$FAKE_DEPLOY_RSYNC_LOG"
for arg in "$@"; do printf '|%s' "$arg" >> "$FAKE_DEPLOY_RSYNC_LOG"; done
printf '|stdin=%s\n' "$stdin_state" >> "$FAKE_DEPLOY_RSYNC_LOG"
exit 0
`
  )
  await chmod(rsyncPath, 0o755)
}

async function installDeployFakeCurl(fakeBinDir: string) {
  const curlPath = join(fakeBinDir, 'curl')
  await writeFile(
    curlPath,
    `#!/bin/sh
exit 0
`
  )
  await chmod(curlPath, 0o755)
}

function validatorPath(): string {
  return join(root, 'scripts/validate-public-app-url.mjs')
}

function expectValidatorSuccess(value: string): void {
  execFileSync('node', [validatorPath(), value], { stdio: 'pipe' })
}

function expectValidatorFailure(value: string): void {
  expect(() => execFileSync('node', [validatorPath(), value], { stdio: 'pipe' }), value).toThrow()
}
