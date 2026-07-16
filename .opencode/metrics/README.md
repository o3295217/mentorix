# Agent run journal

OpenCode auto-loads `.opencode/plugin/agent-run-logger.ts` for both the base config and the `agent2.0_gpt56` overlay. The plugin appends task-tool lifecycle events to:

```text
.opencode/metrics/agent-runs.jsonl
```

The runtime JSONL file is intentionally ignored by git. Keep this directory and README tracked.

## JSONL schema

Each line is a standalone JSON object with `schemaVersion: 1` and these fields:

- `event`: `started` or `finished`.
- `timestamp`: ISO timestamp.
- `parentSessionId`, `callId`.
- `description`: short sanitized description only; full prompt, command, output, task result, env and secrets are not logged.
- `agent`, `resolvedModel`, `scenario` (`base`, `agent2.0_gpt56`, or `custom`).
- `isResume`, `resumedTaskId`: `isResume: true` means the task call provided `args.task_id` and is a rework/resume attempt.
- `returnedTaskId`, `state` (`completed`, `error`, or `unknown`), `durationMs` on `finished` events.

`started` is written before the subagent runs, so it remains in the journal even if OpenCode exits before `finished`.

## Reports

```bash
node scripts/opencode-agent-stats.mjs
node scripts/opencode-agent-stats.mjs /path/to/agent-runs.jsonl
```

The report aggregates by `agent + model + scenario` and shows started, finished, completed, errors, unfinished, resume attempts, completion rate and average duration.

Limit: first-pass acceptance cannot be determined automatically. The journal only proves starts, finishes, completion/error state, and resume attempts.
