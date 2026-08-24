<!-- markdownlint-disable MD013 -->

# Руководство разработчика

Актуально для текущего состояния проекта на апрель 2026.

## Быстрый контекст

- Стек: Next.js 16, React 19, TypeScript 5.7, Tailwind CSS 3, Prisma 5, PostgreSQL, Anthropic SDK.
- Приложение собрано на App Router: UI и API routes живут в одном репозитории.
- Главный продуктовый цикл: мечта и цели -> план дня -> выполнение -> AI-оценка -> история, периоды, аналитика, прогноз.
- `/` публичный: гостям показывается лендинг, авторизованным пользователям - dashboard.
- Чувствительные текстовые поля шифруются на уровне Prisma middleware.

## Локальный запуск

### Что нужно заранее

- Node.js и npm.
- Доступный PostgreSQL, совпадающий с `DATABASE_URL`.
- `ANTHROPIC_API_KEY`, если вы хотите тестировать AI-функции.
- `AUTH_SECRET` и `ENCRYPTION_KEY` для полноценной локальной работы с auth и шифрованием.

### Вариант A: macOS launcher

Файл `Start AI Assistant.command` — тонкая обёртка над `scripts/start-local.sh` (держит окно Terminal открытым при ошибке). Сам скрипт делает следующее:

- проверяет Node.js и npm;
- при необходимости создаёт `.env.local` из `.env.example`;
- поднимает postgres из `docker-compose.local.yml` и ждёт готовности (`docker compose up -d --wait`);
- запускает `npm install`;
- выполняет `npx prisma generate`;
- выполняет `npx prisma db push`;
- стартует dev-сервер на порту из `NEXT_PUBLIC_APP_URL` (по умолчанию `3003`) и открывает браузер, когда сервер начинает отвечать.

Важно:

- не предполагайте `localhost:3000` по умолчанию;
- порт фиксированный и берётся из `NEXT_PUBLIC_APP_URL` — автоподбора соседнего порта больше нет: если порт занят, скрипт покажет, кем, и предложит остановить старый процесс;
- для запуска postgres нужен `POSTGRES_PASSWORD` (см. `.env.example`).

### Вариант B: вручную

```bash
cp .env.example .env.local
npm install
npx prisma generate
npx prisma db push
npm run dev -- -p 3003
```

Локально удобнее держать приложение на `3003`, но это не жёсткое требование. Главное - согласовать порт с `NEXT_PUBLIC_APP_URL`, если вы проверяете регистрацию, верификацию email или сброс пароля.

### PostgreSQL

Для разработки есть `docker-compose.local.yml` — он поднимает только postgres (контейнер `ai-assistant-db`, данные в существующем volume `ai-assistant-spec-opencode_pgdata`). Его автоматически используют `scripts/start-local.sh` и `scripts/update-docker-local.sh`; вручную:

```bash
docker compose -f docker-compose.local.yml up -d --wait postgres
```

Пароль контейнера берётся из `POSTGRES_PASSWORD` (compose читает `.env`; launcher при необходимости передаёт `.env.local` через `--env-file`). Полный стек (приложение + БД) описан в `docker-compose.production.yml`.

## Важные env-переменные

### База и приложение

- `DATABASE_URL` - подключение Prisma к PostgreSQL.
- `NEXT_PUBLIC_APP_URL` - базовый URL для ссылок в email.
- `APP_PORT` - полезен для scripted/prod-запуска, но launcher сам управляет локальным портом.

### Аутентификация

- `AUTH_ENABLED=true` - многопользовательский режим по умолчанию.
- `AUTH_ENABLED=false` - однопользовательский режим для локальной разработки; `requireUserId()` возвращает `local-user`.
- `AUTH_SECRET` - обязателен для HMAC-подписи токенов и работы middleware.
- `REGISTRATION_MODE` - `open`, `invite`, `closed`.
- `INVITE_CODE` - используется в режиме `invite`.
- `MAX_USERS` - ограничение количества зарегистрированных пользователей.
- `COOKIE_SECURE` - `true` только под HTTPS.
- `SKIP_EMAIL_VERIFICATION=true` - опционально, если нужно убрать обязательную email-верификацию во временном окружении.

### AI

- `ANTHROPIC_API_KEY` - обязателен для всех AI-сценариев.
- `AI_MODEL` - общий override модели Claude для обоих уровней (обратная совместимость). Если задан, используется обоими уровнями, если для уровня не установлена собственная переменная. Примеры: `claude-sonnet-4-6`, `claude-haiku-4-5`.
- `AI_MODEL_SMART` - модель для сложных задач (декомпозиция целей, оценка периода, прогноз). Приоритет: `AI_MODEL_SMART` → `AI_MODEL` → `claude-sonnet-4-6` (встроенный fallback).
- `AI_MODEL_FAST` - модель для простых/частых задач (оценка дня, чат, проверка плана, обновление insights). Приоритет: `AI_MODEL_FAST` → `AI_MODEL` → `claude-haiku-4-5` (встроенный fallback).
- Anthropic SDK всегда использует официальный endpoint напрямую; proxy env/baseURL не поддерживаются.

### Шифрование и email

- `ENCRYPTION_KEY` - AES-256-GCM ключ для Prisma middleware.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` - нужны для email-верификации и сброса пароля. `EMAIL_FROM_NAME` - отображаемое имя отправителя (по умолчанию `mentorix`).

## Команды

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npx prisma generate
npx prisma db push
npx prisma migrate dev --name <name>
npx prisma studio
```

Что важно:

- `npm run build` уже включает `prisma generate`.
- Отдельного тестового раннера в `package.json` сейчас нет.
- После изменений опирайтесь на `lint`, `typecheck` и ручной smoke-check.

## Карта проекта

### Основные директории

- `app/` - страницы App Router и API routes.
- `components/` - UI, включая landing и цели.
- `hooks/` - основная клиентская бизнес-логика.
- `lib/` - auth, Prisma, encryption, audit, prompts, rate limiting, Anthropic client.
- `prisma/` - schema и migrations.
- `docs/` - спецификация, архитектура, деплой, developer docs, user guide.
- `deploy/`, `scripts/` - production deploy на Contabo и operational scripts; Cloudflare/Wrangler/Workers не используются.
- `cloudflare-proxy/`, `cloudflare-tg-proxy/` - сохранённые dormant Worker fallback-директории (`WORKER_ENABLED=false`, fail-closed 503), не production runtime.

### Ключевые страницы

- `/` - landing для гостей и dashboard для авторизованных.
- `/daily` - дневной workflow.
- `/goals` - иерархия целей и AI-декомпозиция.
- `/tasks` - backlog и архив.
- `/progress`, `/periods`, `/analytics`, `/history`, `/forecast`, `/profile`.

### Ключевые API-группы

- `app/api/auth/*` - регистрация, логин, logout, verify email, forgot/reset password.
- `app/api/daily/*` - дневные записи, индикаторы календаря, чат и сообщения чата.
- `app/api/evaluate/*` - оценка дня и batch-оценка.
- `app/api/evaluate-period` и `app/api/periods/*` - периодические оценки.
- `app/api/goals/*` - dream, year, tracked items, tags, move, decompose, planning-profile, year-evaluations.
- `app/api/tasks/*` - backlog, close/reopen/delete, обработка незакрытых задач.
- `app/api/facts/*` - журнал выполненной работы.
- `app/api/forecast`, `app/api/progress`, `app/api/analytics/*`, `app/api/profile/*`, `app/api/habits/*`.

## Аутентификация и безопасность

### Как работает auth

- Edge `middleware.ts` пропускает `/`, auth pages, auth API и `/api/health`.
- Для защищённых маршрутов middleware валидирует HMAC-подпись токена без обращения к БД.
- Полная проверка сессии и пользователя происходит в серверной логике `lib/auth.ts`.
- При `AUTH_ENABLED=false` почти весь продукт можно использовать без логина.

### Rate limits и lockout

Из `lib/rate-limit.ts`:

- auth: `5` запросов за `15` минут;
- recovery: `3` запроса за `15` минут;
- registration: `3` запроса за `1` час;
- AI endpoints: `10` запросов в минуту на пользователя;
- после `10` неудачных логинов email блокируется на `30` минут.

### Шифрование и аудит

- Прозрачное шифрование реализовано через `lib/encryption.ts` и `lib/prisma-encryption.ts`.
- Префикс `enc_v1:` означает уже зашифрованное значение.
- Для существующих данных есть скрипты:
  - `scripts/encrypt-existing-data.ts`
  - `scripts/encrypt-standalone.js`
  - `scripts/check-encryption.js`
- Prisma audit middleware пишет аудит write-операций.

## Текущая модель целей

Цели состоят из нескольких слоёв данных.

### 1. DreamGoal

- глобальная мечта;
- горизонт в месяцах.

### 2. YearGoal

- стратегические карточки по годам;
- живут отдельно от трекаемых задач и целей.

### 3. Goal

Это основной рабочий объект для месяцев, недель и иерархической декомпозиции. Важные поля:

- `periodType`, `periodKey` - к какому периоду относится цель;
- `scope` - контекст уровня;
- `priority`, `tags`, `completed`;
- `parentId` - связь с родительской целью;
- `rootYearGoalId` - связь с верхнеуровневой годовой целью.

### 4. PlanningProfile

Используется goals-chat для реалистичной декомпозиции:

- `hoursPerWeek`
- `experienceLevel`
- `hasBudget`
- `currentWorkload`
- `constraints`
- `declined`

### Где менять логику целей

- `app/goals/page.tsx` - orchestration страницы и page state `0/1/2`.
- `hooks/useGoals.ts` - загрузка и мутации.
- `hooks/useTrackedGoals.ts` - CRUD tracked goals и синхронизация completion.
- `hooks/useAcceptGoals.ts` - принятие AI-структуры с `parentId` и `rootYearGoalId`.
- `hooks/useGoalsChat.ts` - guided flow, extraction, profile markers.
- `hooks/useAutoSaveProfile.ts` - автосохранение planning profile и горизонта из чата.

Важно:

- автозавершение родительской цели есть, но реализовано на клиенте в `hooks/useTrackedGoals.ts`, а не триггером в БД;
- рядом с концом месяца goals page показывает wave rollover nudge для разбивки месяца по неделям или планирования следующего месяца.

## Дневной цикл и связанные данные

### Что хранится в daily entry

- `planText`
- `selectedTasksJson`
- `extraTasksJson`
- `factText`
- контекстные поля дня
- `planSnapshotJson`

### Что важно в реализации

- первый непустой сохранённый план формирует `planSnapshotJson`;
- именно snapshot используется при AI-оценке plan-vs-fact;
- черновики плана сохраняются локально как `daily:planDraft:<date>`;
- история чата дня грузится из БД через `/api/daily/chat/messages`, с localStorage fallback для совместимости;
- привычки больше не подставляются в план автоматически: пользователь добавляет их вручную через `+ Все в план` или по одной;
- незакрытые задачи перед оценкой обрабатываются через `app/api/tasks/process-uncompleted/route.ts`.

## AI-слой

### Где лежат промпты

- `lib/prompts/daily.ts`
- `lib/prompts/check-plan.ts`
- `lib/prompts/plan-chat.ts`
- `lib/prompts/forecast.ts`
- `lib/prompts/period.ts`
- `lib/prompts/goals-decompose.ts`

### Где лежит клиент Anthropic

`lib/anthropic.ts`:

- лениво инициализирует SDK;
- использует официальный Anthropic SDK endpoint напрямую, без proxy/baseURL;
- делает retry с экспоненциальной задержкой;
- превращает `429` в доменную ошибку с понятным текстом;
- шлёт Telegram-уведомление при финальном падении после ретраев.

### Что ещё логируется

- использование AI пишется в `AIUsage`;
- часть ошибок и auth-событий попадает в audit и Telegram.

## Темы и UI-ограничения

Инфраструктура тем есть:

- `lib/theme.ts`
- `app/api/profile/theme/route.ts`
- поле `themePreference` в `User`

Но текущий пользовательский UI зафиксирован в тёмной теме:

- `app/layout.tsx` рендерит `html` с классом `dark`;
- `components/ThemeToggle.tsx` возвращает `null`.

Если будете возвращать переключение темы в интерфейс, обновляйте и UI, и документацию.

## Production

- Основной compose: `docker-compose.production.yml`.
- Production environment ориентируется на `.env.production.example`.
- Единственный production — Contabo (`ssh contabo`, `/home/oleg/ai-assistant-spec`, `https://mentorix.aionlab.ru`).
- Anthropic и Telegram вызываются напрямую; deploy script не запускает `wrangler` и перед сборкой проверяет прямую доступность `api.anthropic.com`.
- Worker fallback-код хранится отключённым (`WORKER_ENABLED=false`) и не должен деплоиться без отдельного решения.
- Для шифрования в production нужен отдельный `ENCRYPTION_KEY`; использовать dev-ключ нельзя.
- При readonly-container сценарии для шифрования существующих данных применяется `scripts/encrypt-standalone.js`.

## Рекомендуемый smoke-check после изменений

1. Открыть `/` и убедиться, что гость видит landing, а пользователь - dashboard.
2. Проверить dream plus goals flow: создать мечту, годовые цели, tracked goals, AI-chat.
3. На `/daily` сохранить план, обновить страницу и убедиться, что черновик и snapshot ведут себя корректно.
4. Завершить день: модалка незакрытых задач, оценка, suggested tasks.
5. На `/tasks` проверить открытые задачи, архив и reopen.
6. На `/history` проверить календарь и вкладку `Сделано`.
7. На `/periods`, `/analytics`, `/forecast`, `/progress` убедиться, что отчёты строятся без `401` и `500`.
