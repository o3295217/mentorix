# План работ по результатам код-ревью

> Дата ревью: 27 марта 2026
> Проект: AI Assistant (assist.labaiion.ru)
> Проверено: ~80 файлов (lib/, API routes, components, hooks, pages, prompts, инфраструктура)

---

## Как читать этот документ

Каждая задача содержит:
- **Что:** описание проблемы
- **Где:** файл(ы) и строки
- **Как исправить:** конкретные шаги
- **Оценка:** примерное время

Задачи сгруппированы по приоритету (P0 → P3). Внутри приоритета — по области.

---

## P0 — Критические (исправить немедленно)

> Проблемы безопасности и потери данных. Каждая из них может привести к компрометации сервера, потере пользовательских данных или финансовым потерям.

### 1. Ротация и вынос Telegram-токена из кода
- **Что:** Токен бота `8008848660:AAH...` захардкожен в двух скриптах и попал в git-историю. Любой с доступом к репозиторию может управлять ботом (перезапуск, пересборка, остановка контейнера).
- **Где:** `scripts/monitor.sh:19`, `scripts/tg-bot.sh:9`
- **Как исправить:**
  1. Отозвать текущий токен через @BotFather → `/revoke`
  2. Получить новый токен
  3. В обоих скриптах заменить хардкод на чтение из файла:
     ```bash
     TG_BOT_TOKEN=$(cat /home/oleg/.tg-bot-token)
     ```
  4. Положить токен в `/home/oleg/.tg-bot-token` на сервере (chmod 600)
  5. Добавить `EnvironmentFile=/home/oleg/.tg-bot-env` в `tg-bot.service`
  6. `TG_CHAT_ID` тоже вынести туда же
- **Оценка:** 20 мин

### 2. Заменить `--accept-data-loss` на миграции
- **Что:** `prisma db push --accept-data-loss` выполняется при каждом старте контейнера. При изменении схемы Prisma может молча удалить столбцы/таблицы с данными.
- **Где:** `docker-entrypoint.sh:5`
- **Как исправить:**
  1. Перейти на Prisma Migrate: `npx prisma migrate dev --name init` (локально)
  2. Заменить в `docker-entrypoint.sh`:
     ```bash
     node ./node_modules/prisma/build/index.js migrate deploy 2>&1
     ```
  3. Скопировать папку `prisma/migrations/` на сервер через rsync
  4. Протестировать на локальном Docker
- **Оценка:** 40 мин

### 3. Закрыть Cloudflare Proxy
- **Что:** CORS разрешён для всех (`*`), а если `PROXY_SECRET` не задан — авторизация полностью пропускается. Любой сайт может использовать ваш прокси за ваш счёт Anthropic API.
- **Где:** `cloudflare-proxy/wrangler.toml:18`, `cloudflare-proxy/src/index.js:50`
- **Как исправить:**
  1. В `wrangler.toml` заменить `ALLOWED_ORIGINS = "*"` на `ALLOWED_ORIGINS = "https://assist.labaiion.ru"`
  2. В `src/index.js` сделать fail-closed:
     ```javascript
     if (!env.PROXY_SECRET) {
       return new Response('Proxy not configured', { status: 503 });
     }
     if (proxySecret !== env.PROXY_SECRET) {
       return new Response('Forbidden', { status: 403 });
     }
     ```
  3. Убедиться что `PROXY_SECRET` задан через `wrangler secret put PROXY_SECRET`
  4. Удалить `/debug` эндпоинт или закрыть его авторизацией
  5. `cd cloudflare-proxy && wrangler deploy`
- **Оценка:** 15 мин

### 4. Open Redirect на странице логина
- **Что:** Параметр `redirect` из URL передаётся в `router.push()` без проверки. Атакующий может создать ссылку `/login?redirect=https://evil.com` для фишинга.
- **Где:** `app/(auth)/login/page.tsx:10,45`
- **Как исправить:**
  ```typescript
  const raw = searchParams.get('redirect') || '/'
  const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  ```
- **Оценка:** 5 мин

### 5. Хеширование сессионных токенов в БД
- **Что:** Сессионные токены хранятся в БД открытым текстом. При утечке БД все активные сессии скомпрометированы.
- **Где:** `lib/auth.ts:271,300` (findUnique/delete по `token`)
- **Как исправить:**
  1. Добавить утилиту `hashToken(token: string): string` с SHA-256
  2. При создании сессии сохранять `hashToken(token)` в БД
  3. При проверке сессии искать по `hashToken(token)`
  4. При удалении — аналогично
  5. Одноразовая миграция: инвалидировать все текущие сессии (пользователи перелогинятся)
- **Оценка:** 30 мин

### 6. Timing-safe сравнение legacy-пароля
- **Что:** Сравнение SHA-256 хеша через `!==` уязвимо к timing attack.
- **Где:** `lib/auth.ts:49`
- **Как исправить:**
  ```typescript
  import { timingSafeEqual } from 'crypto'
  const isMatch = timingSafeEqual(Buffer.from(legacyHash), Buffer.from(hash))
  ```
- **Оценка:** 5 мин

### 7. Валидация `role` в chat messages (prompt injection)
- **Что:** Поле `role` принимается от клиента без проверки. Атакующий может вставить `system`-сообщения в историю чата.
- **Где:** `app/api/daily/chat/messages/route.ts:39-66`
- **Как исправить:**
  ```typescript
  const allowedRoles = ['user', 'assistant']
  const validMessages = messages.filter(m => allowedRoles.includes(m.role))
  ```
- **Оценка:** 5 мин

---

## P1 — Высокие (исправить на этой неделе)

### 8. Добавить Zod-валидацию в API-роуты без неё
- **Что:** ~10 API-роутов принимают raw JSON без проверки типов и размеров. Позволяет записать в БД произвольные данные (например, `streak: 999999`).
- **Где:**
  - `app/api/habits/route.ts` (PUT) — streak, bestStreak, totalDone
  - `app/api/profile/insights/route.ts` (PUT) — patterns, evaluationCount
  - `app/api/goals/tags/route.ts` (POST) — name, color
  - `app/api/goals/items/route.ts` (POST) — text, periodType, priority
  - `app/api/chat/route.ts` (POST) — messages array
  - `app/api/profile/route.ts` (POST) — все поля профиля
  - `app/api/goals/planning-profile/route.ts` (POST)
  - `app/api/profile/blocks/route.ts` (PATCH) — order
  - `app/api/profile/categories/route.ts` (PATCH) — order
  - `app/api/profile/items/route.ts` (PATCH) — order
- **Как исправить:** Для каждого роута создать Zod-схему с `.max()` на строки, `.int().min(0)` на числа, `.enum()` на допустимые значения. Пример:
  ```typescript
  const HabitUpdateSchema = z.object({
    id: z.number().int().positive(),
    taskText: z.string().min(1).max(500),
    frequency: z.enum(['daily', 'weekdays', 'custom']),
    streak: z.number().int().min(0).max(9999).optional(),
    // ...
  })
  ```
- **Оценка:** 2 часа

### 9. Rate limiting на AI-эндпоинтах
- **Что:** 3 эндпоинта вызывают Claude API без ограничений. Атакующий может быстро исчерпать бюджет API.
- **Где:**
  - `app/api/evaluate-period/route.ts`
  - `app/api/forecast/route.ts`
  - `app/api/goals/decompose/route.ts`
- **Как исправить:** Добавить в начало каждого хэндлера:
  ```typescript
  const rateLimit = checkRateLimit(userId, rateLimiters.ai)
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    )
  }
  ```
- **Оценка:** 15 мин

### 10. Rate limiting на auth-эндпоинтах
- **Что:** `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password` — публичные без ограничений. Уязвимость к brute-force.
- **Где:** `app/api/auth/login/route.ts`, `register/route.ts`, `forgot-password/route.ts`
- **Как исправить:** Добавить rate limiter по IP (более жёсткий, чем для AI):
  ```typescript
  // В lib/rate-limit.ts
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 } // 10 попыток за 15 мин
  ```
- **Оценка:** 20 мин

### 11. Ограничение размера входных данных в AI-чате
- **Что:** Нет `.max()` на `userMessage`, `messages[]`, `planTasks[]`. Можно создать гигантский промпт.
- **Где:** `app/api/daily/chat/route.ts:20-30`
- **Как исправить:**
  ```typescript
  const ChatSchema = z.object({
    userMessage: z.string().max(5000),
    messages: z.array(...).max(50),
    planTasks: z.array(z.string().max(500)).max(30),
    completedTasks: z.array(z.string().max(500)).max(30),
    // ...
  })
  ```
- **Оценка:** 10 мин

### 12. Убрать логирование пользовательских данных
- **Что:** Задачи и сообщения пользователей попадают в Docker logs.
- **Где:** `app/api/daily/chat/route.ts:262-264`, аналогично в evaluate и других AI-роутах
- **Как исправить:** Заменить на обезличенное логирование:
  ```typescript
  console.log(`[Plan Chat] Date: ${date}, Tasks: ${planTasks.length}, History: ${messages.length}`)
  // Убрать: console.log(`[Plan Chat] Task list: ${planTasks.join(' | ')}...`)
  ```
- **Оценка:** 15 мин

### 13. Исправить разную длину пароля (register vs reset)
- **Что:** Регистрация требует 8 символов, сброс пароля — 6.
- **Где:** `app/(auth)/register/page.tsx:31`, `app/(auth)/reset-password/page.tsx:56`
- **Как исправить:** В reset-password заменить `< 6` на `< 8`. Вынести константу `MIN_PASSWORD_LENGTH = 8`.
- **Оценка:** 5 мин

### 14. Email enumeration при регистрации
- **Что:** Ответ `USER_EXISTS` позволяет проверить, зарегистрирован ли email.
- **Где:** `app/api/auth/register/route.ts:92-98`
- **Как исправить:** Возвращать одинаковый ответ при дубликате:
  ```typescript
  // Вместо { error: 'USER_EXISTS' }
  return NextResponse.json({ success: true, message: 'Проверьте почту для подтверждения' })
  ```
- **Оценка:** 10 мин

### 15. Добавить security headers
- **Что:** Нет CSP, X-Frame-Options, HSTS, Referrer-Policy.
- **Где:** `next.config.js`
- **Как исправить:** Добавить в `next.config.js`:
  ```javascript
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  }
  ```
- **Оценка:** 15 мин

### 16. `JSON.parse` без try/catch в render-пути
- **Что:** Битые данные в БД крашат целые страницы.
- **Где:**
  - `app/history/page.tsx:354`
  - `app/periods/[id]/page.tsx:77-84`
  - `lib/user-stats.ts:107-108,353-354`
  - `app/api/facts/summary/route.ts:22-24`
- **Как исправить:** Использовать `safeParseJson` из `lib/api-utils.ts` (он уже существует) вместо голого `JSON.parse`.
- **Оценка:** 20 мин

### 17. AuthProvider — потенциальный redirect loop
- **Что:** `checkAuth` зависит от `pathname`, пересоздаётся при каждой навигации, вызывая лишние запросы к `/api/auth/me` и возможные циклы редиректов.
- **Где:** `components/AuthProvider.tsx:43-88`
- **Как исправить:** Убрать `pathname` из зависимостей `useCallback`. Использовать `window.location.pathname` внутри тела функции или проверять маршрут отдельным эффектом.
- **Оценка:** 20 мин

### 18. `git add -A` в deploy-скрипте
- **Что:** Может случайно закоммитить секреты.
- **Где:** `deploy/deploy-contabo.sh` (исторически — старый deploy-скрипт)
- **Как исправить:** Заменить на `git add -u` (только отслеживаемые файлы) или убрать авто-коммит из деплой-скрипта.
- **Оценка:** 5 мин

---

## P2 — Средние (исправить в ближайшие 2 недели)

### 19. Вынести AI-модель в env-переменную
- **Что:** `claude-sonnet-4-20250514` захардкожена в ~5 файлах. Обновление модели требует пересборки Docker.
- **Где:** `app/api/daily/chat/route.ts:309`, `evaluate/route.ts`, `check-plan/route.ts`, `forecast/route.ts`, `lib/anthropic.ts`
- **Как исправить:** Добавить `AI_MODEL=claude-sonnet-4-20250514` в `.env.production`, читать через `process.env.AI_MODEL`.
- **Оценка:** 15 мин

### 20. Добавить пагинацию в API
- **Что:** Несколько эндпоинтов возвращают все записи без лимита.
- **Где:**
  - `app/api/tasks/closed/route.ts` — все закрытые задачи
  - `app/api/periods/route.ts` — все оценки периодов
  - `app/api/daily/route.ts` — все записи (когда без параметров)
  - `app/api/goals/items/route.ts` — все цели
- **Как исправить:** Добавить `?limit=50&offset=0` с максимумом `limit=100`.
- **Оценка:** 1 час

### 21. Очистка просроченных сессий и токенов
- **Что:** Таблицы `sessions`, `password_reset_tokens`, `email_verification_tokens` растут бесконечно.
- **Как исправить:** Добавить cron-задачу (ежедневно):
  ```sql
  DELETE FROM sessions WHERE "expiresAt" < NOW();
  DELETE FROM password_reset_tokens WHERE "expiresAt" < NOW();
  DELETE FROM email_verification_tokens WHERE "expiresAt" < NOW();
  ```
- **Оценка:** 20 мин

### 22. ~~Исправить hardcoded «5 лет» в промптах~~ ✅
- **Что:** В промптах написано «МЕЧТА ПОЛЬЗОВАТЕЛЯ (5 лет)» вместо реального горизонта.
- **Где:** `lib/prompts/daily.ts`, `lib/prompts/period.ts`, `lib/prompts/core.ts`
- **Исправлено:** Добавлен `getDreamHorizonLabel()` в `core.ts`, используется в daily/period промптах. Хардкод убран из документации (README, SPECIFICATION, USER_GUIDE).
- **Оценка:** 15 мин

### 23. Исправить `NO_DREAM_RESPONSE` — score 0 и ложные флаги
- **Что:** Score `0` выходит за диапазон `[1, 10]`. Флаги баланса «критично» загрязняют статистику.
- **Где:** `lib/prompts/core.ts:87-106`
- **Как исправить:** Установить scores в `1`, убрать ложные флаги баланса (заменить на `null`).
- **Оценка:** 10 мин

### 24. Исправить `isStaticPath` — обход авторизации через точку в URL
- **Что:** `pathname.includes('.')` пропускает авторизацию для путей вроде `/api/secret.path`.
- **Где:** `middleware.ts:41`
- **Как исправить:**
  ```typescript
  function isStaticPath(pathname: string): boolean {
    return pathname.startsWith('/_next') || pathname.startsWith('/favicon')
  }
  ```
- **Оценка:** 5 мин

### 25. Race condition в evaluate flow
- **Что:** Решения по незавершённым задачам отправляются, но оценка вызывается не дожидаясь ответа.
- **Где:** `app/daily/page.tsx:210-233`
- **Как исправить:** Дождаться ответа decisions API перед вызовом `evaluate()`:
  ```typescript
  const res = await fetch('/api/tasks/process-uncompleted', ...)
  if (res.ok) {
    evaluate(router)
  }
  ```
- **Оценка:** 10 мин

### 26. Race condition в user-stats (findFirst + update vs upsert)
- **Что:** Параллельные вызовы могут создать дубликаты UserStats.
- **Где:** `lib/user-stats.ts:291-339`
- **Как исправить:** Заменить `findFirst` + условный `create`/`update` на `prisma.userStats.upsert()`.
- **Оценка:** 15 мин

### 27. Stale closure в `sendChatMessage`
- **Что:** AI получает историю чата без последнего сообщения пользователя.
- **Где:** `hooks/useDaily.ts:1066-1128`
- **Как исправить:** Передавать `updatedMessages` (после `setChatMessages`) в тело запроса, а не `chatMessages` из замыкания.
- **Оценка:** 10 мин

### 28. Убрать `set -e` из monitor.sh
- **Что:** Мониторинг не должен падать при ошибке одной проверки.
- **Где:** `scripts/monitor.sh:8`
- **Как исправить:** Убрать `set -e`, каждая проверка и так обрабатывает ошибки через `|| true`.
- **Оценка:** 2 мин

### 29. Шифрование бэкапов
- **Что:** Бэкапы gzip без шифрования. Доступ к директории = все данные.
- **Где:** `scripts/prod-backup.sh`
- **Как исправить:** Добавить gpg-шифрование:
  ```bash
  pg_dump ... | gzip | gpg --symmetric --cipher-algo AES256 --passphrase-file /home/oleg/.backup-key > "$BACKUP_FILE.gpg"
  ```
- **Оценка:** 15 мин

### 30. Goals page — 25+ API-вызовов
- **Что:** Каскад useEffect создаёт лавину запросов.
- **Где:** `app/goals/page.tsx:101-123`
- **Как исправить:** Создать один API `/api/goals/context?year=2026` который вернёт все данные разом (year goals + period goals + tracked goals + tags).
- **Оценка:** 2 часа

### 31. Дублирование `getTaskCategory` / `getTaskType`
- **Что:** Идентичная логика в двух файлах.
- **Где:** `lib/completed-work.ts:6-27`, `lib/user-stats.ts:25-49`
- **Как исправить:** Вынести в общий `lib/task-utils.ts`, импортировать в оба файла.
- **Оценка:** 15 мин

### 32. Дублирование контекста пользователя в AI-роутах
- **Что:** Загрузка dream/goals/profile/insights копипастится между 4+ роутами.
- **Где:** `daily/chat/route.ts`, `evaluate/route.ts`, `check-plan/route.ts`, `forecast/route.ts`
- **Как исправить:** Создать `lib/user-context.ts` с функцией `getUserAIContext(userId, date)`.
- **Оценка:** 1.5 часа

---

## P3 — Низкие (backlog, исправить при возможности)

### 33. JSON-поля как String вместо Json типа Prisma
- **Где:** `prisma/schema.prisma` — `goalsJson`, `selectedTasksJson`, `tagsJson`, etc.
- **Как:** Заменить `String` на `Json` поэтапно (требует миграцию данных).
- **Оценка:** 2 часа

### 34. Добавить `.dockerignore`
- **Как:** Создать файл `.dockerignore`:
  ```
  .git
  .env*
  node_modules
  backups
  keys
  logs
  *.md
  ```
- **Оценка:** 5 мин

### 35. Добавить Error Boundary
- **Где:** `app/layout.tsx`
- **Как:** Создать `app/error.tsx` и `app/global-error.tsx` (Next.js conventions).
- **Оценка:** 30 мин

### 36. Заменить `alert()` на toast-уведомления
- **Где:** `app/forecast/page.tsx`, `app/periods/page.tsx`, `hooks/useForecast.ts`
- **Оценка:** 30 мин

### 37. Исправить пустые иконки в BalanceFlags
- **Где:** `components/BalanceFlags.tsx:18-29`
- **Оценка:** 10 мин

### 38. Исправить склонение «лет» в ProgressIndicator
- **Где:** `components/ProgressIndicator.tsx:41`
- **Как:** Использовать `pluralizeYears()` из `Speedometer.tsx`.
- **Оценка:** 5 мин

### 39. Мёртвый код `getWeekNumber`
- **Где:** `app/api/daily/chat/route.ts:40-49`
- **Оценка:** 2 мин

### 40. `@types/nodemailer` → devDependencies
- **Где:** `package.json:18`
- **Оценка:** 2 мин

### 41. Настроить ESLint с `eslint-config-next`
- **Где:** `eslint.config.mjs`
- **Оценка:** 15 мин

### 42. Next.js font optimization вместо Google Fonts link
- **Где:** `app/layout.tsx`
- **Оценка:** 15 мин

### 43. Добавить ресурсные лимиты в `tg-bot.service`
- **Как:** `MemoryMax=256M`, `CPUQuota=25%`
- **Оценка:** 5 мин

### 44. `today` на главной устаревает после полуночи
- **Где:** `app/page.tsx:100`
- **Как:** Добавить интервал обновления или проверку при возврате на вкладку.
- **Оценка:** 10 мин

---

## Сводка по времени

| Приоритет | Задач | Оценка |
|-----------|-------|--------|
| P0 (Critical) | 7 | ~2 часа |
| P1 (High) | 11 | ~5 часов |
| P2 (Medium) | 14 | ~7 часов |
| P3 (Low) | 12 | ~3 часа |
| **Итого** | **44** | **~17 часов** |

## Рекомендуемый порядок работы

**День 1:** P0 целиком (задачи 1–7) — ~2 часа
**День 2:** P1 безопасность (задачи 8–15) — ~4 часа
**День 3:** P1 остальное + P2 быстрые (задачи 16–18, 19, 22–24, 28) — ~3 часа
**День 4:** P2 средние (задачи 20–21, 25–27, 29, 31–32) — ~4 часа
**День 5:** P2 крупные + P3 (задачи 30, 33–44) — ~4 часа
