# Decisions log

Причины нетривиальных решений: что решили, почему, что отвергли, ссылки на файлы/коммит.
Факты выполнения (кто/что/когда) ведёт автоматически dev-log (`docs/dev-log/<YYYY-MM>.md`) — здесь только «почему».

---

## 2026-07-25 — Opus 5 для оркестратора в сценарии agent2.0_anthropic_primary

**Что решили.** В сценарии opencode `agent2.0_anthropic_primary` (и ТОЛЬКО в нём) применили новую модель `anthropic/claude-opus-5` для оркестратора `lead` и top-level `default model`. Остальные 3 сценария (`base`, `agent2.0_gpt56`, `agent2.0_balanced`) не тронуты — сценарии независимы.

**Файлы.**
- `.opencode/scenarios/agent2.0_anthropic_primary.json` — `model` и `lead.model` → `anthropic/claude-opus-5`.
- `.opencode/lib/agent-run-logger-core.ts` — `resolveScenario`: детекция сценария переведена с `defaultModel === fable-5` на `opus-5`; `ANTHROPIC_PRIMARY_AGENT_FINGERPRINT.lead` → opus-5, `visual-reviewer` синхронизирован с JSON (sonnet-5/high).
- `tests/opencode/config.test.ts`, `tests/opencode/agent-run-logger.test.ts` — пины + новый инвариант-тест fingerprint↔JSON.
- `.opencode/scenarios/README.md` — таблица приведена к реальному JSON.

**Почему.** ID `anthropic/claude-opus-5` подтверждён через `opencode models` (не угадан). Оркестрация/финальная приёмка — ядро экспертизы, оправдывает флагман. Правили только активный/целевой сценарий по требованию владельца.

**Что отвергли.**
- *Opus 5 для `critical-reviewer`* — отвергнуто намеренно: он остаётся на `anthropic/claude-fable-5`. Если lead и critical-reviewer оба opus, теряется кросс-модельная независимость ревью (разные семейства = разные слепые зоны).
- *Opus 5 для доменных (architecture/backend/logic)* — отвергнуто: в этом сценарии они на GPT-5.5 (дешевле по подписке); выгода Opus без bake-off не доказана.

**Процессные уроки (важно для будущих правок сценариев).**
- Смена `default model` сценария ломает `resolveScenario`, если детекция завязана на конкретную default-модель. Нашёл `critical-reviewer` на второй итерации: детекция уходила в `custom`.
- `matchesAnthropicPrimaryFingerprint` сверяет ВСЮ agent-матрицу — расхождение ЛЮБОЙ строки fingerprint с JSON (`visual-reviewer` model+variant) ломает детекцию молча, тесты были ложнозелёными. Добавлен инвариант-тест fingerprint↔JSON как защита от рецидива.

**Открытый вопрос (эскалирован отдельно).** `opencode.json` (base) сейчас `model: opus-4-8`, а ветка base в `resolveScenario` требует `fable-5` → реальные base-сессии тоже пишутся как `custom`. Это предсуществующая проблема другого потока, не входит в эту задачу; требует отдельного решения (обновить base-детекцию под opus-4-8 либо откатить opencode.json).

---

## 2026-07-25 — Локальный dev-log плагин для авто-журнала разработки

**Что решили.** Добавили локальный opencode-плагин, который при завершении делегированной субагенту задачи (`task`-инструмент) автоматически дописывает строку-факт в `docs/dev-log/<YYYY-MM>.md` (колонки: timestamp, agent, description, state, durationMs, isResume, callId).

**Файлы.**
- `.opencode/lib/dev-log-writer-core.ts` — логика (фабрика `createDevLogWriterHooks` + чистые хелперы).
- `.opencode/plugin/dev-log-writer.ts` — тонкий default-экспорт Plugin.
- `.opencode/agent/lead.md` — шаг 8 рабочего цикла: lead дописывает «почему» сюда.
- `AGENTS.md` — секция «Журнал разработки (dev-log)».

**Почему.** Нужно «не забывать» ход разработки без ручного объяснения opencode каждый раз. Метрики `agent-runs.jsonl` пишут телеметрию прогонов, но by design не хранят читаемый журнал «что делали», а `CHANGELOG.md` генерится из коммитов и не привязан к задачам субагентов. Плагин-хук надёжнее правила в промпте: пишет автоматически, не зависит от того, «вспомнит» ли агент.

**Что отвергли.**
- *Глобальный плагин в `~/.config/opencode/`* (работал бы во всех проектах) — sandbox opencode не даёт агентам писать вне корня проекта; глобальный файл создаёт только владелец машины вручную. Оставлено как отдельный ручной шаг владельца.
- *Отдельный агент-«писарь»* — дороже и хрупче автоматического хука.
- *Один вечный файл журнала* — отвергнут ради помесячной разбивки (`<YYYY-MM>.md`), чтобы файл не распухал как `CHANGELOG.md`.

**Границы решения.** Плагин пишет только факты; «почему» — вручную в этом файле (плагин причин не знает by design). Исключены технические/read-only роли: `agent-auditor`, `explore`, `research-free`. Применяется только после перезапуска opencode. Промпты/результаты/команды/env/секреты не логируются (описание санитизируется, обрезается до 180 симв., `|`→`/`).

**Паттерн.** Сделано по образцу существующего `agent-run-logger` (тонкий плагин + логика в `lib/`), чтобы legacy plugin loader не зарегистрировал хуки дважды (см. `.opencode/metrics/README.md`).

**Проверки.** `npm run typecheck` — ok; `npm run lint` — 0 errors (9 pre-existing warnings в чужих файлах); функциональный smoke-тест: заголовок пишется один раз, исключённые агенты пропускаются, state/isResume/durationMs/экранирование pipe — верны.
