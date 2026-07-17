# Сценарии моделей opencode

Сценарий — это набор моделей и variants для оркестратора (`lead`), исполнителей,
встроенных агентов и read-only reviewers. Базовый конфиг (`opencode.json` +
`.opencode/agent/*.md`) загружается по умолчанию; сценарий подключается как overlay через
`OPENCODE_CONFIG_CONTENT` (финальный merge конфига opencode) и переопределяет только явно
указанные поля.

## Матрица моделей

| Роль / уровень | `base` (по умолчанию) | `agent2.0_gpt56` overlay |
|---|---|---|
| `lead` — orchestration/high-stakes acceptance | `anthropic/claude-fable-5`, variant не задан | `openai/gpt-5.6-sol`, `variant: high` |
| `architecture`, `backend`, `logic` — сложные доменные изменения | `anthropic/claude-sonnet-5`, variant не задан | `openai/gpt-5.5`, `variant: high` |
| `frontend`, `design`, `scenario`, `specialist` — доменные изменения среднего риска | `anthropic/claude-sonnet-5`, variant не задан | `openai/gpt-5.5`, `variant: medium` |
| `junior` — простые правки | `anthropic/claude-haiku-4-5`, variant не задан | `openai/gpt-5.4-mini`, `variant: low` |
| `local` — механические правки | `ollama/batiai/qwen3.6-27b:q4-32k`, без variant | не переопределяется, остаётся Ollama без variant |
| встроенный `explore` — быстрый read-only поиск | `anthropic/claude-haiku-4-5`, variant не задан (inline override, не наследует Fable) | `openai/gpt-5.4-mini`, `variant: low` (явно, не наследует Sol) |
| встроенный `general` — универсальный встроенный агент | `anthropic/claude-sonnet-5`, `variant: high` (inline override, не наследует Fable) | `openai/gpt-5.5`, `variant: medium` |
| `reviewer` — независимая read-only приёмка | `anthropic/claude-sonnet-5`, `variant: high` | `openai/gpt-5.5`, `variant: high` |
| `critical-reviewer` — усиленная read-only приёмка | `anthropic/claude-fable-5`, `variant: max` | `openai/gpt-5.6-sol`, `variant: xhigh` |

В base встроенные `explore` и `general` переопределяются минимально в `opencode.json`: задаются только
`model`/`variant`, без замены built-in prompts/mode/permissions. Это нужно, чтобы они не наследовали
дорогой default `anthropic/claude-fable-5`.

В сценарии `agent2.0_gpt56` все перечисленные роли кроме `local` используют OpenAI.
`local` остаётся на Ollama и не получает `variant`.

## Правила приёмки

- Lead всегда финальный арбитр и делает обычную приёмку сам для тривиальных/local/junior изменений.
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

Сменить сценарий в открытой сессии нельзя — нужно выйти и запустить заново.

## Как добавить новый сценарий

1. Скопируй `.opencode/scenarios/agent2.0_gpt56.json` под новым именем,
   замени модели и `variant` (список доступных моделей: `opencode models <provider>`).
2. Скопируй `scripts/opencode-agent2.0_gpt56.sh`, поправь путь к json.
3. Добавь пункт в меню `scripts/opencode-start.sh` и строку в таблицу выше.
