# ROADMAP: Задачи на будущее

> Статусы сверены с кодом 2026-07-30. Предыдущая сверка — 16 февраля 2026.
> Каждый закрытый пункт подтверждён ссылкой на файл; пункты, потерявшие смысл,
> вынесены в раздел «Отменено» с причиной, а не удалены молча.

---

## 📌 Приоритеты

| Уровень | Описание |
|---------|----------|
| 🔴 Критично | Нужно для production |
| 🟡 Важно | Улучшит UX/DX значительно |
| 🟢 Желательно | Nice to have |
| 🔵 Идея | На обсуждение |

---

## 🔴 КРИТИЧНО (для production)

### Безопасность

- [ ] **CSRF protection** — для form submissions
  - Подтверждено 2026-07-30: упоминаний CSRF в `app/`, `components/`, `hooks/`, `lib/` нет ни одного.
  - Частичная защита уже есть: session-cookie выставляется с `sameSite` в `app/api/auth/login|logout|me|register|verify-email/route.ts`.
  - Остаётся решить, нужен ли токен-based CSRF поверх `sameSite`, или текущей защиты достаточно.

- [ ] **Санитизация ключей goal-map в `/api/goals/decompose`**
  - Найдено при ревью коммита `7c43ce1`. Значения целей санитизируются, а **ключи** периодов — нет:
    `z.record(z.string(), …)` не ограничивает ключ ни по длине, ни по содержимому
    (`app/api/goals/decompose/route.ts`), и ключ интерполируется в системный промпт сырым
    (`lib/prompts/goals-decompose.ts:159,167`).
  - Остаточная поверхность prompt-injection того же класса, что закрыли для значений.

- [ ] **Единая обработка `AuthError` в роутах** — сейчас 401 подменяется на 500
  - Найдено при написании контрактных тестов (коммит `27f2528`), подтверждено независимым ревью.
  - `requireAuth` бросает `AuthError('Unauthorized', 401)` (`lib/auth.ts:462-468`, класс `:480-488`).
  - Роуты **без** проверки `instanceof AuthError` — ошибка падает в общий catch и отдаёт 500:
    `app/api/goals/move/route.ts:60-63`, `app/api/tasks/[id]/route.ts:40-43`,
    `app/api/tasks/[id]/close/route.ts:34-37`, `app/api/tasks/[id]/delete/route.ts:33-36`,
    `app/api/tasks/[id]/reopen/route.ts:33-36`, `app/api/tasks/process-uncompleted/route.ts:155-161`.
  - Образец корректной обработки: `app/api/daily/chat/route.ts:714-717`, `app/api/goals/items/route.ts:66-76`.

- [ ] **Zod-валидация в `/api/tasks/process-uncompleted`**
  - `app/api/tasks/process-uncompleted/route.ts:41-46` — ручная проверка только `decisions`,
    без `safeParse`, без валидации `sourceDate` и структуры `decisions[].action`.
  - Ответ `{ error: 'decisions array required' }` не соответствует стандартной форме
    `{ error: 'Validation failed', details }` из `AGENTS.md`.

### Инфраструктура

- [ ] **Proper logging** — структурированные логи (winston/pino)
  - Подтверждено: ни `pino`, ни `winston` не входят в зависимости; в коде только `console.log/error`.

- [ ] **Error tracking** — Sentry или аналог
  - Подтверждено: Sentry SDK в зависимостях отсутствует.

- [ ] **CI/CD** — GitHub Actions для автодеплоя
  - Подтверждено: каталога `.github/workflows/` в репозитории нет.

---

## 🟡 ВАЖНО

### Архитектура

- [ ] **Разбить контроллер ежедневника** — частично сделано, основная работа осталась
  - Сделано: `hooks/useDaily.ts` теперь тонкий фасад (re-export), логика вынесена в `hooks/daily/`,
    где 14 модулей — `chat-helpers`, `schedule-helpers`, `proposal-helpers`, `phase-helpers`,
    `plan-draft`, `stream-consumer`, `task-helpers`, `list-lens-helpers` и другие.
  - Не сделано: `hooks/daily/useDailyController.ts` по-прежнему монолит на 1125 строк.
  - Исходная формулировка предлагала деление на `useDailyPlan` / `useDailyChat` /
    `useDailyEvaluation` / `useDailyHabits` — решить, актуально ли оно после выделения хелперов.

- [ ] **Распил `app/daily/page.tsx`** — 2383 строки в одном клиентском компоненте
  - Крупнейший файл проекта и хотспот багов: правки ежедневника доминируют в истории коммитов.
  - Кандидаты на выделение видны по JSX-маркерам: контекст периодов, виджеты «Сделано за
    неделю/месяц», блок привычек, выполненные задачи, панель действий, чат.

- [ ] **Service layer** — вынести бизнес-логику из API routes
  - Подтверждено: каталога `lib/services/` нет, логика живёт в роутах.

### Приватность данных

- [ ] **Экспорт данных пользователя** — JSON/ZIP с полным дампом
  - Подтверждено: роута `app/api/profile/export` нет.
  - Страница: `/profile` → кнопка «Скачать мои данные»; API: `GET /api/profile/export`.

- [ ] **Удаление аккаунта** — с cascade delete всех данных
  - Подтверждено: роута удаления аккаунта нет (`app/api/auth/` содержит только forgot-password,
    login, logout, me, onboarding, register, resend-verification, reset-password, verify-email).
  - В схеме есть soft-delete `User.deletedAt`, но пользовательского пути к нему нет.

- [ ] **E2E шифрование чатов** (будущее)
  - Сейчас есть шифрование at rest (`lib/encryption.ts`, AES-256-GCM, ключ в `ENCRYPTION_KEY`),
    но ключ серверный. E2E требует ключа, производного от пароля пользователя (PBKDF2).

### UX

- [ ] **PWA и offline mode**
  - Вопрос «`manifest.json` уже есть?» из прежней редакции закрыт: **нет**, ни в `public/`, ни в `app/`.
  - Service Worker и IndexedDB тоже отсутствуют.

- [ ] **Пользовательские уведомления** — напоминания о планировании и оценке
  - Telegram-интеграция существует, но она **административная**: `lib/telegram.ts` (33 строки) —
    это `notifyTelegram(text, dedupeKey)` с дедупликацией «не чаще 1 сообщения на тип ошибки
    в 5 минут», используется в `lib/auth.ts`, `lib/anthropic.ts`, `app/api/auth/register/route.ts`
    для алертов владельцу, а не для общения с пользователем.
  - Пользовательские напоминания — отдельная задача поверх этого модуля.

---

## 🟢 ЖЕЛАТЕЛЬНО

### Фичи

- [ ] **Админ-панель** `/admin` — список пользователей, статистика AI, управление доступом
  - Подтверждено: ни `app/admin/`, ни `app/api/admin/` не существует.
  - Заготовки в коде есть: `requireAdmin` и `createInitialAdmin` в `lib/auth.ts` числятся
    среди экспортов без внешних ссылок (см. «Мёртвый код» в `docs/CODEBASE_MAP.md`).

- [ ] **Keyboard shortcuts** — для power users
  - `Cmd+Enter` — сохранить, `Cmd+K` — открыть чат.

### Интеграции

- [ ] **Google Calendar** — sync задач
- [ ] **Telegram** — пользовательские напоминания (см. раздел UX выше)
- [ ] **Notion** — экспорт/импорт

### Тестирование

- [ ] **E2E tests** — Playwright для критичных flows
  - Playwright сейчас используется только агентами для визуальной приёмки через MCP;
    ни одного E2E-теста в `tests/` нет.

- [ ] **Расширить контрактные тесты API** — покрыто 10 роутов из 55
  - Покрыты: `daily/chat`, `daily/schedule`, `daily/schedule/apply-proposal`, `goals/decompose`,
    `goals/items`, `goals/move`, `tasks/[id]`, `tasks/[id]/close|delete|reopen`,
    `tasks/process-uncompleted`.
  - Ближайшая очередь: `evaluate` и `evaluate/batch` (331 и 430 строк, требуют мокинга AI).

---

## 🔵 ИДЕИ

### AI
- [ ] **Голосовой ввод** — диктовка плана на день
- [ ] **AI на клиенте** — WebLLM для приватности
- [ ] **Персонализация AI** — частично уже работает: `UserInsights` / `InsightEntry` накапливают
  профиль и подставляются обратно в планирование. Идея в исходной формулировке — «обучение
  на истории» — сверх этого не реализована.

### Gamification
- [ ] **Achievements** — достижения за streaks
- [ ] **Leaderboard** — сравнение с друзьями (opt-in)

### Монетизация
- [ ] **Premium tier** — больше AI запросов
  - Учёт расхода уже есть (`lib/ai-usage.ts`, модель `AIUsage`), но лимитов по тарифу нет.
- [ ] **Self-hosted license** — для enterprise

---

## ❌ ОТМЕНЕНО

Пункты, потерявшие смысл. Оставлены с причиной, чтобы их не завели заново.

- **Темы оформления (sepia, high contrast)** и переключение light/dark.
  Продукт жёстко тёмный: `components/ThemeProvider.tsx` — заглушка на 38 строк, возвращает
  захардкоженный `'dark'`, а `setTheme`/`toggleTheme` пустые. `SPECIFICATION.md` всё ещё описывает
  переключение темы — это расхождение зафиксировано в `docs/CODEBASE_MAP.md`.
  Побочный след: роут `/api/profile/theme` пишет `themePreference` в БД, но фронтендом не вызывается.

- **Markdown в заметках.** Противоречит продуктовому решению: промпты явно запрещают markdown —
  `lib/prompts/goals-decompose.ts:567`, `lib/prompts/goals-validate.ts:57`, `lib/prompts/plan-chat.ts:327`.
  Продукт работает с plain text.

---

## ✅ ВЫПОЛНЕНО

### Июль 2026
- [x] **Анти-injection санитизация в `/api/goals/decompose`** — коммит `7c43ce1`.
  `sanitizeUserInput` применяется к `message`, `context.dream`, строкам целей и истории чата,
  строго до `clampText`, чтобы лимиты длины продолжали держаться.
- [x] **Контрактные тесты роутов goals и tasks** — коммит `27f2528`, 7 файлов, 33 теста.
  Покрыты 401/400/404-ownership и happy path; ассерты на Prisma сравнивают `where` точно,
  поэтому исчезновение фильтра `userId` роняет тест.
- [x] **Карта кодовой базы** — `docs/CODEBASE_MAP.md`, составлена по факту кода.

### Ранее
- [x] **Backup strategy** — автоматические бэкапы БД. `scripts/prod-backup.sh`: crond ежедневно
  в 03:00 плюс один прогон при старте контейнера, вывод шифруется ключом из
  `/run/secrets/backup-key`; отдельный backup-сервис в `docker-compose.production.yml`.
- [x] **Unit tests** — сделано на **Vitest**, а не на Jest как предполагала прежняя редакция.
  55 файлов, 464 теста.
- [x] **Rate limiting на API endpoints** — nginx (`general_limit` 60r/s burst 30) плюс app-level
  `lib/rate-limit.ts`.
- [x] **Health check endpoint** — `app/api/health/route.ts`.
- [x] **Drag & drop** — нативный HTML5 drag: `components/goals/WeekCard.tsx`,
  `components/daily/DayTimeline.tsx`, `app/daily/page.tsx`.
- [x] **Миграция на PostgreSQL** (28.01.2026), **Contabo деплой**, **SSL Let's Encrypt**,
  **systemd автозапуск**, **email-верификация**, **открытая регистрация**.
- [x] **Редизайн страницы Целей** (март 2026) — TimelineNav, WeekStrip, плоские компоненты.
- [x] Чаты в БД вместо localStorage, персист чата по датам, `UncompletedTasksModal`,
  AuthGuard, middleware, локальный Docker-деплой (январь 2026).

---

## 📝 ЗАМЕТКИ

### Технический долг

1. **Prisma migrations — прежняя заметка была неверной.** Утверждение «есть проблема с shadow DB,
   используем `db push`» верно только для локальной разработки: `scripts/start-local.sh:121`.
   В репозитории **28 каталогов миграций**, в каждом `migration.sql`, плюс `migration_lock.toml`.
   Production применяет их штатно и fail-closed: `docker-entrypoint.sh:8` выполняет
   `prisma migrate deploy` и отказывается стартовать при ошибке («refusing to start»).
2. **TypeScript strict — закрыто.** В `tsconfig.json` установлен `"strict": true`, `npm run typecheck` зелёный.
3. **ESLint warnings** — осталось 9 предупреждений `react-hooks/exhaustive-deps`
   (analytics, evaluation/[date], history, periods/[id], tasks, StrategyCards, WeekCard,
   useDailyController, useGoals). Это baseline, ошибок нет.
4. Полный перечень долга — `docs/CODEBASE_MAP.md`, раздел 8: дублирующая загрузка эндпоинтов,
   долг сырого `fetch` вместо `fetchJson`, rate limit в памяти процесса, мёртвый код в `lib/`.

### Зависимости

- Next.js 16.2.4, React 19, TypeScript 5.7, Zod 4.1, Vitest 4.1.
- Prisma 5.22.0 → 7.x — major update, обновлять осторожно и отдельной задачей.

### Для деплоя

- [x] Production-сервер (Contabo), SSL, systemd, cron-бэкапы БД.
- [ ] CI/CD (GitHub Actions).
- [ ] Docker image optimization — сейчас 3-stage сборка, non-root, read-only fs.
