---
description: Run deterministic OpenCode agent metrics audit and explain cautious recommendations.
agent: lead
---

Запусти ровно `npm run opencode:agent-audit`, затем вызови `agent-auditor` через Task и передай ему только stdout агрегированного отчёта.

Ограничения:
- не передавай сырой `.opencode/metrics/agent-runs.jsonl`, JSONL-строки, task descriptions, session ids, prompts/results или персональные данные;
- `agent-auditor` fail-closed и не имеет tools, поэтому он должен получить весь нужный aggregate report в prompt;
- не раскрывай пользовательское содержимое логов, prompts/results или персональные данные;
- не меняй файлы;
- отделяй provider/system instability от quality signal;
- `isResume` трактуй только как proxy, не как доказательство REWORK;
- любые изменения prompt/model/disable требуют согласования пользователя.
