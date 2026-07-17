# Agent run journal

OpenCode auto-discovers local plugins from `.opencode/{plugin,plugins}/*.{ts,js}`. In the current legacy plugin loader every function export of a module is treated as a plugin function, so `.opencode/plugin/agent-run-logger.ts` intentionally exports only one runtime function — the default Plugin — while testable helpers live under `.opencode/lib/`. This prevents duplicate registration of the same `tool.execute.before`/`tool.execute.after` hooks from named helper exports. The plugin appends task-tool lifecycle events to:

```text
.opencode/metrics/agent-runs.jsonl
```

The runtime JSONL file is intentionally ignored by git. Keep this directory and README tracked.

## JSONL schema

Each line is a standalone JSON object. Current records use `schemaVersion: 2`; the stats script still reads older `schemaVersion: 1` rows.

- `event`: `started` or `finished`.
- `timestamp`: ISO timestamp.
- `parentSessionId`, `callId`.
- `description`: short sanitized description only; full prompt, command, output, task result, env and secrets are not logged.
- `agent`, `resolvedModel`, `scenario` (`base`, `agent2.0_gpt56`, or `custom`).
- `isResume`, `resumedTaskId`: `isResume: true` means the task call provided `args.task_id` and is a rework/resume attempt.
- `returnedTaskId`, `state` (`completed`, `error`, or `unknown`), `durationMs` on `finished` events.
- Economy fields on v2 records: `usageAvailable`, `usageMessageCount`, `inputTokens`, `outputTokens`, `reasoningTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`, `cost`, `usageModelId`, `usageProviderId`, `usageMode`, `usageVariant`.

Usage is collected from `message.updated` events as the latest cumulative usage per unique assistant message id in each session. The typed OpenCode form is `{ type: "message.updated", properties: { info } }`; the logger also tolerates older/alternate wrappers. `session.created` with `parentID` marks child sessions, `session.deleted` removes tracked usage, and all in-memory indexes are bounded: started calls, unmatched/parent usage sessions, child usage sessions, and pending child sessions created without messages are LRU-capped and cleaned from the same ownership path. On a finished Task call the plugin parses `<task id="...">`, treats it as the child session id, aggregates that child session only, and then clears it. Repeated updates for the same assistant message replace the previous snapshot instead of being double-counted. `cost` is the factual OpenCode-provided cost; the plugin does not calculate prices manually. If OpenCode does not provide usage or the child session cannot be matched, `usageAvailable` is `false` and numeric economy fields are `null`.

`totalTokens` is intentionally `inputTokens + outputTokens` only. It does not add `reasoningTokens` or `cacheReadTokens`/`cacheWriteTokens`, because AI SDK usage types document reasoning as an output-token category and cache read/write as input-token cache details. The separate category fields remain available for deeper analysis without double-counting.

`started` is written before the subagent runs, so it remains in the journal even if OpenCode exits before `finished`.

OpenCode loads config and project plugins only at process startup. After changing `.opencode/plugin/agent-run-logger.ts` or helper modules, quit and restart OpenCode before using runtime journal rows to validate uniqueness; an already-running session can keep the old double-registered module in memory.

## Reports

```bash
node scripts/opencode-agent-stats.mjs
node scripts/opencode-agent-stats.mjs /path/to/agent-runs.jsonl
```

The report aggregates by `agent + model + scenario` and shows started, finished, completed, errors, unfinished, resume attempts, completion/error rates, average duration, usage coverage, total/average cost, total/average tokens and token category sums. Before aggregation, `scripts/opencode-agent-stats.mjs` safely deduplicates historical duplicate lifecycle rows by `parentSessionId + callId + event`; rows without a reliable `callId` are kept. This corrects reports from journals written while the plugin was double-registered without rewriting evidence.

Do not edit, compact, rewrite, or delete the runtime journal to "fix" old duplicates. Keep `.opencode/metrics/agent-runs.jsonl` as append-only factual history; use the stats script for corrected aggregates.

Limit: first-pass acceptance cannot be determined automatically. The journal only proves starts, finishes, completion/error state, resume attempts, durations, and OpenCode-reported usage/cost when the hook event contains it. Prompt text, command text, task result, assistant output, env and secrets are not logged.
