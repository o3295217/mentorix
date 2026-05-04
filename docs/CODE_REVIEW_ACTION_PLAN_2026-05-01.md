<!-- markdownlint-disable MD013 MD022 -->

# План работ по результатам код-ревью

> Дата ревью: 1 мая 2026
> Проект: AI Assistant (assist.labaiion.ru)
> Предыдущий план: [CODE_REVIEW_ACTION_PLAN.md](./CODE_REVIEW_ACTION_PLAN.md) от 27.03.2026 — закрыт на ~80%
> Этот план содержит **только новые/незакрытые задачи** на текущий момент

---

## Как читать

Задачи отсортированы строго от самой критической вниз. Каждая задача:
- **Что:** суть проблемы
- **Где:** файл(ы) и строки
- **Риск:** что произойдёт, если не исправить
- **Как исправить:** конкретные шаги
- **Оценка:** примерное время

Приоритеты:
- **P0** — критично, риск утечки данных / компрометации / простоя
- **P1** — высоко, риск регрессий, безопасности средней тяжести, устойчивости
- **P2** — средне, технический долг, перформанс, поддерживаемость
- **P3** — низко, улучшения, бэклог

---

## Дополнение Copilot: свежие приоритеты ревью 01.05.2026

Этот блок добавлен поверх существующего плана и не отменяет пункты ниже. Его стоит выполнить **до текущего P0**, потому что здесь собраны риски, подтверждённые свежей проверкой кода, `npm audit --omit=dev`, `npm run typecheck` и `npm run lint`.

### A1. P0 — обновить Next.js и production-зависимости с критичными advisory
- **Что:** `npm audit --omit=dev` показывает критичные уязвимости в production dependency graph, включая Next.js RCE/DoS/source exposure advisory для текущего диапазона, `fast-xml-parser` critical через AWS SDK chain, `lodash` high, `nodemailer` moderate и `postcss` moderate.
- **Где:** [package.json](../package.json), [package-lock.json](../package-lock.json)
- **Риск:** повторная компрометация через framework-level уязвимость, DoS или source exposure. Это особенно важно после уже зафиксированного инцидента с Next.js RCE.
- **Как исправить:**
  1. Обновить Next.js до версии, закрывающей advisory из audit (на момент проверки audit предлагал `next@16.2.4`).
  2. Обновить production-зависимости, которые тянут `fast-xml-parser`, `lodash`, `nodemailer`, `postcss`.
  3. Прогнать `npm run typecheck`, `npm run lint`, `npm run build`, затем повторить `npm audit --omit=dev`.
  4. Перед деплоем проверить auth, daily, goals, evaluate и forecast smoke-сценариями.
- **Оценка:** 1-2 ч + время на регрессионную проверку.

### A2. P0 — включить Secure cookies в production fail-safe режимом
- **Что:** production compose сейчас передаёт `COOKIE_SECURE=false` по умолчанию, а auth cookies выставляются с `secure: process.env.COOKIE_SECURE === 'true'`.
- **Где:** [docker-compose.production.yml](../docker-compose.production.yml), [app/api/auth/login/route.ts](../app/api/auth/login/route.ts), [app/api/auth/register/route.ts](../app/api/auth/register/route.ts), [app/api/auth/verify-email/route.ts](../app/api/auth/verify-email/route.ts)
- **Риск:** при ошибке конфигурации session cookies могут уходить без `Secure`, несмотря на HSTS headers.
- **Как исправить:**
  1. В production compose поставить `COOKIE_SECURE=${COOKIE_SECURE:-true}`.
  2. В коде вынести `useSecureCookie` в общий helper и сделать fail-safe: `NODE_ENV === 'production' || COOKIE_SECURE === 'true'`.
  3. Добавить startup/config check: production без secure cookies должен падать с понятной ошибкой.
- **Оценка:** 30 мин.

### A3. P1 — исправить Prisma audit context
- **Что:** audit middleware хранит request context в глобальной переменной процесса. При параллельных запросах контекст может перетереться, и audit log запишет не того пользователя/IP.
- **Где:** [lib/prisma-audit.ts](../lib/prisma-audit.ts), [lib/auth.ts](../lib/auth.ts)
- **Риск:** недостоверный аудит действий пользователей; расследования инцидентов становятся ненадёжными.
- **Как исправить:**
  1. Заменить глобальный `currentRequestContext` на `AsyncLocalStorage` или явную передачу context в audit-события.
  2. Убрать `require('./prisma')`, который сейчас ломает lint, и избежать циклического импорта через отдельный audit writer/helper.
  3. Добавить тест/ручной сценарий двух параллельных запросов от разных пользователей.
- **Оценка:** 1-2 ч.

### A4. P1 — исправить расшифровку вложенных Prisma relations
- **Что:** encryption middleware пытается определить модель вложенной связи через `capitalize(key)`. Для plural relations (`categories`, `items`, `children`, `sessions` и т.д.) это не работает, поэтому вложенные зашифрованные поля могут вернуться как `enc_v1:...`.
- **Где:** [lib/prisma-encryption.ts](../lib/prisma-encryption.ts), пример потребителя — [app/api/profile/blocks/route.ts](../app/api/profile/blocks/route.ts)
- **Риск:** UI получает ciphertext вместо текста профиля; часть данных кажется повреждённой, хотя в БД всё сохранено.
- **Как исправить:**
  1. Добавить явную карту relation key → Prisma model (`categories` → `ProfileCategory`, `items` → `ProfileItem`, `evaluation` → `Evaluation`, и т.д.).
  2. Рекурсивно расшифровывать массивы вложенных relations по этой карте.
  3. Покрыть тестом `profileBlock.findMany({ include: { categories: { include: { items: true } }, items: true } })`.
- **Оценка:** 1 ч.

### A5. P1 — хранить reset/email verification токены только в хешированном виде
- **Что:** `password_reset_tokens.token` и `email_verification_tokens.token` сейчас хранят raw token.
- **Где:** [prisma/schema.prisma](../prisma/schema.prisma), [app/api/auth/forgot-password/route.ts](../app/api/auth/forgot-password/route.ts), [app/api/auth/reset-password/route.ts](../app/api/auth/reset-password/route.ts), [lib/auth.ts](../lib/auth.ts)
- **Риск:** при утечке БД или бэкапа токены можно использовать как готовые ссылки сброса пароля/верификации до истечения срока.
- **Как исправить:**
  1. Генерировать raw token для ссылки, но сохранять только SHA-256/HMAC hash.
  2. Проверку делать по hash; raw token никогда не логировать и не хранить.
  3. Старые plaintext токены удалить или инвалидировать миграцией.
- **Оценка:** 1 ч.

### A6. P1 — ограничить диапазоны AI period/forecast запросов
- **Что:** `evaluate-period` и `forecast` валидируют только форму строк дат, но не ограничивают длительность периода и не проверяют `Invalid Date` / `start <= end`.
- **Где:** [app/api/evaluate-period/route.ts](../app/api/evaluate-period/route.ts), [app/api/forecast/route.ts](../app/api/forecast/route.ts)
- **Риск:** один авторизованный запрос может собрать годы дневников в prompt, что даёт лишнюю стоимость, долгий ответ и риск DoS.
- **Как исправить:**
  1. Валидировать даты после `parseDateParam`: `Number.isNaN(date.getTime())`, `start <= end`.
  2. Ввести максимальный диапазон по `periodType` и общий cap на количество дней/символов перед вызовом Claude.
  3. Возвращать 400 до Prisma/AI вызовов при превышении лимитов.
- **Оценка:** 45 мин.

### A7. P1 — привести lint к зелёному состоянию
- **Что:** `npm run lint` сейчас падает на `require()` в audit middleware и даёт warning по unused import.
- **Где:** [lib/prisma-audit.ts](../lib/prisma-audit.ts), [components/goals/GoalsChatPanel.tsx](../components/goals/GoalsChatPanel.tsx)
- **Риск:** lint не может быть quality gate перед деплоем; реальные проблемы теряются в известном красном статусе.
- **Как исправить:**
  1. Исправить audit import в рамках A3.
  2. Удалить неиспользуемый `MONTH_NAMES` import.
  3. Повторить `npm run lint`.
- **Оценка:** 15 мин.

### Обновлённый рекомендуемый старт

1. **Сначала A1:** обновить Next.js/dependencies и закрыть critical audit.
2. **Затем A2, A3, A4:** cookies, достоверный audit, encryption nested relations.
3. **Затем A5, A6, A7:** хеш токенов, лимиты AI-запросов, зелёный lint.
4. После этого переходить к исходному P0 ниже: бэкапы, `ENCRYPTION_KEY`, Workers rate-limit, cleanup cron.

---

## P0 — Критические (исправить в ближайшие дни)

### 1. Шифрование бэкапов БД
- **Что:** `pg_dump | gzip` пишет дампы в `/backups` без шифрования. Все таблицы попадают в файл в открытом виде, включая поля, которые в БД зашифрованы (расшифровка не нужна — текст уже расшифрован Prisma middleware при чтении? **нет, pg_dump читает напрямую из БД, поэтому в дампе хранятся `enc_v1:...` строки**, но `ENCRYPTION_KEY` лежит на том же сервере → одна компрометация = всё).
- **Где:** [scripts/prod-backup.sh](../scripts/prod-backup.sh)
- **Риск:** утечка всей БД пользователей при компрометации сервера или ошибочной публикации бэкапа.
- **Как исправить:**
  1. Сгенерировать ключ: `openssl rand -base64 32 > /home/ubuntu/.backup-key && chmod 600 /home/ubuntu/.backup-key`
  2. В скрипте:
     ```bash
     pg_dump ... \
       | gzip \
       | openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:/home/ubuntu/.backup-key \
       > "$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz.enc"
     ```
  3. Документировать процесс расшифровки в `docs/DEPLOY.md`.
  4. Желательно: периодически выгружать бэкапы во внешнее хранилище (S3/VK Cloud Object Storage) с отдельными credentials.
- **Оценка:** 30 мин

### 2. ENCRYPTION_KEY отсутствует в .env.production.example
- **Что:** Ключ шифрования критичен — без него вся БД нечитаема. В шаблоне его нет, при новом деплое легко забыть → потеря данных.
- **Где:** `.env.production.example`, потребитель — [lib/encryption.ts](../lib/encryption.ts)
- **Риск:** при пересоздании сервера/контейнера данные становятся нерасшифровываемыми. Потенциально полная потеря пользовательских данных.
- **Как исправить:**
  1. Добавить в `.env.production.example`:
     ```env
     # КРИТИЧНО: ключ для шифрования полей БД (AES-256-GCM)
     # Сгенерировать: openssl rand -hex 32
     # ⚠️ НИКОГДА не менять на проде — данные станут нечитаемыми
     ENCRYPTION_KEY=
     ```
  2. В `lib/encryption.ts` при старте: если `ENCRYPTION_KEY` пуст — `throw` с понятным сообщением (а не silent fallback).
  3. Записать ключ в надёжное место (1Password, VK Cloud Secret Manager).
- **Оценка:** 15 мин

### 3. Rate-limit на Cloudflare Workers (proxy + tg-proxy)
- **Что:** Edge-прокси проверяет только `PROXY_SECRET`. Если секрет утечёт (логи браузера, devtools, ошибочный коммит), злоумышленник за минуту высосет весь Anthropic-бюджет.
- **Где:** [cloudflare-proxy/src/index.js](../cloudflare-proxy/src/index.js#L77), [cloudflare-tg-proxy/src/index.js](../cloudflare-tg-proxy/src/index.js#L9)
- **Риск:** финансовый — резкий перерасход API-бюджета Anthropic / биллинга Telegram-прокси.
- **Как исправить:**
  1. Включить Cloudflare Rate Limiting Rules в дашборде (минимум: 60 req/min на IP).
  2. Дополнительно — Worker KV счётчик по `cf-connecting-ip`:
     ```js
     const ip = request.headers.get('CF-Connecting-IP')
     const key = `rl:${ip}:${Math.floor(Date.now() / 60000)}`
     const count = parseInt(await env.RL.get(key) || '0', 10)
     if (count > 60) return new Response('Too Many Requests', { status: 429 })
     await env.RL.put(key, String(count + 1), { expirationTtl: 120 })
     ```
  3. Добавить алерт на резкий рост запросов (Cloudflare Analytics → email).
- **Оценка:** 45 мин

### 4. Очистка просроченных сессий и токенов (cron)
- **Что:** Таблицы `sessions`, `password_reset_tokens`, `email_verification_tokens` растут бесконечно. Старые токены не нужны, но остаются в БД и в бэкапах.
- **Где:** Prisma-модели в [prisma/schema.prisma](../prisma/schema.prisma); сейчас никто не чистит.
- **Риск:** медленное распухание БД, увеличение поверхности атаки (старые токены), удорожание бэкапов.
- **Как исправить:**
  1. Создать `scripts/cleanup-expired.ts`:
     ```ts
     await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
     await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
     await prisma.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
     ```
  2. Запускать раз в сутки (cron в backup-контейнере или systemd timer на хосте).
- **Оценка:** 30 мин

---

## P1 — Высокие (исправить на этой неделе)

### 5. Проверить и добавить только реально отсутствующие индексы Prisma
- **Статус:** выполнено 01.05.2026 — вместо неподтверждённого индекса `InsightEntry(userId, date)` добавлен подтверждённый индекс `InsightEntry(userId, createdAt)` под реальные запросы к knowledge cache.
- **Что:** Из выборочной проверки реально отсутствовал индекс для фактических чтений `InsightEntry`: `where: { userId }`, `orderBy: { createdAt: 'desc' }`, `take: 50/100`. Гипотеза про индекс по `date` не подтвердилась: текущий код `InsightEntry.date` только записывает/выбирает в payload, но не фильтрует и не сортирует по нему.
- **Где:** [prisma/schema.prisma](../prisma/schema.prisma)
  - `Goal.parentId` — индекс **уже есть** (`@@index([parentId])`, строка 151), ничего делать не нужно.
  - `Evaluation.userId` — такого поля **нет вообще**; связь с пользователем идёт через `dailyEntryId @unique` → `DailyEntry.userId`. Добавлять нечего.
  - `Goal` — оставить текущий `@@index([userId, periodType, periodKey])`. **Не** добавлять `@@unique` — у пользователя легитимно может быть несколько целей в одном периоде (например, 3 цели на месяц).
  - `InsightEntry` — есть `@@index([userId])` и `@@index([userId, category])`; добавлен `@@index([userId, createdAt])`, потому что реальные запросы читают последние записи по `createdAt`.
- **Риск:** ложная миграция могла бы (а) попытаться создать индекс на несуществующее поле и не применилась бы, (б) сломать сценарий «много целей на один период» через unique-констрейнт.
- **Как исправить:**
  1. Сначала проверить, есть ли в коде запросы к `InsightEntry` с фильтром по `date` / диапазону дат. Проверка показала, что таких запросов сейчас нет.
  2. Подтверждённый индекс:
     ```prisma
     model InsightEntry {
       // ...
       @@index([userId, createdAt])
     }
     ```
  3. Миграция: `20260501120000_add_insight_entry_user_created_at_index`.
  4. Принцип: новые индексы добавлять только под подтверждённый запрос (логом / `EXPLAIN ANALYZE`), а не «на всякий случай».
- **Оценка:** 20 мин

### 6. AuthProvider — лишние запросы при каждой навигации (P1 #17 из старого плана)
- **Статус:** выполнено 01.05.2026 — загрузка `/api/auth/me` отделена от pathname redirects; protected-to-protected навигация больше не вызывает повторную проверку auth.
- **Что:** `pathname` в зависимостях `useEffect` приводит к пересозданию `checkAuth` и запросу `/api/auth/me` при каждом переходе.
- **Где:** [components/AuthProvider.tsx](../components/AuthProvider.tsx#L43-L88)
- **Риск:** лишняя нагрузка на API, потенциальный stale closure.
- **Как исправить:**
  1. Убрать `pathname` из зависимостей `useCallback`.
  2. Использовать `window.location.pathname` внутри тела функции либо разделить на два эффекта: один грузит юзера один раз, другой следит за `pathname` для редиректов.
- **Оценка:** 20 мин

### 7. fetch без проверки `.ok` и пустые catch
- **Статус:** выполнено 01.05.2026 для самых рискованных пользовательских потоков — добавлен общий helper, daily/tasks/useDaily переведены на checked fetch там, где ошибка могла продолжить workflow или молча потеряться.
- **Что:** Десятки fetch-вызовов читали `.json()` без проверки `res.ok` или тихо игнорировали failed response. Ошибки 4xx/5xx могли превращаться в незаметные краши при парсинге или в некорректное продолжение сценария.
- **Где (выборочно):**
  - [lib/fetch-json.ts](../lib/fetch-json.ts) — `fetchJson`, `expectOk`, typed `FetchJsonError`, helper для сообщения ошибки.
  - [app/daily/page.tsx](../app/daily/page.tsx) — `process-uncompleted` теперь останавливает оценку при ошибке; facts-загрузка не молчит и чистит stale виджеты при failed response.
  - [hooks/useDaily.ts](../hooks/useDaily.ts) — сохранение плана/внеплана, привычки, перенос задач, check-plan, daily chat и evaluate используют checked fetch/error messages.
  - [app/tasks/page.tsx](../app/tasks/page.tsx) — загрузка/редактирование/закрытие/возврат/удаление/добавление задач больше не уходят в тихий `return` на `!ok`.
  - [components/AuthProvider.tsx](../components/AuthProvider.tsx) — проверен, оставлен с ручной обработкой: `401` для `/api/auth/me` является штатным unauthenticated state.
- **Риск:** пользователь видел зависшее/молчаливое поведение, а в daily-flow оценка могла продолжиться после failed `process-uncompleted`.
- **Как исправлено:** общий fetch helper читает error payload, кидает typed error на `!ok`, а рискованные actions показывают сообщение и не продолжают опасный workflow.
- **Оценка:** 2 ч

### 8. Оставшиеся JSON.parse без try/catch
- **Статус:** выполнено 01.05.2026 — подтверждённые unguarded DB-backed parses в `user-stats` переведены на `safeParseJson`; старые ссылки на `fact-utils` и `daily` оказались уже защищены.
- **Что:** Часть JSON из БД парсилась без fallback и могла уронить пересчёт статистики или AI-контекст при битой записи.
- **Где:**
  - [lib/user-stats.ts](../lib/user-stats.ts) — `selectedTasksJson`, `completionByDayJson`, `completionByTypeJson`, `frequentCompletedJson`, `frequentFailedJson`.
  - [lib/fact-utils.ts](../lib/fact-utils.ts) — проверено, уже использует safe local helper.
  - [app/daily/page.tsx](../app/daily/page.tsx) — проверено, localStorage parse уже в `try/catch`.
- **Риск:** битые/устаревшие данные в БД могли ломать `recalculateUserStats()` или `getUserStatsForAI()`.
- **Как исправлено:** `lib/user-stats.ts` использует `safeParseJson()` из [lib/safe-json.ts](../lib/safe-json.ts) с typed fallback values.
- **Оценка:** 30 мин

### 9. Захардкоженные production-URL
- **Статус:** выполнено 01.05.2026 — runtime metadata/email/OG URL переведены на `NEXT_PUBLIC_APP_URL`, production compose теперь требует эту переменную, Worker Anthropic base URL вынесен в `ANTHROPIC_API_URL`.
- **Что:** Домен и Anthropic API URL были прибиты к коду — переезд / staging-окружение требовали правок кода.
- **Где:**
  - [lib/app-url.ts](../lib/app-url.ts) — единый helper `getAppUrl()` / `getAppHost()`.
  - [app/layout.tsx](../app/layout.tsx) — `metadataBase` и `openGraph.url` берутся из `NEXT_PUBLIC_APP_URL`.
  - [app/opengraph-image.tsx](../app/opengraph-image.tsx), [app/twitter-image.tsx](../app/twitter-image.tsx) — отображаемый hostname берётся из `NEXT_PUBLIC_APP_URL`.
  - Auth email routes используют общий app URL helper для verification/reset links.
  - [docker-compose.production.yml](../docker-compose.production.yml) — `NEXT_PUBLIC_APP_URL` обязателен в production compose.
  - [cloudflare-proxy/src/index.js](../cloudflare-proxy/src/index.js) — Anthropic base URL берётся из `env.ANTHROPIC_API_URL` с дефолтом.
- **Риск:** staging/переезд домена могли получать production metadata/email links или требовать пересборку Worker ради смены upstream URL.
- **Как исправлено:**
  1. Введён `NEXT_PUBLIC_APP_URL` как единый источник app URL для metadata, OG/Twitter image hostname и email links.
  2. В `.env.production.example` добавлен `NEXT_PUBLIC_APP_URL`.
  3. В production compose убран fallback на `http://localhost:3000`, чтобы неправильный public URL не проходил молча.
  4. В Worker добавлен `ANTHROPIC_API_URL` env var со значением по умолчанию `https://api.anthropic.com`.
- **Оценка:** 30 мин

### 10. `$queryRawUnsafe` в monitor.sh (антипаттерн)
- **Статус:** выполнено 01.05.2026 — `$queryRawUnsafe` убран из monitor и найденного рядом Telegram bot audit-check.
- **Что:** Конкатенация дат в SQL была контролируемой, но задавала плохой шаблон для будущих изменений.
- **Где:** [scripts/monitor.sh](../scripts/monitor.sh), [scripts/tg-bot.sh](../scripts/tg-bot.sh)
- **Риск:** сегодня входы были безопасными, но при модификации легко получить SQL-инъекцию или скопировать unsafe-паттерн в API-код.
- **Как исправлено:** unsafe SQL string concatenation заменена на параметризованный Prisma `$queryRaw` с tagged template literals; даты и `loginAction` передаются параметрами.
- **Оценка:** 15 мин

### 11. Отсутствие тестов для критичных модулей
- **Статус:** выполнено 01.05.2026 — добавлен Vitest 4.1.5, npm scripts и минимальный safety-net из 14 unit-тестов для критичных helper-модулей без реальных API/DB вызовов.
- **Что:** До этого в проекте не было `npm test` и тестовой инфраструктуры. Самые опасные места оставались без автоматической проверки: шифрование, auth token hashing, AI client config, date range guards, safe JSON parsing, checked fetch helper.
- **Где:** [vitest.config.ts](../vitest.config.ts), [package.json](../package.json), [tests/lib/](../tests/lib/), [lib/encryption.ts](../lib/encryption.ts), [lib/auth.ts](../lib/auth.ts), [lib/anthropic.ts](../lib/anthropic.ts), [lib/safe-json.ts](../lib/safe-json.ts), [lib/dates.ts](../lib/dates.ts), [lib/fetch-json.ts](../lib/fetch-json.ts)
- **Риск:** регрессии при рефакторинге могли молча сломать шифрование, token hashing, AI proxy config или error handling.
- **Как исправлено:**
  1. Установлен `vitest@4.1.5`; совместимость проверена с текущим Node `v24.10.0` и engines Vitest `^20.0.0 || ^22.0.0 || >=24.0.0`.
  2. Добавлены scripts `npm test` и `npm run test:watch`.
  3. Добавлен `vitest.config.ts` с node environment и alias `@`.
  4. Добавлены тесты:
     - `encryption.test.ts`: encrypt/decrypt round-trip, `isEncrypted`, plaintext passthrough, production config validation.
     - `auth.test.ts`: `hashToken()` deterministic, не равен raw token, формат SHA-256 hex.
     - `anthropic.test.ts`: API key required, proxy `baseURL`, `x-proxy-secret`, lazy singleton; SDK мокается, реальных API вызовов нет.
     - `safe-json.test.ts`: valid parse, fallback на пустой/битый JSON, ожидаемый parse-error log.
     - `dates.test.ts`: local date-only parse, valid/invalid/reversed/oversized AI date ranges.
     - `fetch-json.test.ts`: success JSON, `FetchJsonError` на `!ok`, error message extraction/fallback.
  5. `npm audit --omit=dev` остаётся чистым; full audit может показывать dev-only findings, как и раньше.
- **Оценка:** 4 ч (минимальный набор)

### 12. Soft delete + аудит удаления для User
- **Статус:** выполнено 02.05.2026 — добавлен `User.deletedAt`, migration, Prisma middleware для перехвата hard delete и audit записи исходного действия `delete`.
- **Что:** Все связи `User` остаются с `onDelete: Cascade`, но прямой `prisma.user.delete/deleteMany()` теперь не запускает физическое удаление пользователя и каскады: middleware преобразует действие в `update/updateMany` с `isActive=false` и `deletedAt=now()`.
- **Где:** [prisma/schema.prisma](../prisma/schema.prisma), [lib/prisma-user-soft-delete.ts](../lib/prisma-user-soft-delete.ts), [lib/prisma-audit.ts](../lib/prisma-audit.ts), [lib/prisma.ts](../lib/prisma.ts), [lib/auth.ts](../lib/auth.ts), auth routes и [tests/lib/prisma-user-soft-delete.test.ts](../tests/lib/prisma-user-soft-delete.test.ts)
- **Риск:** случайное / злонамеренное удаление аккаунта раньше могло физически стереть все связанные данные пользователя.
- **Как исправлено:**
  1. В `User` добавлено поле `deletedAt: DateTime?` и индекс `@@index([deletedAt])`.
  2. Добавлена миграция `20260502090000_add_user_deleted_at`.
  3. Добавлен `userSoftDeleteMiddleware`: `User.delete` -> `User.update`, `User.deleteMany` -> `User.updateMany`, данные soft delete: `isActive=false`, `deletedAt=now()`.
  4. Audit middleware теперь снимает `model/action/where.id` до вызова `next()`, поэтому soft-deleted `User.delete` логируется как `delete`, а не как технический `update`.
  5. `User` добавлен в список audited models.
  6. Auth/session/reset/verification/onboarding/theme/CLI reset-password ветки проверяют `deletedAt` или явно фильтруют `deletedAt: null`.
  7. Добавлен unit-тест middleware на `delete`, `deleteMany` и pass-through для других моделей.
- **Оценка:** 2 ч

---

## P2 — Средние (в ближайшие 2 недели)

### 13. Разделить `hooks/useDaily.ts` (~1100 строк)
- **Статус:** выполнен первый безопасный разрез 02.05.2026 — публичный `hooks/useDaily.ts` оставлен как фасад-заглушка, реализация перенесена в `hooks/daily/useDailyController.ts`, типы и тестируемые helper-срезы вынесены отдельно.
- **Что:** Хук содержал chat, habits, tasks, period-goals, evaluation — всё в одном public file.
- **Где:** [hooks/useDaily.ts](../hooks/useDaily.ts), [hooks/daily/](../hooks/daily/)
- **Риск:** очень высокая стоимость изменений, легко словить stale closure (#27 из старого плана как раз пример).
- **Как исправлено:**
  - `hooks/useDaily.ts` теперь тонкий фасад: re-export `useDaily` и публичных типов.
  - Основная совместимая реализация живёт в `hooks/daily/useDailyController.ts`.
  - Типы вынесены в `hooks/daily/types.ts`.
  - Чистая логика задач вынесена в `hooks/daily/task-helpers.ts` и покрыта тестами.
  - Черновики плана вынесены в `hooks/daily/plan-draft.ts` и покрыты тестами.
  - Следующий улучшительный проход может выделить из controller отдельные `useDailyChat`, `useDailyHabits`, `useDailyEvaluation` без изменения public import path.
- **Оценка:** 4 ч

### 14. Дублирование контекста пользователя в AI-роутах (#32 из старого плана)
- **Статус:** выполнено 02.05.2026 — общий AI user context вынесен в [lib/user-context.ts](../lib/user-context.ts), роуты переведены на shared helpers, pure-мапперы покрыты unit-тестами.
- **Что:** Загрузка `dream`/`goals`/`profile`/`insights` копипастилась в `daily/chat`, `evaluate`, `evaluate/batch`, `check-plan`, `forecast`, `evaluate-period`.
- **Где:** [lib/user-context.ts](../lib/user-context.ts), [app/api/daily/chat/route.ts](../app/api/daily/chat/route.ts), [app/api/daily/check-plan/route.ts](../app/api/daily/check-plan/route.ts), [app/api/evaluate/route.ts](../app/api/evaluate/route.ts), [app/api/evaluate/batch/route.ts](../app/api/evaluate/batch/route.ts), [app/api/evaluate-period/route.ts](../app/api/evaluate-period/route.ts), [app/api/forecast/route.ts](../app/api/forecast/route.ts)
- **Риск:** изменения в логике контекста разъезжаются между роутами.
- **Как исправлено:** добавлены pure-мапперы `mapUserProfile`, `mapUserInsights`, `buildGoalsContext`, `buildPlanContext` и async helpers `getPlanUserContext`, `getDailyEvaluationUserContext`, `getDailyEvaluationGoalsContext`, `getPeriodEvaluationUserContext`, `getForecastHorizonGoals`, `getLatestDreamGoal`, `getLatestUserProfile`.
- **Оценка:** 1.5 ч

### 15. Дублирование `getTaskCategory`/`getTaskType` (#31 из старого плана)
- **Статус:** выполнено 02.05.2026 — единая логика вынесена в `lib/task-categorize.ts`, локальные копии удалены, поведение покрыто unit-тестами.
- **Что:** Три разных версии в разных файлах могли расходиться при изменении правил.
- **Где:** [lib/task-categorize.ts](../lib/task-categorize.ts), [lib/completed-work.ts](../lib/completed-work.ts), [lib/user-stats.ts](../lib/user-stats.ts), [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts)
- **Как исправлено:**
  - Добавлен `getTaskCategory()` и совместимый alias `getTaskType()`.
  - `completed-work`, `user-stats` и `backfill-completed-work` импортируют общий helper.
  - Старые локальные функции удалены.
  - Добавлен `tests/lib/task-categorize.test.ts`.
- **Оценка:** 30 мин

### 16. AI-модель в env-переменную (#19 из старого плана)
- **Статус:** выполнено 03.05.2026 — добавлен единый helper `getAiModel()` в [lib/anthropic.ts](../lib/anthropic.ts), `AI_MODEL` прокинут в env-шаблоны и production compose, прямые Anthropic-вызовы больше не содержат hardcoded `model` literals.
- **Что:** `claude-sonnet-4-20250514` и `claude-sonnet-4-6` были захардкожены в shared AI-функциях и route handlers.
- **Где:** [lib/anthropic.ts](../lib/anthropic.ts), [app/api/daily/chat/route.ts](../app/api/daily/chat/route.ts), [app/api/daily/check-plan/route.ts](../app/api/daily/check-plan/route.ts), [app/api/goals/decompose/route.ts](../app/api/goals/decompose/route.ts), [.env.example](../.env.example), [.env.production.example](../.env.production.example), [docker-compose.production.yml](../docker-compose.production.yml)
- **Как исправлено:** `process.env.AI_MODEL` переопределяет модель для всех сценариев; если переменная пустая, сохраняется текущий fallback конкретного сценария без silent migration модели.
- **Оценка:** 20 мин

### 17. Пагинация в API (#20 из старого плана)
- **Статус:** выполнено 03.05.2026 — list endpoints переведены на `limit/offset` envelope с max `100`, UI-потребители обновлены под новый контракт.
- **Что:** Несколько эндпоинтов возвращали всё подряд.
- **Где:**
  - [app/api/tasks/closed/route.ts](../app/api/tasks/closed/route.ts)
  - [app/api/periods/route.ts](../app/api/periods/route.ts)
  - [app/api/daily/route.ts](../app/api/daily/route.ts)
  - [app/api/goals/items/route.ts](../app/api/goals/items/route.ts)
- **Как исправлено:** добавлен [lib/pagination.ts](../lib/pagination.ts), list GET возвращают `{ items, total, limit, offset, hasMore }`; single-date `GET /api/daily?date=...` и mutation endpoints не менялись.
- **Оценка:** 1 ч

### 18. `String` поля под JSON → тип `Json`
- **Статус:** выполнено 03.05.2026 — все `*Json` string-поля и `WorkSummary.keyAchievements` переведены на Prisma `Json`; строковых JSON-полей в [prisma/schema.prisma](../prisma/schema.prisma) больше нет.
- **Что:** ~12 полей хранят сериализованный JSON в `String` (`goalsJson`, `tagsJson`, `planSnapshotJson`, `selectedTasksJson` и т.д.).
- **Где:** [prisma/schema.prisma](../prisma/schema.prisma) (multiple)
- **Риск:** нет валидации на уровне БД, ручной `JSON.parse`/`stringify` в десятках мест.
- **Первый срез сделан:** [prisma/schema.prisma](../prisma/schema.prisma) и миграция `20260503100000_user_stats_json_fields` переводят `completionByDayJson`, `completionByTypeJson`, `frequentCompletedJson`, `frequentFailedJson` в `Json`; [lib/user-stats.ts](../lib/user-stats.ts) пишет объекты/массивы напрямую, [lib/safe-json.ts](../lib/safe-json.ts) теперь совместим и со строковым legacy JSON, и с уже распарсенными Prisma `Json` значениями.
- **Второй срез сделан:** миграция `20260503101000_work_summary_top_categories_json` переводит `WorkSummary.topCategoriesJson` в `Json`; [lib/completed-work.ts](../lib/completed-work.ts) и [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts) пишут объект категорий напрямую.
- **Третий срез сделан:** миграция `20260503102000_goal_tags_blocked_json_fields` переводит `Goal.tagsJson` и `Goal.blockedByJson` в `Json`; [app/api/goals/items/route.ts](../app/api/goals/items/route.ts) пишет массивы напрямую, а ответы продолжают использовать совместимый `safeParseJson()`.
- **Encrypted JSON подготовлен:** [lib/prisma-encryption.ts](../lib/prisma-encryption.ts) поддерживает `ENCRYPTED_JSON_FIELDS`: object/array значения сериализуются перед шифрованием и распарсиваются после расшифровки; добавлен [tests/lib/prisma-encryption.test.ts](../tests/lib/prisma-encryption.test.ts).
- **Четвёртый срез сделан:** миграция `20260503103000_work_summary_key_achievements_json` переводит `WorkSummary.keyAchievements` в `Json`, сохраняя старые `enc_v1:*` как JSON string; writers в [lib/completed-work.ts](../lib/completed-work.ts) и [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts) пишут массив напрямую.
- **Пятый срез сделан:** миграция `20260503104000_goal_history_json_field` переводит `Goal.historyJson` в encrypted `Json`; [app/api/goals/items/route.ts](../app/api/goals/items/route.ts) и [app/api/goals/move/route.ts](../app/api/goals/move/route.ts) пишут массив history напрямую.
- **Шестой срез сделан:** миграция `20260503105000_year_period_goals_json_fields` переводит `YearGoal.goalsJson` и `PeriodGoal.goalsJson` в encrypted `Json`; year/period goal API пишут массивы напрямую, AI context и scripts совместимы с Json values.
- **Седьмой срез сделан:** миграция `20260503110000_daily_entry_json_fields` переводит `DailyEntry.planSnapshotJson`, `DailyEntry.extraTasksJson`, `DailyEntry.selectedTasksJson` в encrypted `Json`; `/api/daily` продолжает принимать legacy string payload от фронта, но пишет массивы в Prisma.
- **Восьмой срез сделан:** миграция `20260503111000_evaluation_suggested_tasks_json_field` переводит `Evaluation.suggestedTasksJson` в encrypted `Json`; AI evaluation routes и `add-suggested` пишут массивы/`DbNull` напрямую.
- **Как исправлено:** поля мигрированы маленькими срезами; legacy `enc_v1:*` сохраняются в `jsonb` как JSON string и расшифровываются middleware, plaintext JSON strings парсятся в `jsonb`, invalid/empty значения падают в прежние defaults/fallbacks.
- **Оценка:** 3 ч (поэтапно)

### 19. Каскад API-вызовов на goals page (#30 из старого плана)
- **Статус:** выполнено 03.05.2026 — стартовая загрузка страницы целей переведена на агрегирующий endpoint [app/api/goals/context/route.ts](../app/api/goals/context/route.ts), [app/goals/page.tsx](../app/goals/page.tsx) больше не запускает каскад year/period/progress/year-evaluation запросов.
- **Что:** ~25 запросов при открытии страницы целей.
- **Где:** [app/goals/page.tsx](../app/goals/page.tsx)
- **Как исправлено:** `/api/goals/context?year=YYYY` собирает мечту, progress summary, средние оценки по годам, годовые цели, периодные цели выбранного года, tracked goals и теги; `useGoals()` гидратирует существующие `Map`/state из одного ответа, а старые точечные endpoints оставлены для сохранений и совместимости.
- **Оценка:** 2 ч

### 20. Evaluate запускается даже если обработка невыполненных задач не удалась
- **Статус:** выполнено 03.05.2026 — закрыто ранее в P1 #7 через checked fetch: failed `process-uncompleted` показывает ошибку и возвращается до запуска `evaluate(router)`.
- **Что:** `process-uncompleted` уже вызывается через `await fetch(...)`, поэтому исходная формулировка про «без ожидания» (старый #25) устарела. Проблемный сценарий был в том, что после ошибки API оценка дня могла продолжиться.
- **Где:** [app/daily/page.tsx](../app/daily/page.tsx)
- **Риск:** оценка может быть создана до корректной обработки решений по невыполненным задачам; задачи не перенесутся/не закроются, а день уже уйдёт в AI evaluation. Пользователь получит искажённую картину дня.
- **Как исправлено:** `handleUncompletedDecisions()` использует `fetchJson('/api/tasks/process-uncompleted')`; в `catch` пишет `console.error`, показывает сообщение через `showMessage(...)` и делает `return`, поэтому `evaluate(router)` вызывается только после успешной обработки решений.
- **Оценка:** 10 мин

### 21. Race condition в `recalculateUserStats` (#26)
- **Статус:** выполнено 03.05.2026 — `findFirst` + `update/create` заменены на атомарный `prisma.userStats.upsert()` по существующему уникальному `userId`.
- **Где:** [lib/user-stats.ts](../lib/user-stats.ts#L291-L339)
- **Как исправлено:** данные статистики собираются в `statsData`, затем сохраняются через `upsert({ where: { userId }, create: { userId, ...statsData }, update: statsData })`; отдельная миграция не нужна, потому что `UserStats.userId` уже `@unique`.
- **Оценка:** 15 мин

### 22. Stale closure в `sendChatMessage` (#27)
- **Статус:** выполнено 03.05.2026 — после разреза `useDaily` исправлено в [hooks/daily/useDailyController.ts](../hooks/daily/useDailyController.ts): callback больше не зависит от stale `chatMessages`, а использует `chatMessagesRef.current`.
- **Где:** [hooks/daily/useDailyController.ts](../hooks/daily/useDailyController.ts)
- **Как исправлено:** текущая история берётся из ref, UI/ref синхронно обновляются оптимистичным `updatedMessages`, финальный ответ записывает `finalMessages`; в API отправляется история до текущего сообщения плюс отдельный `userMessage`, чтобы не дублировать prompt.
- **Оценка:** 10 мин

### 23. Обработка ошибок миграций в docker-entrypoint
- **Статус:** выполнено 03.05.2026 — `prisma migrate deploy` обёрнут в явный `if ! ...; then`, при ошибке контейнер пишет понятное сообщение и выходит с code `1` до старта приложения.
- **Что:** Полагается на `set -e`, но нет явного сообщения об ошибке миграций.
- **Где:** [docker-entrypoint.sh](../docker-entrypoint.sh)
- **Как исправлено:** сохранён фактический запуск локального Prisma CLI через `node ./node_modules/prisma/build/index.js migrate deploy`; ошибка миграций теперь явно логируется как `Prisma migration failed — refusing to start` и блокирует `exec "$@"`.
- **Оценка:** 5 мин

### 24. Prop drilling в TaskCard (14 props)
- **Статус:** выполнено 03.05.2026 — пропсы `TaskCard` и `TaskSection` сгруппированы в `state`/`actions`, без изменения UI-поведения.
- **Где:** [app/tasks/page.tsx](../app/tasks/page.tsx#L110-L140)
- **Как исправлено:** добавлены `TaskCardState`, `TaskCardActions` и `TaskSectionState`; `TasksPage` формирует общий `taskSectionState` и `taskSectionActions`, а три секции получают короткий контракт вместо повторяющегося набора флагов и callbacks.
- **Оценка:** 30 мин

---

## P3 — Низкие (бэклог)

### 25. Error Boundary (#35 из старого плана)
- **Статус:** выполнено 03.05.2026 — добавлены `app/error.tsx` и `app/global-error.tsx` по Next.js App Router conventions.
- **Как исправлено:** обычный route-level boundary показывает fallback внутри текущего layout и вызывает `reset()`; global boundary включает собственные `html/body`, импортирует `globals.css`, логирует ошибку и даёт повтор/перезагрузку.
- **Оценка:** 30 мин

### 26. Заменить оставшиеся `alert()` на toast / inline error state
- **Статус:** выполнено 03.05.2026 — все `alert()` в `app/**` и `hooks/**` заменены на inline error state.
- **Что:** В коде было 8 вызовов `alert()` в трёх файлах. В `app/periods/page.tsx` (как было в старом плане #36) их **нет** — это была устаревшая ссылка. Заодно было видно дублирование: прежний `useForecast.ts` и `forecast/page.tsx` повторяли одну и ту же логику валидации с одинаковыми сообщениями.
- **Где:**
  - [app/forecast/page.tsx](../app/forecast/page.tsx#L120) — 3 вызова (строки 120, 125, 162)
  - [app/evaluation/[date]/page.tsx](../app/evaluation/%5Bdate%5D/page.tsx#L113) — 2 вызова (113, 139)
  - прежний `hooks/useForecast.ts` — 3 вызова, дублировали `forecast/page.tsx`; файл позже удалён в P3 #34 как неподключённый dead code.
- **Как исправлено:** `forecast/page.tsx` и временно `useForecast.ts` были переведены на `errorMessage` вместо browser modal; forecast-запросы переведены на `fetchJson()`/`getFetchErrorMessage()`. В `evaluation/[date]/page.tsx` ошибки добавления suggested task показываются inline рядом с блоком предложенных задач.
- **Риск:** браузерные модалки выглядят грубо, блокируют поток работы и не вписываются в UI. Дубль логики — расхождение сообщений при изменении.
- **Как исправить:**
  1. Form validation (выбор периода) → inline error state на форме, без `alert`.
  2. Ошибки запросов → toast или inline error в области результата (паттерн уже есть в других страницах — посмотреть как сделано в `app/goals/page.tsx`).
  3. Заодно решить дубль: либо валидация только в хуке, либо только в странице.
  4. После замены — убедиться, что `rg "alert\\(" app hooks components` пуст.
- **Оценка:** 45 мин

### 27. ESLint с `eslint-config-next` (#41)
- **Статус:** выполнено 03.05.2026 — flat config переведён на `eslint-config-next/core-web-vitals` и `eslint-config-next/typescript`; `eslint-plugin-react-hooks@7.0.1` закреплён как явная dev-зависимость.
- **Как исправлено:** `react-hooks/rules-of-hooks` включён как `error`, `react-hooks/exhaustive-deps` как `warn`; широкие React Compiler diagnostics `set-state-in-effect` и `preserve-manual-memoization` отключены до отдельного поведенческого аудита.
- **Осталось:** `npm run lint` проходит с 11 warnings: 10 по `react-hooks/exhaustive-deps` и 1 по `@next/next/no-page-custom-font` (закрывается пунктом #28).
- **Оценка:** 30 мин

### 28. Next.js font optimization (#42)
- **Статус:** выполнено 03.05.2026 — ручные Google Fonts `<link>` заменены на `next/font/google`.
- **Как исправлено:** [app/layout.tsx](../app/layout.tsx) импортирует `Manrope` и `Orbitron`, вешает font variables на `<html>` и `manrope.className` на `<body>`; [app/globals.css](../app/globals.css) использует `var(--font-manrope)` для навигационного текста.
- **Оценка:** 15 мин

### 29. Ресурсные лимиты `tg-bot.service` (#43)
- **Статус:** выполнено 03.05.2026 — в [scripts/tg-bot.service](../scripts/tg-bot.service) добавлены `MemoryMax=256M` и `CPUQuota=25%` в секцию `[Service]`.
- **Оценка:** 5 мин

### 30. `today` устаревает после полуночи (#44)
- **Статус:** выполнено 03.05.2026 — [app/page.tsx](../app/page.tsx) обновляет `today` при возврате вкладки, фокусе окна и минутном тике; данные дня перезагружаются при смене date-key.
- **Оценка:** 10 мин

### 31. Аудит `'use client'` директив
- **Статус:** выполнен первый безопасный срез 03.05.2026 — лишняя директива снята с трёх pure-компонентов. Позже в P3 #34 два из них (`components/BalanceFlags.tsx`, `components/goals/HorizonsCard.tsx`) удалены как неподключённый dead code; [components/ProgressIndicator.tsx](../components/ProgressIndicator.tsx) остался используемым компонентом без client boundary.
- **Итог аудита:** большинство оставшихся файлов действительно client-side из-за hooks/context/router/event handlers; [app/analytics/page.tsx](../app/analytics/page.tsx) read-only по данным, но использует `useEffect`/state и требует отдельного server data-loading refactor, а не простого удаления директивы.
- **Оценка:** 1 ч

### 32. Bundle size аудит
- **Статус:** выполнено 03.05.2026 — для Next.js 16/Turbopack использован встроенный `npx next build --experimental-analyze` без изменения `next.config.js` и без добавления webpack analyzer-зависимости.
- **Итог аудита:** отчёты сгенерированы в `.next/diagnostics/analyze/` и `.next/diagnostics/route-bundle-stats.json`; крупнейший route — `/analytics` (~905.7 KiB first-load uncompressed JS), где отдельный route-specific chunk ~385.0 KiB содержит `recharts`. Крупные shared chunks на 19 маршрутов выглядят как Next/React/runtime baseline, а не быстрый candidate для точечной правки.
- **Следующий безопасный шаг:** оптимизировать `/analytics` отдельно: вынести графики в lazy/client-only child или заменить часть визуализаций на более лёгкие компоненты после UX-проверки; не делать blanket bundle refactor без пользовательского сценария и замера до/после.
- **Оценка:** 30 мин

### 33. Денормализованные поля `UserStats`
- **Статус:** проверено 03.05.2026 — оставлено как materialized cache без миграции на VIEW/TTL-cache.
- **Решение:** текущие поля `UserStats` являются не источником истины, а вычисляемым snapshot для AI-контекста. Они пересчитываются после одиночной оценки и batch-оценки через `recalculateUserStats(userId)`, а читаются только в `getUserStatsForAI(userId)`. DB VIEW плохо подходит для текущей логики из-за keyword extraction, streak/trend расчётов и JSON aggregates; TTL-cache дал бы лишний stale-window, потому что invalidation уже привязан к write path.
- **Где:** [prisma/schema.prisma](../prisma/schema.prisma#L445-L465)
- **Оценка:** 2 ч

### 34. Dead code audit последним проходом
- **Статус:** выполнен первый cleanup-проход 03.05.2026 — `knip@6.11.0` запущен в production/report-only режиме, подтверждённый source dead code удалён маленькой пачкой, ops/manual files оставлены.
- **Что:** После закрытия функциональных и security-пунктов проверить реально мёртвый код, unused exports, unused files и unused dependencies.
- **Где:** весь workspace: Next.js app routes, components/hooks/lib, scripts, Cloudflare Workers, Docker/deploy files, Prisma migrations, docs references.
- **Риск:** автоматическая чистка без ручной проверки может удалить Next convention files (`page.tsx`, `route.ts`, `opengraph-image.tsx`), cron/deploy scripts, Worker bindings или debug-инструменты, которые не видны через обычные imports.
- **Как исправить:**
  1. Запустить dead-code tooling в режиме отчёта, например `knip` или `ts-prune`, предварительно проверив актуальную версию и совместимость с Next.js/TypeScript контуром проекта.
  2. Разобрать результаты вручную по классам: real dead code, framework false positives, deploy/cron/manual scripts, docs-only references.
  3. Удалять только подтверждённый dead code маленькими пачками с `typecheck`, `lint`, `build` после каждой существенной группы.
  4. Отдельно проверить dependencies через tooling + `npm explain`, чтобы не удалить пакет, используемый config/script/runtime path.
- **Итог:** удалены неподключённые source files: `components/BalanceFlags.tsx`, `components/ThemeToggle.tsx`, `components/goals/HorizonsCard.tsx`, `components/goals/WeekStrip.tsx`, `hooks/useForecast.ts`; `WeekData` перенесён локально в [components/goals/WeekCard.tsx](../components/goals/WeekCard.tsx), barrel export `useForecast` удалён из [hooks/index.ts](../hooks/index.ts). Остаточные `knip` findings — в основном Cloudflare Worker entrypoint, эксплуатационные scripts, barrel/types/API exports и deliberate alias exports; они оставлены без удаления.
- **Оценка:** 2-3 ч

---

## Сводка

**Статус на 03.05.2026:** пункты A1-A7 и исходные пункты 1-34 пройдены; P3 #34 закрыт первым dead-code cleanup-проходом. Оставшиеся `knip` findings требуют отдельной ручной проверки public exports/manual scripts и не блокируют текущий план.

Сводка ниже относится к исходным пунктам 1-34. Дополнительные пункты A1-A7 из блока Copilot выше нужно считать отдельным приоритетным прологом к этому плану.

| Приоритет | Задач | Оценка |
|-----------|-------|--------|
| P0 | 4 | ~2 ч |
| P1 | 8 | ~12 ч |
| P2 | 12 | ~14 ч |
| P3 | 10 | ~8-9 ч |
| **Итого** | **34** | **~36-37 ч** |

## Рекомендуемый порядок

1. **День 1 (P0):** #1 шифрование бэкапов → #2 ENCRYPTION_KEY в example → #3 rate-limit на Workers → #4 cleanup expired tokens. ~2 ч.
2. **Дни 2–3 (P1, быстрые):** #5 индексы → #6 AuthProvider → #9 hardcoded URL → #10 queryRawUnsafe → #8 JSON.parse. ~3 ч.
3. **Дни 4–6 (P1, крупные):** #7 fetch wrapper → #11 базовые тесты → #12 soft delete. ~8 ч.
4. **Неделя 2 (P2):** #13 разрезать useDaily → #14 user-context → #15 task-categorize → #18 String→Json. ~10 ч.
5. **Бэклог:** P3 по мере возможности; #34 dead code audit делать самым последним cleanup-проходом.

---

## Что уже сделано хорошо (не трогаем)

- TypeScript strict, отсутствие `any`/`@ts-ignore`
- AES-256-GCM шифрование с правильным IV+auth tag
- bcrypt + HMAC + hashed sessions + timingSafeEqual
- Anthropic-клиент с retry/backoff и типизированными ошибками
- Multi-stage Dockerfile, non-root, `read_only`, healthchecks, ресурсные лимиты, ротация логов
- 15 Prisma-миграций, чистая история
- `.dockerignore` корректный
- Security headers в `next.config.js`
- Rate-limit на auth и AI-роутах
- Zod-валидация в большинстве API
