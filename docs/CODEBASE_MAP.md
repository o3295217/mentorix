# Карта кодовой базы

Единая точка входа для разработчика или агента, впервые открывающего проект.
Составлена 2026-07-29 по факту кода, а не по замыслу. Где факт расходится с прежней
документацией — здесь зафиксирован факт.

Связанные документы:

| Файл | Назначение |
|---|---|
| `AGENTS.md` | краткие правила работы агента, читается автоматически |
| `docs/ARCHITECTURE.md` | подробная архитектура и схема данных |
| `docs/SPECIFICATION.md` | исходное ТЗ; частично устарело, см. раздел «Расхождения» |
| `docs/USER_GUIDE.md` | продуктовые сценарии глазами пользователя |
| `docs/DECISIONS.md` | почему приняты нетривиальные решения |
| `docs/DEPLOY.md`, `docs/INFRASTRUCTURE.md` | production |
| `docs/dev-log/<YYYY-MM>.md` | факты выполнения задач субагентами (пишется плагином) |

---

## 1. Что это за продукт

Персональный ассистент продуктивности. Пользователь ведёт иерархию целей, каждый день
собирает план, отмечает выполнение, вечером по желанию запрашивает AI-оценку дня.
Накопленные оценки формируют профиль понимания пользователя, который подставляется
обратно в планирование. Интерфейс на русском, продукт называется **mentorix**.

**Цикл дня полностью управляется пользователем.** Ничего не запускается автоматически:

1. Утро — открыть «План дня», свериться с целями недели и месяца, собрать задачи,
   при желании обсудить план в чате с ассистентом.
2. День — отмечать выполненное.
3. Вечер — закрыть незавершённые задачи через модальное окно и **вручную запросить оценку дня**.
4. Неделя/месяц — периодические оценки, прогресс, аналитика, прогнозы.

Из этого следует важное: дни без оценки — норма, а не дефект. Глубина памяти ассистента
зависит от того, сколько раз пользователь запросил оценку.

---

## 2. Стек и команды

- Next.js 16 (App Router, `output: standalone`) + React 19 + TypeScript strict
- PostgreSQL + Prisma 5.22
- Tailwind 3, кастомные классы в `app/globals.css`
- Zod 4 — валидация только на сервере
- `@anthropic-ai/sdk` — AI-функции
- Vitest, alias `@/` → корень репозитория

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint app components hooks lib
npm run test        # vitest run
```

Масштаб: 55 API-роутов, 18 страниц, 39 файлов в `components/`, 52 модуля в `lib/`,
28 файлов в `hooks/`, 48 тестовых файлов, 29 моделей Prisma, 29 миграций.

---

## 3. Данные

### Центральные сущности

`User` — корень почти всех связей, удаление каскадное. Soft-delete реализован **только
для `User`**: middleware `lib/prisma-user-soft-delete.ts` подменяет `delete`/`deleteMany`
на проставление `isActive: false` и `deletedAt`.

Иерархия целей двойная и сосуществует:

- историческая: `DreamGoal` → `YearGoal` → `PeriodGoal`;
- унифицированная: `Goal` с самоссылкой `parentId` (`onDelete: SetNull`).

Ежедневник: `DailyEntry` (уникум по `[userId, date]`) → `DailySchedule` 1:1,
`Evaluation` 1:1. Плюс `OpenTask`, `Habit`, `CompletedWork`, `WorkSummary`, `ChatMessage`.

Память об ассистенте: `UserInsights` (одна запись на пользователя) и `InsightEntry`
(много записей-наблюдений).

`AuditLog` и `AIUsage` держат `userId` **без Prisma-связи** с `User` — каскадного
удаления у них нет, это осознанно.

### Шифрование

`lib/encryption.ts` (AES-256-GCM, ключ в `ENCRYPTION_KEY`) + middleware
`lib/prisma-encryption.ts`, подключённый в `lib/prisma.ts`. Шифруется практически
весь пользовательский контент: тексты целей, планы и факты дня, состояния и контекст дня,
все текстовые блоки оценок, задачи, профиль, привычки, наблюдения, сообщения чата.

Отдельный список `ENCRYPTED_JSON_FIELDS` — поля, которые шифруются как JSON:
`YearGoal.goalsJson`, `PeriodGoal.goalsJson`, `Goal.historyJson`,
`DailyEntry.planSnapshotJson` / `extraTasksJson` / `selectedTasksJson`,
`DailySchedule.scheduleJson`, `Evaluation.suggestedTasksJson`,
`WorkSummary.keyAchievements`, `ChatMessage.metadataJson`.

После изменения `schema.prisma` обязательны `npx prisma migrate dev` и обновление
`docs/ARCHITECTURE.md`.

---

## 4. Аутентификация

**JWT не используется.** Схема двухслойная.

**Сессии** (`lib/auth.ts`): opaque-токен 32 байта, наружу отдаётся hex, в БД лежит
SHA-256-хеш (`Session.token` уникален), срок 30 дней. Пароли — bcrypt, 12 раундов,
есть прозрачная миграция legacy SHA-256-хешей. Блокировка после серии неудачных входов
через `lib/rate-limit.ts`.

**Две cookie:** `auth_token` и `auth_token_sig` — HMAC-SHA256-подпись токена
(`lib/hmac.ts`).

**`middleware.ts` работает на Edge и в БД не ходит.** Он проверяет только наличие обеих
cookie и корректность HMAC-подписи. Он **не проверяет** срок сессии, `isActive` и
`deletedAt` — это by design, ради скорости Edge.

**Полная проверка — в API-роутах** через `requireUserId` (`lib/get-user-id.ts`) →
`requireAuth` → `validateSession`: поиск сессии по хешу, проверка срока, проверка
активности пользователя.

Публичные пути (мимо middleware): `/`, страницы авторизации, `/api/auth/*` кроме `me` и
`onboarding`, `/api/health`.

При `AUTH_ENABLED=false` middleware пропускает всё, а `requireUserId` возвращает
`local-user` — режим локальной разработки.

---

## 5. API

55 роутов по доменам: `auth`, `daily` (включая `chat`, `schedule`), `goals`, `tasks`,
`evaluate` и `evaluate-period`, `forecast`, `periods`, `profile`, `habits`, `analytics`,
`facts`, `progress`, `chat`, `health`. Полный перечень эндпоинтов — в `docs/ARCHITECTURE.md`.

### Канонический шаблон роута

1. `const userId = await requireUserId(request)`
2. для AI-эндпоинтов — `checkRateLimit(userId, rateLimiters.ai)` → 429 с `Retry-After`
3. `Schema.safeParse(body)` → 400 `{ error: 'Validation failed', details }`
4. проверка владения `findFirst({ where: { id, userId } })` → 404
5. всё в `try/catch`, ошибки через `ApiErrors.*` из `lib/api-utils.ts`
6. коды: 400 валидация, 401 auth, 403 не-админ, 404 чужой или отсутствующий ресурс,
   429 rate limit, 500 прочее

### Где шаблон фактически нарушен

Это не список задач, а предупреждение: не копируй эти места как образец.

- **Все auth-роуты** валидируют тело вручную, без zod. Это осознанно для публичных
  эндпоинтов, но отличается от шаблона.
- `/api/auth/me` использует `getAuthUser`, `/api/auth/onboarding` — `getUserId`,
  оба не `requireUserId`.
- `/api/daily/chat/messages` — `requireUserId` вызывается **вне** `try/catch` во всех
  трёх методах.
- Проверка владения без `findFirst` и без явного 404: `/api/profile/blocks` (DELETE, PATCH),
  `/api/goals/tags` (DELETE) — удаление и обновление идут напрямую с `userId` в `where`.
- `/api/profile/theme` POST возвращает успех даже когда пользователь не найден.
- `ApiErrors.*` применяется только в 6 роутах из 55: `daily/schedule`,
  `daily/schedule/apply-proposal`, `evaluate`, `evaluate/batch`, `evaluate-period`, `forecast`.
- `/api/health` без `try/catch`.

---

## 6. AI-слой

### Клиент и модели

`lib/anthropic.ts` — ленивая инициализация, официальный endpoint Anthropic напрямую,
без proxy. `maxRetries: 2`, таймаут 5 минут, поверх — собственный retry с экспоненциальной
задержкой и джиттером на 429, 5xx и сетевые ошибки, с уведомлением в Telegram при
финальном провале.

Два уровня моделей, выбираются `getAiModel(tier)`:

- **smart** — сложное рассуждение: декомпозиция целей, оценка периода, прогноз.
  По умолчанию `claude-sonnet-4-6`.
- **fast** — частые задачи: оценка дня, чат плана, проверка плана, обновление insights.
  По умолчанию `claude-haiku-4-5`.

Приоритет: `AI_MODEL_SMART` / `AI_MODEL_FAST` → `AI_MODEL` → значение по умолчанию.

### Промпты

Все в `lib/prompts/`, инлайнить промпты в роуты запрещено.

| Файл | Функция продукта |
|---|---|
| `daily.ts` | оценка дня |
| `period.ts` | оценка периода |
| `forecast.ts` | прогноз |
| `check-plan.ts` | проверка реалистичности плана |
| `plan-chat.ts` | чат планирования дня, включая tool `propose_daily_schedule` |
| `goals-decompose.ts` | декомпозиция целей |
| `goals-validate.ts` | валидация целей |
| `insights.ts` | обновление профиля понимания пользователя |
| `core.ts`, `types.ts` | общие хелперы и типы |

### Чат планирования и расписание

Самый сложный узел. Модель вызывает tool `propose_daily_schedule`, ответ проходит
валидацию в `lib/daily-schedule-proposal.ts`. При провале делается **одна** попытка
коррекции с передачей диагностики модели; если и она не проходит — пользователь получает
фолбэк-сообщение из `lib/daily-chat-constants.ts`.

Предложение версии 3 различает задачи существующие (`taskSource: 'existing'`, индекс в
`planTasks`) и новые (`taskSource: 'new'`, индекс внутри `newTasks`). `taskText` обязан
совпадать посимвольно. При конвертации индексы новых задач сдвигаются на количество
существующих — поэтому в метаданных сохраняется `currentPlanTaskCount`, иначе при чтении
на следующем ходе индексы разъезжаются (см. `docs/DECISIONS.md`, запись от 2026-07-29).

### Память о пользователе

После оценки дня вызывается `updateUserInsights`. Он получает текущий профиль, план и факт
дня, обратную связь оценки, данные за последние 7 дней и кэш наблюдений, а возвращает
обновлённый профиль и 2-5 новых записей `InsightEntry`.

`UserInsights` подставляется обратно в контекст чата планирования — это и есть «ассистент
меня помнит». Размер полей **ничем не ограничен** ни в схеме, ни в промпте.

### Учёт расхода

`lib/ai-usage.ts` пишет в `AIUsage`: эндпоинт, модель, входные и выходные токены,
стоимость в центах (`lib/ai-pricing.ts`), длительность, успех, текст ошибки.

**Токены кэша не записываются.** `lib/anthropic.ts` умеет читать `cache_read_input_tokens`
и считать процент экономии, но в БД это не попадает — измерить эффективность кэша по
журналу невозможно.

### Кэширование

`cache_control: { type: 'ephemeral' }` стоит **только на статических системных промптах**
(оценка дня, период, прогноз, чат плана, проверка плана). История сообщений чата
не кэшируется — именно она растёт с каждым ходом и оплачивается полностью.
TTL `ephemeral` — 5 минут.

### Защита ввода

`sanitizeUserInput` (`lib/api-utils.ts`) применяется в промптах `daily.ts` и `insights.ts`,
а из роутов — только в `/api/daily/chat`. В `/api/goals/decompose` пользовательский текст
уходит в модель без очистки.

Ответ модели разбирается через `extractJsonFromAIResponse` с балансировкой скобок и
типовым валидатором. Исключение: `/api/daily/check-plan` парсит ответ регуляркой и
`JSON.parse` в обход общего хелпера.

---

## 7. Фронтенд

### Страницы

18 страниц, **все** `page.tsx` — клиентские компоненты. Все 11 `layout.tsx` — серверные,
минимальные, ради `Metadata`. Исключений нет.

Маршруты: `/` (дашборд или лендинг для гостя), `/onboarding`, `/daily`, `/goals`,
`/tasks`, `/evaluation/[date]`, `/periods` и `/periods/[id]`, `/forecast`, `/history`,
`/progress`, `/profile`, `/analytics`, плюс группа `app/(auth)/`: `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/verify-email`.

### Состояние

Без SWR, react-query и redux — только `useState`, `useEffect`, кастомные хуки и Context.

- `AuthProvider` — `user`, `loading`, `isAuthenticated`, `logout`, `refresh`; сам ходит
  в `/api/auth/me` и `/api/auth/logout`, отвечает за редиректы на логин и онбординг.
- `ThemeProvider` — **заглушка**: всегда возвращает `dark`, `setTheme` и `toggleTheme`
  ничего не делают. Переключения темы в продукте нет.

### Ключевой узел ежедневника

`hooks/daily/useDailyController.ts` (1126 строк) держит почти всю логику страницы дня:
дату и загрузку данных, цели недели и месяца, привычки и предложения привычек, черновик
плана в localStorage, задачи и их редактирование, сохранение плана, проверку плана, чат
с SSE-стримом, применение задач из предложения AI, запуск оценки дня.

Рядом: `useDailySchedule.ts` (630 строк) — расписание и таймлайн, и набор чистых хелперов
в `hooks/daily/` (`schedule-helpers.ts` — 848 строк, `task-helpers`, `chat-helpers`,
`proposal-helpers`, `plan-draft`, `phase-helpers` и другие).

### Стили

Смесь Tailwind-утилит и готовых классов из `app/globals.css`. Основные общие классы:
`.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.textarea`. Плюс доменные группы:
`app-shell*`, `mobile-bottom-nav*`, `daily-*`, `goals-chat-*`, `landing-*`, `onb*`,
`uncompleted-modal-*`, `task-*`.

---

## 8. Технический долг

Зафиксирован по факту на 2026-07-29. Не является планом работ.

**Расхождения документации с кодом**

- `AGENTS.md` утверждает, что запросы идут через `fetchJson<T>()`. Фактически сырой
  `fetch` преобладает: все auth-страницы, `AuthProvider`, `DatePickerWithIndicators`,
  дашборд, аналитика, прогресс, профиль, история, периоды, оценка дня, большинство
  хуков целей и часть `useDailyController`.
- `SPECIFICATION.md` описывает переключение темы light/dark/system, которого в продукте нет.
- `USER_GUIDE.md` не обновлялся с апреля: называет продукт ION и описывает блок
  «Вне плана», удалённый 2026-07-29.

**Архитектурные**

- Дублирующая загрузка одних и тех же эндпоинтов с разных страниц: `/api/goals/dream`,
  `/api/progress`, `/api/profile`, `/api/daily`, `/api/tasks/open`, `/api/facts`,
  `/api/goals/period`. Кеша нет, каждая страница грузит заново.
- Прямые обращения к API из компонентов: `AuthProvider`, `DatePickerWithIndicators`.
- Крупные файлы: `app/daily/page.tsx` — 2384 строки, `useDailyController.ts` — 1126,
  `schedule-helpers.ts` — 848, `DayTimeline.tsx` — 832, `app/tasks/page.tsx` — 1077.

**Надёжность и стоимость**

- `lib/rate-limit.ts` хранит счётчики **в памяти** и обнуляется при рестарте. Для
  защиты от всплеска этого хватает, для суточных квот — нет.
- История чата не кэшируется, входной контекст растёт линейно с длиной диалога.
- Токены кэша не пишутся в `AIUsage`, экономию измерить нечем.
- Размер полей `UserInsights` ничем не ограничен.

**Безопасность**

- `sanitizeUserInput` не применяется в `/api/goals/decompose`.
- Нарушения шаблона роута из раздела 5.

**Мёртвый код**

В `lib/` много экспортов без внешних ссылок, в том числе в `anthropic.ts`
(`evaluateDayNew`, `evaluateDay`, `evaluatePeriod`), `auth.ts` (`logoutAllSessions`,
`cleanupExpiredSessions`, `requireAdmin`, `createInitialAdmin`), `api-utils.ts`
(`validateInputSize`), а также неиспользуемые типы в `prompts/types.ts` и
схемы в `daily-schedule*.ts`. Полный список получен грепом и приведён в отчёте
картирования; перед удалением проверять заново.

---

## 9. Как войти в проект

1. Прочитать `AGENTS.md` — правила работы и конвенции.
2. Прочитать этот файл целиком.
3. Посмотреть `docs/DECISIONS.md` — там причины неочевидных решений, без них легко
   «починить» то, что сделано намеренно.
4. Прогнать `npm run typecheck`, `npm run lint`, `npm run test` и запомнить baseline:
   lint даёт 9 предсуществующих предупреждений `react-hooks/exhaustive-deps`, это норма.
5. Историю смотреть через `git log --oneline`; факты выполнения задач субагентами —
   в `docs/dev-log/<YYYY-MM>.md`, причины решений — в `docs/DECISIONS.md`.
6. `PROJECT_STATUS.md` и `CHANGELOG.md` генерируются git-хуками, руками не редактировать.

Перед изменениями обязательно свериться с разделом 5 (шаблон роута) и разделом 8
(технический долг) — чтобы не скопировать существующее нарушение как образец.
