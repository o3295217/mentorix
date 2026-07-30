# AGENTS.md — контекст проекта для агентов

AI Effectiveness Assistant («mentorix») — персональный ассистент продуктивности:
цели → ежедневное планирование → AI-оценка дня → аналитика. UI на русском языке.

> **Впервые в проекте — читай `docs/CODEBASE_MAP.md`.** Там карта данных, API, AI-слоя
> и фронтенда по факту кода, а также список мест, где реальность расходится с правилами
> ниже. Этот файл — краткие правила, тот — подробная карта.

## Стек

- Next.js 16 (App Router, `output: standalone`) + React 19 + TypeScript (strict)
- PostgreSQL + Prisma 5.22 (`prisma/schema.prisma`)
- Tailwind 3 (`darkMode: class`, кастомные классы в `app/globals.css`). Тема жёстко тёмная: `ThemeProvider` — заглушка, переключения нет, хотя в `SPECIFICATION.md` оно описано
- Zod 4 — валидация **только на сервере** (API routes)
- `@anthropic-ai/sdk` — AI-функции (оценка дня, чаты, прогнозы)
- Vitest (`tests/**/*.test.ts`, environment: node), alias `@/` → корень репо

## Команды проверки (обязательны перед сдачей работы)

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint app components hooks lib
npm run test        # vitest run
```

## Структура

| Путь | Назначение |
|---|---|
| `app/` | страницы App Router; **все page.tsx — client components**, layout.tsx — минимальные server components для Metadata |
| `app/(auth)/` | login, register, forgot/reset-password, verify-email |
| `app/api/` | ~55 REST-обработчиков route.ts по доменам: auth, daily, goals, tasks, evaluate, forecast, chat, profile, habits, analytics |
| `components/` | PascalCase, один файл — один компонент; фичевые подпапки `goals/`, `landing/`, `icons/` |
| `hooks/` | кастомные хуки `useXxx.ts`, barrel `hooks/index.ts`; `hooks/daily/` — контроллер ежедневника |
| `lib/` | серверные модули: auth, prisma, encryption, anthropic, email, rate-limit, api-utils |
| `lib/prompts/` | все AI-промпты (daily, period, forecast, plan-chat, check-plan, goals-decompose...) |
| `prisma/` | схема и миграции |
| `tests/` | зеркалит структуру исходников: `tests/lib/`, `tests/hooks/daily/` |
| `middleware.ts` | Edge-гейт аутентификации (HMAC-проверка cookie, без БД) |
| `scripts/` | миграции данных, бэкапы, cleanup-expired.mjs |
| `docs/` | ARCHITECTURE.md, SPECIFICATION.md, DEPLOY.md, DEVELOPMENT.md |

## Ключевые паттерны

### API route (обязательный шаблон)

1. `const userId = await requireUserId(request)` (`lib/get-user-id.ts`)
2. Rate limit для AI-эндпоинтов: `checkRateLimit(userId, rateLimiters.ai)` → 429 + Retry-After
3. Zod: `Schema.safeParse(body)` → 400 `{ error: 'Validation failed', details }`
4. Проверка владения: `findFirst({ where: { id, userId } })` → 404
5. Всё в try/catch; ошибки — `{ error: string }`, хелперы `ApiErrors.*` в `lib/api-utils.ts`
6. Коды: 400 валидация, 401 auth, 403 не-админ, 404 чужой/отсутствующий ресурс, 429 rate limit, 500 прочее

### Аутентификация

- Opaque session-токены (32 байта), в БД хранится SHA-256-хеш, 30 дней; HMAC-подпись в отдельной cookie для Edge middleware
- bcrypt 12 rounds; lockout после 10 неудач; email-верификация через nodemailer
- Не JWT. Полная проверка сессии — в API routes, middleware только HMAC

### AI-интеграция

- Клиент: `lib/anthropic.ts` — lazy init, официальный Anthropic SDK endpoint напрямую (без proxy/baseURL), retry с backoff на 429/5xx, модель из env `AI_MODEL*`. Worker-код хранится только как отключённый fallback, не подключается к runtime.
- Вход пользователя → `sanitizeUserInput` (анти prompt-injection, `lib/api-utils.ts`)
- Ответ AI → `extractJsonFromAIResponse` + типовые валидаторы
- Учёт токенов/стоимости: `logAIUsage` (`lib/ai-usage.ts`), модель `AIUsage`
- Промпты только в `lib/prompts/`, не инлайнить в routes

### Данные (Prisma)

- Центральная модель `User` (soft-delete через `deletedAt`), каскадные связи
- Иерархия целей: `DreamGoal` → `YearGoal` → `PeriodGoal` + унифицированная `Goal` (parent/children)
- Ежедневник: `DailyEntry` (unique userId+date) → 1:1 `Evaluation`; `OpenTask`, `Habit`
- Шифрование полей: `lib/prisma-encryption.ts` (AES-256-GCM, `ENCRYPTION_KEY`)
- После изменения `schema.prisma`: `npx prisma migrate dev` + обновить `docs/ARCHITECTURE.md`

### Frontend

- Без SWR/react-query/redux: `useState`/`useEffect` + кастомные хуки + Context (`AuthProvider`, `ThemeProvider`)
- Запросы: в новом коде используй `fetchJson<T>()` из `lib/fetch-json.ts` (типизированные ошибки `FetchJsonError`). В существующем коде преобладает сырой `fetch` — это долг, а не образец для копирования (см. `docs/CODEBASE_MAP.md`, раздел 8)
- Формы: контролируемые useState + строки `error`/`loading`; клиентского zod нет
- Стили: Tailwind-утилиты + готовые классы из `globals.css` (`.card`, `.btn-primary`); графики — recharts (только `app/analytics/`)
- Тексты UI — на русском; идентификаторы — на английском

## Конвенции

- Комментарии и доки допустимы на русском, код — английский
- Тесты: `describe/it`, `vi.stubEnv` + `afterEach(vi.unstubAllEnvs)`, импорты `@/lib/...`
- ESLint: `no-explicit-any` warn (не плодить новые), `rules-of-hooks` error
- `PROJECT_STATUS.md` и `CHANGELOG.md` генерируются хуками git — руками не редактировать
- При изменении API routes / schema.prisma / промптов — обновить `docs/ARCHITECTURE.md` и при необходимости `.env.example`

## Проверка фактов: отрицательный результат ничего не доказывает

Пустой результат поиска означает одно из двух: искомого нет **или** неправильным был сам поиск.
Различить это можно только контрольным поиском. Пока он не сделан, пиши «не нашёл», а не «нет» —
это разные утверждения, и второе требует доказательства.

**Контрольный поиск.** Прежде чем заявить, что чего-то нет, выполни тот же поиск по тому, что
заведомо есть. Контроль не сработал — сломан инструмент или шаблон, а не кодовая база.

Откуда берутся ложные «ничего не найдено»:

- **У сущности несколько имён.** Модель Prisma `AIUsage` → свойство клиента `aIUsage` (Prisma
  понижает регистр только первой буквы) → функции-обёртки `getUserAIStats`. Поиск по имени
  модели не найдёт вызов функции, и наоборот. Перечисли все имена, под которыми вещь может
  встретиться, и проверь каждое.
- **Регистр.** При проверке отсутствия ищи регистронезависимо.
- **Проглоченная ошибка.** `cmd | wc -l` возвращает статус `wc`, а не `cmd`. Если бинарника нет
  (например, `rg` не установлен в песочнице), вывод будет `0` — неотличимо от «не найдено».
  Проверяя отсутствие, не прячь поиск за пайп и смотри на код возврата.
- **Срезано фильтром.** `--include`, ограничение каталогом, исключение `node_modules` легко
  отрезают ровно то место, где искомое лежит.

**Посчитанное не равно тому, что считали.** `ls dir | wc -l` даёт число записей, а не число
сущностей: в `prisma/migrations` это 28 каталогов миграций плюс `migration_lock.toml`, то есть
29 записей и 28 миграций. Прежде чем назвать число, посмотри, из чего оно состоит.

**Grep находит, Read доказывает.** Утверждение о содержимом файла делается после чтения файла,
а не после совпадения по шаблону.

## Журнал разработки (dev-log)

- `docs/dev-log/<YYYY-MM>.md` — **факты** выполнения задач субагентами (кто/что/когда/статус). Пишется автоматически глобальным плагином `dev-log-writer`, руками эти таблицы не редактировать.
- `docs/DECISIONS.md` — **причины** нетривиальных решений (что решили, почему, что отвергли, ссылки на файлы/коммит). Дописывается вручную (lead) — плагин «почему» не знает by design.
- Правило: нетривиальное решение (новый API/контракт, смена архитектуры/зависимости, auth/шифрование/миграции, отклонённая альтернатива) без записи в `docs/DECISIONS.md` — задача не считается завершённой.

## Продакшен (для контекста)

Docker (3-stage, non-root, read-only fs) + docker-compose (postgres 16, app, backup) на Contabo;
production единственный: `https://mentorix.aionlab.ru`, SSH `ssh contabo`, путь `/home/oleg/ai-assistant-spec`. Anthropic и Telegram вызываются напрямую; Cloudflare/Wrangler/Workers в production-деплое не используются. `cloudflare-proxy/` и `cloudflare-tg-proxy/` сохранены как dormant fallback с `WORKER_ENABLED="false"` и fail-closed 503; не деплоить без отдельного решения.
