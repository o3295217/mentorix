# Сценарии моделей opencode

Сценарий — это набор моделей и variants для оркестратора (`lead`), исполнителей,
встроенных агентов и read-only reviewers. Базовый конфиг (`opencode.json` +
`.opencode/agent/*.md`) загружается по умолчанию; сценарий подключается как overlay через
`OPENCODE_CONFIG_CONTENT` (финальный merge конфига opencode) и переопределяет только явно
указанные поля.

## Матрица моделей

| Роль / уровень | `base` (по умолчанию) | `agent2.0_gpt56` overlay | `agent2.0_balanced` overlay | `agent2.0_anthropic_primary` overlay |
|---|---|---|---|---|
| `lead` — orchestration/high-stakes acceptance | `anthropic/claude-fable-5`, variant не задан | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `anthropic/claude-opus-5`, variant не задан |
| `architecture`, `backend`, `logic` — сложные доменные изменения | `anthropic/claude-sonnet-5`, variant не задан | `openai/gpt-5.5`, `variant: high` | `openai/gpt-5.5`, `variant: high` | `openai/gpt-5.5`, `variant: high` |
| `frontend`, `design`, `scenario`, `specialist` — доменные изменения среднего риска | `anthropic/claude-sonnet-5`, variant не задан | `openai/gpt-5.5`, `variant: medium` | `openai/gpt-5.5`, `variant: medium` | `openai/gpt-5.5`, `variant: medium` |
| `junior` — простые правки | `anthropic/claude-haiku-4-5`, variant не задан | `openai/gpt-5.4-mini`, `variant: low` | `openai/gpt-5.4-mini`, `variant: low` | `anthropic/claude-haiku-4-5`, variant не задан |
| `local` — механические правки | `ollama/batiai/qwen3.6-27b:q4-32k`, без variant | не переопределяется, остаётся Ollama без variant | `ollama/batiai/qwen3.6-27b:q4-32k`, без variant | `ollama/batiai/qwen3.6-27b:q4-32k`, без variant |
| встроенный `explore` — быстрый read-only поиск | `anthropic/claude-haiku-4-5`, variant не задан (inline override, не наследует Fable) | `openai/gpt-5.4-mini`, `variant: low` (явно, не наследует Sol) | `opencode/north-mini-code-free`, без variant | `opencode/north-mini-code-free`, без variant |
| `research-free` — вспомогательное read-only исследование | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant |
| `agent-auditor` — read-only audit журнала агентов | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant | `opencode/nemotron-3-ultra-free`, без variant |
| встроенный `general` — универсальный встроенный агент | `anthropic/claude-sonnet-5`, `variant: high` (inline override, не наследует Fable) | `openai/gpt-5.5`, `variant: medium` | `openai/gpt-5.5`, `variant: medium` | `anthropic/claude-sonnet-5`, `variant: high` |
| `creative-director` — read-only creative consultant | `anthropic/claude-fable-5`, variant не задан | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `anthropic/claude-fable-5`, variant не задан |
| `motion-game-consultant` — read-only motion/game consultant | `anthropic/claude-fable-5`, variant не задан | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `anthropic/claude-fable-5`, variant не задан |
| `interactive-frontend` — executor для approved creative/motion/game specs | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `anthropic/claude-sonnet-5`, `variant: high` (явный override — обратно на Anthropic) |
| `visual-reviewer` — read-only browser/screenshot visual QA | `anthropic/claude-fable-5`, variant не задан | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | `anthropic/claude-sonnet-5`, `variant: high` |
| `reviewer` — независимая read-only приёмка | `anthropic/claude-sonnet-5`, `variant: high` | `openai/gpt-5.5`, `variant: high` | `openai/gpt-5.5`, `variant: high` | `anthropic/claude-sonnet-5`, `variant: high` |
| `critical-reviewer` — усиленная read-only приёмка | `anthropic/claude-fable-5`, `variant: max` | `openai/gpt-5.6-sol`, `variant: xhigh` | `openai/gpt-5.6-sol`, `variant: xhigh` | `anthropic/claude-fable-5`, `variant: max` |

В base встроенные `explore` и `general` переопределяются минимально в `opencode.json`: задаются только
`model`/`variant`, без замены built-in prompts/mode/permissions. Это нужно, чтобы они не наследовали
дорогой default `anthropic/claude-fable-5`.

В сценарии `agent2.0_gpt56` core executors, reviewers и acceptance-роли используют OpenAI.
Вспомогательные постоянные read-only helpers (`research-free`, `agent-auditor`) остаются на Zen Free;
`local` остаётся на Ollama и не получает `variant`.

`research-free` и `agent-auditor` — постоянные read-only agent files, поэтому доступны во всех сценариях
через frontmatter на free-модели; guardrails lead ограничивают их вспомогательным read-only использованием.

## Playwright MCP visual QA

- `opencode.json` подключает local MCP `playwright` через pinned command `npx -y @playwright/mcp@0.0.78 --isolated --headless --image-responses allow --codegen none`, `timeout: 30000`.
- Профиль browser isolated/headless; storage-state/secrets/persistent user-data-dir не используются и не должны добавляться в repo/prompts/results.
- Top-level permission fail-closed запрещает весь discovered Playwright MCP namespace. Safe tools явно разрешены только `lead`, `creative-director`, `design`, `visual-reviewer`.
- Разрешённый safe набор: navigate, resize, console messages, find, snapshot, screenshot, wait, hover, keyboard/Tab; click только для browser QA ролей, где это нужно для non-destructive visual states. Запрещены `browser_run_code_unsafe`, `browser_evaluate`, upload/drop, form fill/type/select, drag/tabs, network request details/headers/body, storage/cookie tools и unmatched `playwright_*`.
- `--allowed-origins` не используется как security boundary: проверку доменов/production safety делают permissions + prompts. Production без явно одобренного test account — только read-only public screens, без login/form submission/data mutations.
- После изменения MCP/agent config нужен restart OpenCode; текущая сессия не увидит новые tools/permissions.

В сценарии `agent2.0_balanced` default model остаётся `openai/gpt-5.6-sol`, а все GPT-исполнители,
reviewers и роли приёмки сохраняют те же модели/variants, что и `agent2.0_gpt56`. Free-модели
используются только для read-only подготовки: встроенный `explore` и `research-free` собирают
факты, ссылки и `file:line`, но не редактируют код, не ревьюят и не являются финальным основанием
для решений. `local` явно закреплён за Ollama и не получает `variant`.

Quality guardrails для `agent2.0_balanced`:
- GPT остаётся на авторах изменений, reviewers и финальной приёмке; free-агенты только помогают собрать факты, поэтому риск качества минимизирован организационно, но качество не считается доказанным.
- Доменный GPT-исполнитель самостоятельно проверяет релевантный код/документацию после free-подготовки.
- Неполный, противоречивый или неуверенный free-результат сразу эскалируется на GPT без повторных free retry.
- После запуска сценария нужны метрики/наблюдение: частота эскалаций, ошибки фактов, экономия токенов и verdict reviewers.

В сценарии `agent2.0_anthropic_primary` Anthropic остаётся основой: `lead`, `junior`, `reviewer`/
`critical-reviewer`, весь creative/motion/visual-QA кластер (`creative-director`,
`motion-game-consultant`, `interactive-frontend`, `visual-reviewer`) и встроенный `general` работают
на тех же Anthropic-моделях, что и в `base`. При этом 7 доменных исполнителей (`architecture`,
`backend`, `logic`, `frontend`, `design`, `scenario`, `specialist`) переведены на GPT-5.5 (`variant`
`high`/`medium`), потому что подписка ChatGPT делает это дешевле по факту использования, а не по
цене за токен: GPT-5.5 официально дороже Sonnet-5 за токен на Zen ($5/$30 против $2/$10 за 1M).
Встроенный `explore` — на бесплатной модели, так как это read-only задачи с низким риском.
GPT в этом сценарии capped на 5.5, `variant` не ниже `medium` — сознательно не используются
`gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.6-luna`.

## Audit агентов

- Детерминированный отчёт: `npm run opencode:agent-audit` или команда opencode `/audit-agents`.
- `agent-auditor` — fail-closed subagent на free-модели (`permission: deny`): не запускает tools сам; lead запускает audit script и передаёт auditor только aggregate stdout без journal path, raw IDs, JSONL, descriptions или пользовательского содержимого.
- Пороговые gates: `<20 finished` → `INSUFFICIENT_EVIDENCE`; `>=20` → только soft investigate; `>=50` → допустимы `REVIEW_PROMPT`/`CONSIDER_MODEL_CHANGE`; `>=100` → допустимо осторожное `CONSIDER_DISABLE`, но никогда автоматическое действие.
- `isResume` — только proxy повторной доработки, не доказательство quality REWORK. Текущая schema не позволяет точно вывести first-pass acceptance, lead override/escalation или причину resume.
- Перед любым prompt/model/disable lead показывает evidence пользователю, отделяет provider/system instability от quality signal и получает явное approval.

## Routing для creative/motion/game задач

- Любая нетривиальная creative/motion/game задача: `creative-director` или `motion-game-consultant` → `interactive-frontend` → `visual-reviewer` + `reviewer` → lead.
- Новая interaction/game logic требует цепочку consultant → `interactive-frontend` → `visual-reviewer` + обычный `reviewer` → lead; `critical-reviewer` добавляется только по high-risk правилам.
- Чисто визуальные изменения без новой логики: `visual-reviewer` → lead; технический reviewer добавляется по обычным risk rules.
- Только явные tiny hover/spacing/transition visual fixes без новой логики идут напрямую в существующие `frontend`/`design`/`junior` без consultant и без обязательного reviewer по правилам simple-task.
- Tiny typo/no-layout change можно не отправлять `visual-reviewer`; tiny spacing/hover user-visible fix должен быть просмотрен lead через Playwright MCP либо `visual-reviewer`.
- Parallel panel подключается только для больших или неоднозначных creative задач.
- Consultants всегда read-only и возвращают краткий Handoff Brief: Task/context, Outcome, Scope, States, Motion, A11y, Technical constraints, Acceptance, Reviewer focus. `creative-director` не ревьюит implementation; `visual-reviewer` делает независимую browser/screenshot QA после implementation.
- После `REWORK` нужны свежие screenshots и fresh verdict.

## Правила приёмки

- Lead всегда финальный арбитр и делает обычную приёмку сам для тривиальных/local/junior изменений.
- Lead может использовать Playwright MCP для собственной финальной browser-проверки UI. Исполнитель не принимает свою работу.
- Для substantial UI при доступном URL lead обязан сделать baseline/final Playwright inspection; final lead decision включает fresh visual evidence.
- `visual-reviewer` обязателен для существенных user-visible UI/design changes и fail-closed при недоступном browser/MCP/URL/auth. Он получает исходную задачу/Handoff Brief, acceptance, URL, pages/states/viewports, changed files и checks без отчёта автора; проверяет минимум desktop/mobile, dark theme, hierarchy/spacing/contrast, overflow, focus/keyboard/a11y snapshot и console errors. Для `ACCEPT` screenshot evidence обязательно.
- `reviewer` обязателен для многофайловых или неоднозначных изменений, новых API/контрактов,
  новой бизнес-логики, AI-логики и случаев, где есть сомнения в полноте проверок.
- `critical-reviewer` обязателен для auth, middleware, sessions/cookies, encryption/secrets,
  Prisma schema/migrations/data safety, rate limits, security, deploy/Docker и крупных архитектурных изменений.
- Reviewer получает исходную задачу, acceptance criteria, список файлов, актуальный `git diff` и результаты проверок.
  Отчёт/рассуждения исполнителя не передаются до собственного verdict reviewer.
- Reviewer agents read-only: `edit` и `task` запрещены; bash ограничен точным allow-list (`git status`, `git diff`/`--stat`/`--name-only`/`--check`, `npm run typecheck|lint|test|build`) без wildcard-суффиксов, shell chaining, дополнительных аргументов, пайпов и редиректов. Для чтения кода используются обычные read/grep/glob/list tools.
- При `VERDICT: REWORK` lead возвращает задачу исходному исполнителю через resume, затем запускает свежую повторную приёмку.
- Не запускай двух reviewers без необходимости: выбирай обычного или critical по максимальному риску.

## Как запускать

Выбор сценария — ПЕРЕД началом работы (конфиг opencode не перечитывается на лету):

- Меню выбора: `./scripts/opencode-start.sh`
- Напрямую base: `opencode`
- Напрямую agent2.0_gpt56: `./scripts/opencode-agent2.0_gpt56.sh`
- Напрямую agent2.0_balanced: `./scripts/opencode-agent2.0_balanced.sh`
- Напрямую anthropic_primary: `./scripts/opencode-agent2.0_anthropic_primary.sh`
- Audit агентов без интерактива: `npm run opencode:agent-audit`

Сменить сценарий в открытой сессии нельзя — нужно выйти и запустить заново.

## Как добавить новый сценарий

1. Скопируй `.opencode/scenarios/agent2.0_gpt56.json` под новым именем,
   замени модели и `variant` (список доступных моделей: `opencode models <provider>`).
2. Скопируй `scripts/opencode-agent2.0_gpt56.sh`, поправь путь к json.
3. Добавь пункт в меню `scripts/opencode-start.sh` и строку в таблицу выше.
