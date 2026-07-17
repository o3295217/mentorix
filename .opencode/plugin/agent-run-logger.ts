import type { Plugin } from '@opencode-ai/plugin'
import { createAgentRunLoggerHooks } from '../lib/agent-run-logger-hooks'

export default (async (input) => {
  return createAgentRunLoggerHooks(input)
}) satisfies Plugin
