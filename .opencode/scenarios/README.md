# Сценарии моделей opencode

Сценарий — это набор моделей для оркестратора (`lead`) и субагентов.
Базовый конфиг (`opencode.json` + `.opencode/agent/*.md`) не меняется:
сценарий подключается как оверлей через `OPENCODE_CONFIG_CONTENT`
(финальный merge конфига opencode) и переопределяет только модели.

## Доступные сценарии

| Роль / уровень | `base` (по умолчанию) | `agent2.0_gpt56` |
|---|---|---|
| `lead` — очень сложные (оркестрация) | `anthropic/claude-fable-5` | `openai/gpt-5.6-sol` |
| `architecture`, `backend`, `logic`, `specialist` — сложные | `anthropic/claude-sonnet-5` | `openai/gpt-5.5` (полный, без fast) |
| `frontend`, `design`, `scenario` — простые | `anthropic/claude-sonnet-5` | `openai/gpt-5.5` |
| `junior` — простые | `anthropic/claude-haiku-4-5` | `anthropic/claude-haiku-4-5` |
| `local` — очень простые | Ollama qwen3.6-27b | Ollama qwen3.6-27b (без изменений) |

В сценарии `agent2.0_gpt56` Anthropic используется только `junior`-агентом, остальные роли используют OpenAI, `local` — Ollama.
Модели 5.4 и fast-варианты не используются.

## Как запускать

Выбор сценария — ПЕРЕД началом работы (конфиг opencode не перечитывается на лету):

- Меню выбора: `./scripts/opencode-start.sh`
- Напрямую base: `opencode`
- Напрямую agent2.0_gpt56: `./scripts/opencode-agent2.0_gpt56.sh`

Сменить сценарий в открытой сессии нельзя — нужно выйти и запустить заново.

## Как добавить новый сценарий

1. Скопируй `.opencode/scenarios/agent2.0_gpt56.json` под новым именем,
   замени модели (список доступных: `opencode models`).
2. Скопируй `scripts/opencode-agent2.0_gpt56.sh`, поправь путь к json.
3. Добавь пункт в меню `scripts/opencode-start.sh` и строку в таблицу выше.
