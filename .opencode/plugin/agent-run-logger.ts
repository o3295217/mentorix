import type { Config, Hooks, Plugin } from '@opencode-ai/plugin'
import { createAgentRunLogger, getDefaultJournalPath } from '../lib/agent-run-logger-core'

type ConfigLike = Parameters<ReturnType<typeof createAgentRunLogger>['started']>[1]
type Logger = ReturnType<typeof createAgentRunLogger>
type BeforeInput = { tool: string; sessionID: string; callID: string }
type BeforeOutput = { args: unknown }
type AfterInput = { tool: string; sessionID: string; callID: string; args: unknown }
type AfterOutput = { title: string; output: string; metadata: unknown }

export function resolveWorktree(input: { worktree?: unknown; project?: unknown; directory?: unknown }): string {
  if (typeof input.worktree === 'string' && input.worktree) return input.worktree

  const project = input.project
  if (project && typeof project === 'object') {
    const root = (project as { root?: unknown; path?: unknown; directory?: unknown }).root
    if (typeof root === 'string') return root
    const path = (project as { path?: unknown }).path
    if (typeof path === 'string') return path
    const directory = (project as { directory?: unknown }).directory
    if (typeof directory === 'string') return directory
  }

  return typeof input.directory === 'string' ? input.directory : process.cwd()
}

export async function createAgentRunLoggerHooks(
  input: { worktree?: unknown; project?: unknown; directory?: unknown },
  loggerFactory: (journalPath: string) => Logger = (journalPath) => createAgentRunLogger({ journalPath }),
): Promise<Hooks> {
  let mergedConfig: ConfigLike = {}
  const logger = loggerFactory(getDefaultJournalPath(resolveWorktree(input)))

  return {
    config: async (config: Config) => {
      mergedConfig = config as ConfigLike
    },
    'tool.execute.before': async (hookInput: BeforeInput, hookOutput: BeforeOutput) => {
      await logger.started({ ...hookInput, args: hookOutput.args }, mergedConfig)
    },
    'tool.execute.after': async (hookInput: AfterInput, hookOutput: AfterOutput) => {
      await logger.finished(hookInput, hookOutput)
    },
  }
}

export default (async (input) => {
  return createAgentRunLoggerHooks(input)
}) satisfies Plugin
