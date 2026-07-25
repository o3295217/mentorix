import type { Plugin } from '@opencode-ai/plugin'
import { createDevLogWriterHooks } from '../lib/dev-log-writer-core'

export default (async (input) => createDevLogWriterHooks(input)) satisfies Plugin
