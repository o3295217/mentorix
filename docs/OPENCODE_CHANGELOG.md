# OPENCODE_CHANGELOG.md

## О файле

Реестр изменений, выполненных командой AI-агентов opencode в рамках оркестрированных сессий. Ведётся оркестратором. Не путать с автогенерируемым файлом `CHANGELOG.md` в корне.

---

## 2026-07-15

### Задача 1: Расчёты в коде вместо LLM
**Исполнитель:** agent logic
**Мотивация:** Переместить численные расчёты (overall_score, средние периода, executionQuality) с модели в серверный код для стабильности и прозрачности.

**Изменённые файлы:**
- `lib/prompts/forecast.ts`
- `lib/anthropic.ts`
- `lib/prompts/period.ts`
- `tests/lib/prompts/forecast.test.ts` (новый)
- `tests/lib/prompts/period.test.ts` (новый)

**Суть:**
- **forecast.ts:** исправлен баг `join('\\n')` (литеральные \n в промпте); из JSON-ответа убраны числовые поля executionQuality — числа рассчитываются сервером функцией `calculateExecutionQuality()`, мерж через `mergeExecutionQuality()`.
- **anthropic.ts:** overall_score оценки дня теперь считается сервером (`calculateOverallScore()` — среднее 5 скоров), значение модели игнорируется; dreamProgressScore/overallScore периода пересчитываются через `calculatePeriodAverages()`.
- **period.ts:** средние показатели рассчитываются в коде и вставляются в промпт готовым блоком; выровнены поля strategyAvg/operationsAvg/teamAvg с фронтом; убраны требования анализировать отсутствующие данные (план/факт, нетворкинг).

**Итог проверок:** typecheck 0 ошибок, lint 0 ошибок, тесты 73/73 ✓

---

### Задача 2: Качество промпта оценки дня
**Исполнитель:** agent scenario
**Мотивация:** Повысить консистентность оценок дня через калибровочные примеры и уточнение тона, устранить конфликты флагов.

**Изменённые файлы:**
- `lib/prompts/daily.ts`
- `lib/prompts/types.ts`
- `lib/prompts/core.ts`

**Суть:**
- **daily.ts:** сквозная нумерация инструкций 1-13; устранён конфликт тона (прямота без штампа «день потрачен впустую»); добавлен блок «КАЛИБРОВОЧНЫЕ ПРИМЕРЫ» (3 эталонных дня со скорами) для стабильности оценок; вывод про overall_score уточнен.
- **types.ts:** BalanceFlags переведён на английские значения: `'ok'|'warning'|'critical'`.
- **core.ts:** fallback-ответы NO_DREAM_RESPONSE/getNoGoalsResponse исправлены с русских значений флагов на английские (исправлен баг: русские значения ломали подсчёт fuelLevel в `app/api/progress/route.ts`).

**Итог проверок:** typecheck 0 ошибок, lint 0 ошибок, тесты 73/73 ✓

---

### Задача 3: Двухуровневый выбор модели
**Исполнитель:** agent backend
**Мотивация:** Оптимизировать затраты на AI: сложные задачи (декомпозиция, анализ периода, прогноз) — SMART-модель, простые/частые (оценка дня, чат, check-plan) — FAST-модель.

**Изменённые файлы:**
- `lib/anthropic.ts`
- `lib/prompts/insights.ts` (новый)
- `.env.example`
- `.env.production.example`
- `docs/ARCHITECTURE.md`
- `tests/lib/prompts/insights.test.ts` (новый)

**Суть:**
- **anthropic.ts:** Новые функции `getAiModel('smart'|'fast')`, `getSmartModel()`, `getFastModel()`; fallback-цепочки:
  - SMART: `AI_MODEL_SMART` → `AI_MODEL` → `'claude-sonnet-4-6'`
  - FAST: `AI_MODEL_FAST` → `AI_MODEL` → `'claude-haiku-4-5'`
  - Обратная совместимость: если только `AI_MODEL` — оба уровня используют его. Удалены старые экспорты DEFAULT_AI_MODEL/DEFAULT_ROUTE_AI_MODEL.
- **Маппинг моделей по задачам:**
  - SMART: goals/decompose (оба вызова), evaluatePeriodWithUsage, generateForecastWithUsage
  - FAST: evaluateDayNewWithUsage, daily/chat, daily/check-plan, updateUserInsights
- **insights.ts** (новый): перенесён UPDATE_INSIGHTS_PROMPT + buildUpdateInsightsPrompt (устранено нарушение конвенции «промпты только в lib/prompts/»).
- **.env.example, .env.production.example:** добавлены переменные `AI_MODEL_SMART`, `AI_MODEL_FAST`.
- **ARCHITECTURE.md:** раздел про AI Integration обновлён с описанием двухуровневой модели, server-side расчётов, калибровочных примеров.

**Итог проверок:** typecheck 0 ошибок, lint 0 ошибок, тесты 73/73 ✓

---

## Итоговые метрики по сессии

| Метрика | Значение |
|---------|----------|
| Исправленные файлы | 15 |
| Новые файлы | 4 |
| Type errors | 0 |
| Lint warnings (новых) | 0 |
| Тесты | 73/73 ✓ |
| Дата закрытия | 2026-07-15 |
