import { execFileSync, spawnSync } from 'node:child_process'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const launcherPath = join(root, 'Commit and Deploy Contabo.command')
const realGitPath = execFileSync('bash', ['-lc', 'command -v git'], { encoding: 'utf8' }).trim()

interface TempRepo {
  rootDir: string
  repoDir: string
  fakeBinDir: string
  npmLog: string
  deployLog: string
  launcherPath: string
}

describe('Commit and Deploy Contabo macOS launcher contract', () => {
  it('is executable bash and delegates deploy logic to the existing Contabo script', async () => {
    const launcher = await readFile(launcherPath, 'utf8')
    const mode = (await stat(launcherPath)).mode

    expect(mode & 0o111).not.toBe(0)
    expect(() => execFileSync('bash', ['-n', launcherPath], { stdio: 'pipe' })).not.toThrow()
    expect(launcher).toContain('#!/bin/bash')
    expect(launcher).toContain('set -Eeuo pipefail')
    expect(launcher).toContain('trap finish_before_exit EXIT')
    expect(launcher.indexOf('trap finish_before_exit EXIT')).toBeLessThan(
      launcher.indexOf('ROOT_DIR="$(cd "$(dirname "$0")" && pwd -P)"')
    )
    expect(launcher).toContain('ROOT_DIR="$(cd "$(dirname "$0")" && pwd -P)"')
    expect(launcher).toContain('DEPLOY_SCRIPT="$ROOT_DIR/deploy/deploy-contabo.sh"')
    expect(launcher).toContain('"$DEPLOY_SCRIPT"')
    expect(launcher).not.toMatch(/\/Users\//)
    expect(launcher).not.toMatch(/\/home\/oleg/)
    expect(launcher).not.toMatch(/\bwrangler\b/)
  })

  it('is non-interactive and disables paged git output', async () => {
    const launcher = await readFile(launcherPath, 'utf8')

    expect(launcher).toContain('DEFAULT_COMMIT_MESSAGE="chore: deploy current changes"')
    expect(launcher).toContain('COMMIT_DEPLOY_MESSAGE')
    expect(launcher).toContain('export GIT_PAGER=cat')
    expect(launcher).toContain('export PAGER=cat')
    expect(launcher).toContain('git --no-pager status --porcelain')
    expect(launcher).toContain('"$DEPLOY_SCRIPT" </dev/null')
    expect(launcher).not.toContain('/dev/tty')
    expect(launcher).not.toContain('Нажмите Enter')
    expect(launcher).not.toContain('confirm()')
    expect(launcher).not.toContain('Commit message:')
    expect(launcher).not.toContain('Подтвердить commit')
    expect(launcher).not.toContain('Staged paths:')
    expect(launcher).not.toContain('Staged stat:')
    expect(launcher).not.toContain('git diff --cached --stat')
    expect(launcher).not.toContain('Репозиторий: $ROOT_DIR')
    expect(launcher).not.toContain('Current PATH')
    expect(launcher).not.toContain('Git root: $GIT_TOPLEVEL')
    expect(launcher).not.toContain('snapshot сохранён: $INDEX_SNAPSHOT')
  })

  it('performs git safety checks without pull/rebase/reset/force/no-verify/amend/push in the launcher', async () => {
    const launcher = await readFile(launcherPath, 'utf8')

    expect(launcher).toContain('git rev-parse --is-inside-work-tree')
    expect(launcher).toContain('git symbolic-ref --quiet --short HEAD')
    expect(launcher).toContain("git rev-parse --abbrev-ref --symbolic-full-name '@{u}'")
    expect(launcher).toContain('git --no-pager status --porcelain')
    expect(launcher).toContain('[ ! -x "$DEPLOY_SCRIPT" ]')

    for (const forbidden of [
      /git\s+pull\b/,
      /git\s+rebase\b/,
      /git\s+reset\b/,
      /git\s+push\b/,
      /--force(?:-with-lease)?\b/,
      /--no-verify\b/,
      /--amend\b/,
      /git\s+config\b/,
    ]) {
      expect(launcher).not.toMatch(forbidden)
    }
  })

  it('uses raw NUL staged parsing, exact index snapshots and exact CHANGELOG self-entry validation', async () => {
    const launcher = await readFile(launcherPath, 'utf8')

    expect(launcher).toContain('git diff --cached --name-status -z --find-renames')
    expect(launcher).toContain('> "$staged_paths_file"')
    expect(launcher).toContain('done < "$staged_paths_file"')
    expect(launcher).toContain('git diff --cached --name-only -z > "$staged_file"')
    expect(launcher).toContain('git diff --name-only -z > "$unstaged_file"')
    expect(launcher).toContain('git ls-files --others --exclude-standard -z > "$untracked_file"')
    expect(launcher).toContain('git diff --cached --numstat -z -- CHANGELOG.md > "$numstat_file"')
    expect(launcher).toContain('git diff --cached --summary -- CHANGELOG.md > "$summary_file"')
    expect(launcher).toContain('git diff --cached --no-ext-diff --unified=0 -- CHANGELOG.md > "$patch_file"')
    expect(launcher).toContain('R*|C*)')
    expect(launcher).toContain('check_one_staged_path "$path"')
    expect(launcher).toContain('check_one_staged_path "$second_path"')
    expect(launcher).not.toContain('$(git diff --cached --name-status')
    expect(launcher).toContain('GIT_INDEX_PATH="$(git rev-parse --git-path index)"')
    expect(launcher).toContain('cp -p "$GIT_INDEX_PATH" "$INDEX_SNAPSHOT"')
    expect(launcher).toContain('mv "$restore_tmp" "$GIT_INDEX_PATH"')
    expect(launcher).toContain('trap \'on_signal INT 130\' INT')
    expect(launcher).toContain('git diff --cached --numstat -z -- CHANGELOG.md')
    expect(launcher).toContain('git diff --cached --summary -- CHANGELOG.md')
    expect(launcher).toContain('expected_date="$(date -u +%F)"')
    expect(launcher).toContain('expected_1="### $expected_date — docs: update changelog"')
    expect(launcher).toContain('expected_3="- 📝 Документация: 1 файлов"')
    expect(launcher).toContain('shopt -s nocasematch')
    expect(launcher).not.toContain("tr '[:upper:]' '[:lower:]'")
  })

  it('git status errors fail closed before deciding clean/dirty and before deploy', async () => {
    await withTempRepo(async repo => {
      const clean = runLauncher(repo, { GIT_FAKE_FAIL_STATUS_PORCELAIN: '1' })

      expect(clean.status).not.toBe(0)
      expect(clean.output).toContain('Не удалось проверить состояние рабочей копии')
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })

    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'dirty-status.txt'), 'changed\n')

      const dirty = runLauncher(repo, { GIT_FAKE_FAIL_STATUS_PORCELAIN: '1' })

      expect(dirty.status).not.toBe(0)
      expect(dirty.output).toContain('Не удалось проверить состояние рабочей копии')
      expect(stagedNames(repo.repoDir)).toEqual([])
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('sensitive staged diff errors fail closed and restore the pre-add index', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'diff-fail.txt'), 'changed\n')

      const result = runLauncher(repo, { GIT_FAKE_FAIL_SENSITIVE_DIFF: '1' })

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('Не удалось проверить staged paths')
      expect(stagedNames(repo.repoDir)).toEqual([])
      expect(statusShort(repo.repoDir)).toContain('?? diff-fail.txt')
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('required-check failure restores the pre-add staged index and blocks deploy without user input', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'already.txt'), 'staged\n')
      git(repo.repoDir, ['add', 'already.txt'])
      await writeFile(join(repo.repoDir, 'later.txt'), 'new\n')

      const result = runLauncher(repo, { FAKE_NPM_FAIL_ON: 'lint' })

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('npm run lint failed')
      expect(stagedNames(repo.repoDir)).toEqual(['already.txt'])
      expect(await readFile(repo.npmLog, 'utf8')).toBe('run typecheck\nrun lint\n')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('dirty success commits all changes with the fixed default message and calls mock deploy with zero input', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'already.txt'), 'staged\n')
      git(repo.repoDir, ['add', 'already.txt'])
      await writeFile(join(repo.repoDir, 'later.txt'), 'untracked\n')

      const result = runLauncher(repo)

      expect(result.status).toBe(0)
      expect(result.output).toContain('Изменения найдены: подготовлю commit автоматически.')
      expect(result.output).toContain('Создаю commit: chore: deploy current changes')
      expect(result.output).not.toContain('Commit message:')
      expect(result.output).not.toContain('Staged paths:')
      expect(result.output).not.toContain('already.txt')
      expect(result.output).not.toContain('later.txt')
      expect(result.output).not.toContain('files changed')
      expect(result.output).not.toContain('create mode')
      expect(statusShort(repo.repoDir)).toBe('')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(await readFile(repo.npmLog, 'utf8')).toBe('run typecheck\nrun lint\nrun test\n')
      expect(gitOutput(repo.repoDir, ['log', '--pretty=%s', '-1'])).toBe('chore: deploy current changes')
    })
  })

  it('does not print local temp/user paths on success or fail-closed rollback', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'no-path-success.txt'), 'changed\n')

      const result = runLauncher(repo)

      expect(result.status).toBe(0)
      expect(result.output).not.toContain(repo.rootDir)
      expect(result.output).not.toContain(repo.repoDir)
      expect(result.output).not.toContain(process.env.USER ?? '__missing_user__')
    })

    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'no-path-fail.txt'), 'changed\n')

      const result = runLauncher(repo, { FAKE_NPM_FAIL_ON: 'typecheck' })

      expect(result.status).not.toBe(0)
      expect(result.output).not.toContain(repo.rootDir)
      expect(result.output).not.toContain(repo.repoDir)
      expect(result.output).not.toContain(process.env.USER ?? '__missing_user__')
    })
  })

  it('bootstraps a Finder-like macOS PATH before npm checks and Husky node hooks', async () => {
    await withTempRepo(async repo => {
      await installFakeNode(repo.fakeBinDir)
      await writeFile(join(repo.repoDir, 'finder-path.txt'), 'changed\n')

      const result = runLauncher(repo, {
        COMMIT_DEPLOY_EXTRA_PATHS: repo.fakeBinDir,
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      })

      expect(result.status).toBe(0)
      expect(statusShort(repo.repoDir)).toBe('')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(await readFile(repo.npmLog, 'utf8')).toBe('run typecheck\nrun lint\nrun test\n')
    })
  })

  it('blocks sensitive-to-safe renames by checking both raw rename paths', async () => {
    await withTempRepo(async repo => {
      await mkdir(join(repo.repoDir, 'keys'))
      await writeFile(join(repo.repoDir, 'keys', 'secret.txt'), 'secret\n')
      git(repo.repoDir, ['add', 'keys/secret.txt'])
      git(repo.repoDir, ['commit', '-m', 'test: add sensitive fixture'])
      await rename(join(repo.repoDir, 'keys', 'secret.txt'), join(repo.repoDir, 'safe.txt'))

      const result = runLauncher(repo)

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('sensitive paths')
      expect(result.output).not.toContain('keys/secret.txt')
      expect(result.output).not.toContain('safe.txt')
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('blocks unicode/newline sensitive staged names without relying on display parsing', async () => {
    await withTempRepo(async repo => {
      const sensitiveName = `секрет\nключ.pem`
      await writeFile(join(repo.repoDir, sensitiveName), 'secret\n')

      const result = runLauncher(repo)

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('sensitive paths')
      expect(result.output).not.toContain('ключ.pem')
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('blocks .env.example with trailing newline and restores staging, while normal .env.example is allowed', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, `.env.example\n`), 'secret-like name\n')

      const blocked = runLauncher(repo)

      expect(blocked.status).not.toBe(0)
      expect(blocked.output).toContain('sensitive paths')
      expect(blocked.output).not.toContain('.env.example')
      expect(stagedNames(repo.repoDir)).toEqual([])
      expect(await maybeRead(repo.npmLog)).toBe('')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })

    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, '.env.example'), 'SAFE_EXAMPLE=value\n')

      const allowed = runLauncher(repo)

      expect(allowed.status).toBe(0)
      expect(statusShort(repo.repoDir)).toBe('')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(await readFile(repo.npmLog, 'utf8')).toBe('run typecheck\nrun lint\nrun test\n')
    })
  })

  it('clean flow calls only the mock deploy with zero input', async () => {
    await withTempRepo(async repo => {
      const result = runLauncher(repo)

      expect(result.status).toBe(0)
      expect(result.output).toContain('Изменений нет: будет задеплоен текущий HEAD.')
      expect(result.output).not.toContain('Deploy текущего HEAD без нового commit?')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(await maybeRead(repo.npmLog)).toBe('')
      expect(statusShort(repo.repoDir)).toBe('')
    })
  })

  it('dirty success with simulated Husky two-commit CHANGELOG ends clean and calls mock deploy', async () => {
    await withTempRepo(async repo => {
      await installChangelogPostCommitHook(repo.repoDir)
      await writeFile(join(repo.repoDir, 'app.txt'), 'changed\n')
      const todayUtc = new Date().toISOString().slice(0, 10)

      const result = runLauncher(repo)

      expect(result.status).toBe(0)
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(statusShort(repo.repoDir)).toBe('')
      expect(gitOutput(repo.repoDir, ['log', '--pretty=%s', '-2']).split('\n')).toEqual([
        'docs: update changelog',
        'chore: deploy current changes',
      ])
      const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
      expect(changelog).toContain(`### ${todayUtc} — chore: deploy current changes`)
      expect(changelog).toContain('— chore: deploy current changes')
      expect(changelog).not.toContain('— docs: update changelog')
    })
  })

  it('dirty success with the real Husky hooks/update-docs stays non-interactive and ends clean', async () => {
    await withTempRepo(async repo => {
      enableRealHuskyHooks(repo.repoDir)
      await writeFile(join(repo.repoDir, 'real-hooks.txt'), 'changed\n')
      const todayUtc = new Date().toISOString().slice(0, 10)

      const result = runLauncher(repo)

      expect(result.status).toBe(0)
      expect(result.output).not.toContain('Commit message:')
      expect(result.output).not.toContain('Нажмите Enter')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
      expect(statusShort(repo.repoDir)).toBe('')
      expect(gitOutput(repo.repoDir, ['log', '--pretty=%s', '-2']).split('\n')).toEqual([
        'docs: update changelog',
        'chore: deploy current changes',
      ])
      const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
      expect(changelog).toContain(`### ${todayUtc} — chore: deploy current changes`)
      expect(changelog).not.toContain('— docs: update changelog')
      await expect(readFile(join(repo.repoDir, 'PROJECT_STATUS.md'), 'utf8')).resolves.toContain(
        '# Статус проекта'
      )
    })
  })

  it('generated CHANGELOG name/count producer errors fail closed and preserve CHANGELOG', async () => {
    for (const [envName, expected] of [
      ['GIT_FAKE_FAIL_CHANGELOG_STAGED_NAMES', 'Не удалось проверить staged CHANGELOG'],
      ['GIT_FAKE_FAIL_CHANGELOG_UNSTAGED_NAMES', 'Не удалось проверить unstaged изменения'],
      ['GIT_FAKE_FAIL_CHANGELOG_UNTRACKED_NAMES', 'Не удалось проверить untracked изменения'],
    ] as const) {
      await withTempRepo(async repo => {
        await installChangelogPostCommitHook(repo.repoDir)
        await writeFile(join(repo.repoDir, 'changelog-name-fail.txt'), 'changed\n')

        const result = runLauncher(repo, { [envName]: '1' })

        expect(result.status).not.toBe(0)
        expect(result.output).toContain(expected)
        expect(await maybeRead(repo.deployLog)).toBe('')
        const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
        expect(changelog).toContain('— chore: deploy current changes')
        expect(changelog).not.toContain('— docs: update changelog')
      })
    }
  })

  it('generated CHANGELOG numstat/summary/patch producer errors fail closed and preserve docs self-entry', async () => {
    for (const [envName, expected] of [
      ['GIT_FAKE_FAIL_CHANGELOG_NUMSTAT', 'Не удалось проверить размер generated CHANGELOG entry'],
      ['GIT_FAKE_FAIL_CHANGELOG_SUMMARY', 'Не удалось проверить metadata generated CHANGELOG entry'],
      ['GIT_FAKE_FAIL_CHANGELOG_PATCH', 'Не удалось проверить patch generated CHANGELOG entry'],
    ] as const) {
      await withTempRepo(async repo => {
        await installChangelogPostCommitHook(repo.repoDir)
        await writeFile(join(repo.repoDir, 'changelog-patch-fail.txt'), 'changed\n')

        const result = runLauncher(repo, { [envName]: '1' })

        expect(result.status).not.toBe(0)
        expect(result.output).toContain(expected)
        expect(await maybeRead(repo.deployLog)).toBe('')
        const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
        expect(changelog).toContain('— chore: deploy current changes')
        expect(changelog).toContain('— docs: update changelog')
        expect(statusShort(repo.repoDir)).toContain('M  CHANGELOG.md')
      })
    }
  })

  it('allows a safe one-line commit message override without prompting', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'override.txt'), 'changed\n')

      const result = runLauncher(repo, { COMMIT_DEPLOY_MESSAGE: 'chore: one click deploy' })

      expect(result.status).toBe(0)
      expect(gitOutput(repo.repoDir, ['log', '--pretty=%s', '-1'])).toBe('chore: one click deploy')
      expect(await readFile(repo.deployLog, 'utf8')).toBe('deploy-eof\n')
    })
  })

  it('rejects multiline commit message override before staging and deploy', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'unsafe-message.txt'), 'changed\n')

      const result = runLauncher(repo, { COMMIT_DEPLOY_MESSAGE: 'chore: deploy\nextra' })

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('COMMIT_DEPLOY_MESSAGE должен быть одной строкой')
      expect(stagedNames(repo.repoDir)).toEqual([])
      expect(statusShort(repo.repoDir)).toContain('?? unsafe-message.txt')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('commit hook failure restores the pre-add staged index and blocks deploy', async () => {
    await withTempRepo(async repo => {
      await writeFile(join(repo.repoDir, 'already.txt'), 'staged\n')
      git(repo.repoDir, ['add', 'already.txt'])
      await writeFile(join(repo.repoDir, 'hook-fail.txt'), 'new\n')
      await installFailingPreCommitHook(repo.repoDir)

      const result = runLauncher(repo)

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('git commit завершился ошибкой')
      expect(result.output).not.toContain('hook-fail.txt')
      expect(stagedNames(repo.repoDir)).toEqual(['already.txt'])
      expect(await readFile(repo.npmLog, 'utf8')).toBe('run typecheck\nrun lint\nrun test\n')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('expected self-entry plus CHANGELOG mode change is preserved and deploy is blocked', async () => {
    await withTempRepo(async repo => {
      await installChangelogPostCommitHook(repo.repoDir, { chmodSelfEntry: true })
      await writeFile(join(repo.repoDir, 'app.txt'), 'changed\n')

      const result = runLauncher(repo)

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('CHANGELOG содержит не только ожидаемую generated self-entry')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
      const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
      expect(changelog).toContain('— docs: update changelog')
      expect(statusShort(repo.repoDir)).toContain('M  CHANGELOG.md')
      expect((await stat(join(repo.repoDir, 'CHANGELOG.md'))).mode & 0o111).not.toBe(0)
    })
  })

  it('unexpected extra CHANGELOG self-entry modification is preserved and deploy is blocked', async () => {
    await withTempRepo(async repo => {
      await installChangelogPostCommitHook(repo.repoDir, { addUnexpectedSelfEntryLine: true })
      await writeFile(join(repo.repoDir, 'app.txt'), 'changed\n')

      const result = runLauncher(repo)

      expect(result.status).not.toBe(0)
      expect(result.output).toContain('CHANGELOG содержит не только ожидаемую generated self-entry')
      await expect(readFile(repo.deployLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
      const changelog = await readFile(join(repo.repoDir, 'CHANGELOG.md'), 'utf8')
      expect(changelog).toContain('unexpected user-visible extra line')
      expect(statusShort(repo.repoDir)).toContain('M  CHANGELOG.md')
    })
  })
})

async function withTempRepo(run: (repo: TempRepo) => Promise<void>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'contabo-launcher-test-'))
  const repoDir = join(rootDir, 'repo')
  const fakeBinDir = join(rootDir, 'bin')
  const npmLog = join(rootDir, 'npm.log')
  const deployLog = join(rootDir, 'deploy.log')
  const tempLauncherPath = join(repoDir, 'Commit and Deploy Contabo.command')

  try {
    await mkdir(repoDir)
    await mkdir(fakeBinDir)
    await copyFile(launcherPath, tempLauncherPath)
    await chmod(tempLauncherPath, 0o755)
    await installFakeNpm(fakeBinDir)
    await installFakeGit(fakeBinDir)
    await installMockDeploy(repoDir)
    await installRealHuskyHookFiles(repoDir)

    git(repoDir, ['init', '-b', 'main'])
    git(repoDir, ['config', 'user.name', 'Launcher Test'])
    git(repoDir, ['config', 'user.email', 'launcher-test@example.local'])
    await writeFile(join(repoDir, 'README.md'), '# temp repo\n')
    await writeFile(join(repoDir, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n')
    await writeFile(
      join(repoDir, 'package.json'),
      '{"name":"tmp","version":"1.0.0","dependencies":{},"devDependencies":{}}\n'
    )
    await mkdir(join(repoDir, 'docs'))
    await writeFile(join(repoDir, 'docs', 'ARCHITECTURE.md'), '# Architecture\n')
    await mkdir(join(repoDir, 'prisma'))
    await writeFile(join(repoDir, 'prisma', 'schema.prisma'), 'model User {\n  id String @id\n}\n')
    await mkdir(join(repoDir, 'app'))
    await mkdir(join(repoDir, 'components'))
    git(repoDir, ['add', '.'])
    git(repoDir, ['commit', '-m', 'test: initial'])
    git(repoDir, ['remote', 'add', 'origin', join(rootDir, 'origin.git')])
    git(repoDir, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    git(repoDir, ['branch', '--set-upstream-to=origin/main', 'main'])

    await run({ rootDir, repoDir, fakeBinDir, npmLog, deployLog, launcherPath: tempLauncherPath })
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
}

async function installFakeNpm(fakeBinDir: string) {
  const npmPath = join(fakeBinDir, 'npm')
  await writeFile(
    npmPath,
    `#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
if [ "\${1:-}" = "run" ] && [ "\${2:-}" = "\${FAKE_NPM_FAIL_ON:-}" ]; then
  exit 42
fi
exit 0
`
  )
  await chmod(npmPath, 0o755)
}

async function installFakeGit(fakeBinDir: string) {
  const gitPath = join(fakeBinDir, 'git')
  await writeFile(
    gitPath,
    `#!/bin/sh
if [ "\${GIT_FAKE_FAIL_STATUS_PORCELAIN:-0}" = "1" ]; then
  if { [ "\${1:-}" = "status" ] && [ "\${2:-}" = "--porcelain" ]; } || \
     { [ "\${1:-}" = "--no-pager" ] && [ "\${2:-}" = "status" ] && [ "\${3:-}" = "--porcelain" ]; }; then
    exit 66
  fi
fi
if [ "\${GIT_FAKE_FAIL_SENSITIVE_DIFF:-0}" = "1" ] && [ "$*" = "diff --cached --name-status -z --find-renames" ]; then
  exit 67
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_STAGED_NAMES:-0}" = "1" ] && [ "$*" = "diff --cached --name-only -z" ]; then
  exit 68
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_UNSTAGED_NAMES:-0}" = "1" ] && [ "$*" = "diff --name-only -z" ]; then
  exit 69
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_UNTRACKED_NAMES:-0}" = "1" ] && [ "$*" = "ls-files --others --exclude-standard -z" ]; then
  exit 70
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_NUMSTAT:-0}" = "1" ] && [ "$*" = "diff --cached --numstat -z -- CHANGELOG.md" ]; then
  exit 71
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_SUMMARY:-0}" = "1" ] && [ "$*" = "diff --cached --summary -- CHANGELOG.md" ]; then
  exit 72
fi
if [ "\${GIT_FAKE_FAIL_CHANGELOG_PATCH:-0}" = "1" ] && [ "$*" = "diff --cached --no-ext-diff --unified=0 -- CHANGELOG.md" ]; then
  exit 73
fi
exec "$REAL_GIT" "$@"
`
  )
  await chmod(gitPath, 0o755)
}

async function installFakeNode(fakeBinDir: string) {
  const nodePath = join(fakeBinDir, 'node')
  await writeFile(
    nodePath,
    `#!/bin/sh
exit 0
`
  )
  await chmod(nodePath, 0o755)
}

async function installRealHuskyHookFiles(repoDir: string) {
  const huskyDir = join(repoDir, '.husky')
  const huskyInternalDir = join(huskyDir, '_')
  const scriptsDir = join(repoDir, 'scripts')

  await mkdir(huskyDir)
  await mkdir(huskyInternalDir)
  await mkdir(scriptsDir)
  await copyFile(join(root, '.husky', 'pre-commit'), join(huskyDir, 'pre-commit'))
  await copyFile(join(root, '.husky', 'commit-msg'), join(huskyDir, 'commit-msg'))
  await copyFile(join(root, '.husky', '_', 'h'), join(huskyInternalDir, 'h'))
  await copyFile(join(root, '.husky', '_', 'pre-commit'), join(huskyInternalDir, 'pre-commit'))
  await copyFile(join(root, '.husky', '_', 'commit-msg'), join(huskyInternalDir, 'commit-msg'))
  await copyFile(join(root, 'scripts', 'update-docs.js'), join(scriptsDir, 'update-docs.js'))
  await chmod(join(huskyDir, 'pre-commit'), 0o755)
  await chmod(join(huskyDir, 'commit-msg'), 0o755)
  await chmod(join(huskyInternalDir, 'h'), 0o755)
  await chmod(join(huskyInternalDir, 'pre-commit'), 0o755)
  await chmod(join(huskyInternalDir, 'commit-msg'), 0o755)
}

function enableRealHuskyHooks(repoDir: string) {
  git(repoDir, ['config', 'core.hooksPath', '.husky/_'])
}

async function installFailingPreCommitHook(repoDir: string) {
  const hookPath = join(repoDir, '.git', 'hooks', 'pre-commit')
  await writeFile(
    hookPath,
    `#!/bin/sh
exit 44
`
  )
  await chmod(hookPath, 0o755)
}

async function installMockDeploy(repoDir: string) {
  const deployDir = join(repoDir, 'deploy')
  await mkdir(deployDir)
  const deployPath = join(deployDir, 'deploy-contabo.sh')
  await writeFile(
    deployPath,
    `#!/bin/sh
if IFS= read -r unexpected; then
  printf 'stdin-not-eof:%s\n' "$unexpected" >> "$DEPLOY_LOG"
  exit 88
fi
printf 'deploy-eof\n' >> "$DEPLOY_LOG"
exit 0
`
  )
  await chmod(deployPath, 0o755)
}

async function installChangelogPostCommitHook(
  repoDir: string,
  options: { addUnexpectedSelfEntryLine?: boolean; chmodSelfEntry?: boolean } = {}
) {
  const hooksDir = join(repoDir, '.git', 'hooks')
  const hookPath = join(hooksDir, 'post-commit')
  const unexpectedLine = options.addUnexpectedSelfEntryLine
    ? "    lines.push('unexpected user-visible extra line')"
    : ''
  const chmodLine = options.chmodSelfEntry
    ? "  execFileSync('chmod', ['+x', changelogPath])"
    : ''

  await writeFile(
    hookPath,
    `#!/usr/bin/env node
const { execFileSync } = require('node:child_process')
const { readFileSync, writeFileSync } = require('node:fs')

const msg = execFileSync('git', ['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim()
const today = new Date().toISOString().slice(0, 10)
const docsLine = msg === 'docs: update changelog' ? '- 📝 Документация: 1 файлов' : '- 📦 Другое: 1 файлов'
const changelogPath = 'CHANGELOG.md'
const content = readFileSync(changelogPath, 'utf8')
const lines = ['', '### ' + today + ' — ' + msg, docsLine]
if (msg === 'docs: update changelog') {
${unexpectedLine}
${chmodLine}
}
lines.push('')
const next = content.replace('## [Unreleased]\\n', '## [Unreleased]\\n' + lines.join('\\n') + '\\n')
writeFileSync(changelogPath, next)
execFileSync('git', ['add', 'CHANGELOG.md'])
`
  )
  await chmod(hookPath, 0o755)
}

function runLauncher(repo: TempRepo, extraEnv: Record<string, string> = {}) {
  const result = spawnSync('bash', [repo.launcherPath], {
    cwd: repo.repoDir,
    input: '',
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${repo.fakeBinDir}:${process.env.PATH ?? ''}`,
      REAL_GIT: realGitPath,
      FAKE_NPM_LOG: repo.npmLog,
      DEPLOY_LOG: repo.deployLog,
      ...extraEnv,
    },
    timeout: 20_000,
  })

  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

function git(repoDir: string, args: string[]) {
  execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' })
}

function gitOutput(repoDir: string, args: string[]) {
  return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' }).trim()
}

function stagedNames(repoDir: string) {
  const output = gitOutput(repoDir, ['diff', '--cached', '--name-only'])
  return output ? output.split('\n') : []
}

function statusShort(repoDir: string) {
  return execFileSync('git', ['status', '--short'], { cwd: repoDir, encoding: 'utf8' })
}

async function maybeRead(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}
