# Security / Runtime / Architecture Review — AI Assistant

**Дата:** 2026-05-18  
**Источник:** сводный отчёт Copilot Agent по проекту AI Assistant / AION  
**Итого:** 8 критических · 12 высоких · 10 архитектурных · 10 runtime = **40 проблем**

---

## 🔴 CRITICAL — Security

| # | Проблема | Файл / область |
|---:|---|---|
| 1 | `AUTH_SECRET` не валидируется при старте — тихие сбои авторизации | `middleware.ts:71`, `app/api/auth/login/route.ts:87` |
| 2 | `ENCRYPTION_KEY` не обязателен в dev — данные хранятся открыто | `lib/encryption-config.ts:5-18` |
| 3 | Brute-force на токены сброса пароля — нет rate-limit + слабая энтропия токена | `app/api/auth/reset-password/route.ts:8-21` |
| 4 | Нет CSRF-защиты на всех POST/DELETE эндпоинтах | `app/api/daily/route.ts`, `app/api/goals/items/route.ts` |
| 5 | Секреты в `docker-compose` `environment:` — видны в логах и `docker inspect` | `docker-compose.production.yml:51-78` |
| 6 | Email-верификацию можно обойти — токен не протухает, нет лимита попыток | `app/api/auth/verify-email/route.ts:19-26` |
| 7 | Middleware bypass — часть API-роутов вне `matcher`, доступны без аутентификации | `middleware.ts:107-117` |
| 8 | Сессии не инвалидируются при logout полностью — нет ротации токенов | `lib/auth.ts:290-309` |

---

## 🟠 HIGH — Security

| # | Проблема | Файл / область |
|---:|---|---|
| 9 | Rate-limit в памяти (`new Map`) — не работает при >1 инстансе / DDoS | `lib/rate-limit.ts:52-94` |
| 10 | Telegram-уведомления отправляют email/IP пользователя открытым текстом | `lib/telegram.ts`, `lib/auth.ts:188` |
| 11 | Нет защиты от инъекций в динамических Prisma-запросах (`orderBy` из req) | `app/api/daily/route.ts:64-76` |
| 12 | Нет CSP-заголовка — XSS-риск | `next.config.js:6-20` |
| 13 | AI-эндпоинты без rate-limit — неконтролируемые расходы на API | `app/api/evaluate/route.ts:20-31` |
| 14 | `defaultRole` пользователя не валидируется — возможна эскалация прав | `lib/auth.ts:144` |
| 15 | Нет audit-лога для чувствительных операций: смена пароля, удаление | `lib/audit.ts:22-36` |
| 16 | Ротация `ENCRYPTION_KEY` невозможна — смена ключа делает все данные нечитаемыми | `lib/encryption.ts:9-25` |
| 17 | Нет валидации пагинации — `limit=100000` перегружает БД | `lib/pagination.ts`, `app/api/daily/route.ts:29` |
| 18 | Смена email без подтверждения пароля — риск захвата аккаунта | `lib/auth.ts` |
| 19 | Слабый device fingerprint в сессиях — нет привязки к IP/UA | `lib/auth.ts:290-309` |
| 20 | Отсутствуют `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` | `next.config.js` |

---

## 🟡 ARCHITECTURAL

| # | Проблема |
|---:|---|
| 21 | Шифрование вшито в Prisma middleware — нельзя тестировать/заменить независимо |
| 22 | Нет разделения AuthN / AuthZ — middleware только проверяет «залогинен ли», авторизация разбросана по роутам |
| 23 | Нет версионирования API — любой breaking change ломает клиентов |
| 24 | `checkNewLoginIp()` вызывается как fire-and-forget без `await` — ошибки теряются |
| 25 | Смешаны single-user и multi-user режимы — непредсказуемое поведение |
| 26 | Монолитный Prisma-клиент с несколькими middleware — трудно дебажить |
| 27 | Нет connection pooling: PgBouncer / Prisma Accelerate — проблемы при нагрузке |
| 28 | Prompt injection patterns — примитивный blacklist, легко обходится |
| 29 | Нет observability — ни Sentry, ни трейсинга, ни метрик |
| 30 | Нет API-документации: OpenAPI / Swagger |

---

## 🔵 RUNTIME

| # | Проблема | Файл / область |
|---:|---|---|
| 31 | `main()` в cleanup-скрипте без `.catch()` — unhandled rejection | `scripts/cleanup-expired.mjs:40-47` |
| 32 | Ошибка отправки email при регистрации не блокирует создание аккаунта — пользователь без верификации | `app/api/auth/register/route.ts:159` |
| 33 | `process.env.APP_URL` может быть `undefined` — генерация битых ссылок | `app/api/auth/register/route.ts:114` |
| 34 | Множество `process.env.VAR` без fallback — runtime crash при неполном `.env` | повсеместно |
| 35 | Транзакции без `catch` — неявные откаты, нет обработки ошибок | `app/api/daily/route.ts:74-95` |
| 36 | `pg_dump` в backup-скрипте без проверки кода возврата — тихо создаёт пустой бэкап | `scripts/prod-backup.sh:24` |
| 37 | Нет truncation полей перед вставкой в БД — возможен DoS через огромные строки | `app/api/daily/route.ts:12-20` |
| 38 | Риск infinite loop в иерархии Goal: рекурсивные родители без depth-check | `prisma/schema.prisma:145` |
| 39 | `lastSent = new Map` в Telegram dedup никогда не очищается — утечка памяти | `lib/telegram.ts:7` |
| 40 | `checkNewLoginIp` без try/catch — необработанное исключение кладёт поток | `lib/auth.ts:188-199` |

---

# План исправлений

## Этап 1 — Critical Security

Цель: закрыть риски, которые могут привести к обходу авторизации, утечке данных, brute-force или несанкционированным действиям.

| Приоритет | Пункты | Что сделать | Проверка |
|---|---|---|---|
| P0 | 1, 2 | Ввести строгую валидацию обязательных env-переменных при старте приложения | Приложение не стартует без `AUTH_SECRET` / `ENCRYPTION_KEY`; есть понятная ошибка |
| P0 | 7 | Проверить и расширить `middleware.matcher`, чтобы защищённые API не обходили middleware | Запросы к защищённым API без сессии возвращают 401/redirect |
| P0 | 3, 6 | Добавить TTL, rate-limit и безопасную энтропию для reset/email tokens | Повторные попытки ограничены; просроченные токены не работают |
| P1 | 4 | Добавить CSRF-защиту для state-changing эндпоинтов | POST/DELETE без CSRF-токена отклоняются |
| P1 | 5 | Убрать секреты из `docker-compose.production.yml` в secrets/env-file подход | `docker inspect` не показывает секреты в открытом виде |
| P1 | 8 | Улучшить logout/session invalidation и ротацию токенов | После logout старая сессия не работает |

---

## Этап 2 — High Security

Цель: закрыть эксплуатационные риски, XSS/DoS, эскалацию прав и избыточное раскрытие данных.

| Приоритет | Пункты | Что сделать | Проверка |
|---|---|---|---|
| P1 | 9, 13 | Вынести rate-limit из памяти в Redis/Upstash/аналог, отдельно лимитировать AI endpoints | Несколько инстансов видят общий лимит; AI API защищён от спама |
| P1 | 12, 20 | Добавить security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Проверить headers через `curl -I` |
| P1 | 11, 17 | Валидировать `orderBy`, `limit`, `page`, сортировки и пагинацию | Невалидные параметры отклоняются |
| P2 | 14, 18 | Валидировать роли и критичные изменения аккаунта через пароль/подтверждение | Нельзя назначить произвольную роль или сменить email без подтверждения |
| P2 | 10, 15 | Маскировать PII в Telegram и добавить audit-log чувствительных операций | В логах/уведомлениях нет открытых email/IP без необходимости |
| P2 | 16, 19 | Спроектировать ротацию ключей и усилить модель сессий/device fingerprint | Есть план миграции ключей и минимальная защита сессий |

---

## Этап 3 — Runtime Stability

Цель: убрать тихие сбои, невалидные env, неработающие backup/cleanup и DoS через данные.

| Приоритет | Пункты | Что сделать | Проверка |
|---|---|---|---|
| P1 | 33, 34 | Централизованно валидировать env через schema/config module | Неполный `.env` даёт понятную ошибку при старте |
| P1 | 31, 36 | Добавить обработку ошибок в cleanup и backup scripts | Скрипты завершаются с кодом ошибки при сбое |
| P2 | 32 | Решить политику регистрации при сбое email: блокировать аккаунт или ставить pending state | Пользователь не получает активный аккаунт без верификации |
| P2 | 35 | Обернуть транзакции в явную обработку ошибок | Ошибки логируются и возвращаются корректно |
| P2 | 37, 38, 39, 40 | Ограничить длины строк, depth-check иерархий, очистку Map, try/catch для async hooks | Нет memory leak / infinite loop / падения потока |

---

## Этап 4 — Architecture

Цель: снизить сложность поддержки и подготовить проект к росту.

| Приоритет | Пункты | Что сделать | Проверка |
|---|---|---|---|
| P2 | 21, 26 | Вынести шифрование из Prisma middleware в отдельный сервис/слой | Сервис тестируется отдельно, Prisma-клиент проще |
| P2 | 22 | Разделить AuthN и AuthZ: кто залогинен vs что имеет право делать | У роутов есть явные проверки прав |
| P3 | 23, 30 | Ввести API versioning и документацию OpenAPI/Swagger | Есть `/api/v1`, схема endpoints описана |
| P3 | 24, 29 | Добавить observability: Sentry/logging/tracing/metrics | Ошибки не теряются, видны в мониторинге |
| P3 | 25, 27, 28 | Разделить режимы single/multi-user, connection pooling, улучшить prompt-injection defense | Поведение режимов документировано, нагрузка БД стабильнее |

---

# Рекомендуемый порядок работы с Copilot Agent

1. Работать только из основной папки проекта.
2. Перед каждым этапом выполнять:
   ```bash
   git status
   ```
3. Не давать команду «исправь всё».
4. Давать агенту задачу на один пункт или небольшой связанный блок.
5. После правок проверять:
   ```bash
   git diff
   npm run lint
   npm run typecheck
   npm test
   ```
6. Коммитить каждый логический блок отдельно.

---

# Безопасный стартовый промпт для Copilot Agent

```text
Работай только в текущей папке проекта.
Worktree не создавай.
Перед изменениями покажи план.
Исправляй только указанный пункт из security-review-plan.md.
Не меняй UI и unrelated-файлы.
После изменений покажи список изменённых файлов, diff summary и команды проверки.
```
