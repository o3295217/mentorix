<!-- markdownlint-disable MD007 MD010 MD013 MD024 -->

# Техлог реализации плана код-ревью

> Старт работ: 1 мая 2026
> План: [CODE_REVIEW_ACTION_PLAN_2026-05-01.md](./CODE_REVIEW_ACTION_PLAN_2026-05-01.md)

---

## A1 — Обновить Next.js и production-зависимости с critical advisory

**Статус:** выполнено по production audit; lint-остатки вынесены в A7

### Цель

Закрыть critical/high findings из `npm audit --omit=dev`, в первую очередь Next.js advisory, и вернуть проект к проверяемой baseline-точке.

### Исходное состояние

- `npm audit --omit=dev` завершался с code `1`.
- `next`: `16.0.1`.
- `@types/nodemailer` был в `dependencies`, из-за чего production audit видел AWS SDK цепочку с vulnerable `fast-xml-parser`.
- `nodemailer`: `7.0.12`.
- `lodash` попадал через `recharts`.

### Сделано

- Создан техлог реализации.
- Обновлён `next`: `16.0.1` -> `16.2.4`.
- Обновлён `eslint-config-next`: `16.0.1` -> `16.2.4`.
- Обновлён `nodemailer`: `7.0.12` -> `8.0.7`.
- `@types/nodemailer` перенесён из `dependencies` в `devDependencies`, чтобы dev-only AWS SDK цепочка не попадала в production dependency graph.
- `postcss` закреплён на `8.5.10`.
- Добавлены npm overrides:
	- `lodash`: `4.18.1` для transitive dependency через `recharts`.
	- `postcss`: `8.5.10` для nested dependency внутри Next.js.
- Обновлён `package-lock.json` через `npm install`.

### Проверки

- `npm ls next nodemailer fast-xml-parser lodash postcss --depth=4` — подтвердил цепочки зависимостей перед обновлением.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- `npm run typecheck` — успешно.
- `npm run lint` — остаётся красным по уже известным A7-пунктам:
	- `lib/prisma-audit.ts`: forbidden `require()` import.
	- `components/goals/GoalsChatPanel.tsx`: unused `MONTH_NAMES` warning.
- `npm run build` — успешно на Next.js `16.2.4`.

### Замечания после build

- Next.js предупреждает, что convention `middleware` deprecated и нужно перейти на `proxy`.
- Browserslist/caniuse-lite data устарели.
- Edge runtime warning сохраняется, но сборку не блокирует.

### Остаточные риски

- Полный `npm audit` без `--omit=dev` показывает 6 dev-only vulnerabilities (`brace-expansion`, `flatted`, `minimatch`, `picomatch`, `yaml`). Production audit чистый, поэтому A1 закрыт как production security fix. Dev-only audit стоит обработать отдельным техдолгом или при настройке quality gate.
- Smoke-сценарии auth/daily/goals/evaluate/forecast перед деплоем ещё не выполнялись.

### Следующий шаг

- Перейти к A2: secure cookies fail-safe для production.

---

## A2 — Secure cookies fail-safe для production

**Статус:** выполнено

### Цель

Исключить ситуацию, когда production окружение по умолчанию или из-за ошибочной конфигурации выставляет session/theme cookies без `Secure`.

### Исходное состояние

- `docker-compose.production.yml` задавал `COOKIE_SECURE=${COOKIE_SECURE:-false}`.
- Auth routes и theme route проверяли secure-флаг локально через `process.env.COOKIE_SECURE === 'true'`.
- Единой fail-safe политики для cookie security не было.

### Сделано

- Добавлен общий helper `lib/cookie-security.ts`:
	- `shouldUseSecureCookies()` возвращает `true` в `NODE_ENV=production` или при `COOKIE_SECURE=true`.
	- `assertSecureCookieConfig()` падает, если `NODE_ENV=production` и `COOKIE_SECURE=false`.
- Добавлен `instrumentation.ts`, который вызывает `assertSecureCookieConfig()` при старте Next.js runtime.
- `docker-compose.production.yml` изменён на `COOKIE_SECURE=${COOKIE_SECURE:-true}`.
- `.env.production.example` дополнен `COOKIE_SECURE=true`.
- Cookie-setting routes переведены на общий helper:
	- `app/api/auth/login/route.ts`
	- `app/api/auth/register/route.ts`
	- `app/api/auth/verify-email/route.ts`
	- `app/api/auth/logout/route.ts`
	- `app/api/auth/me/route.ts`
	- `app/api/profile/theme/route.ts`

### Проверки

- `rg "COOKIE_SECURE === 'true'|COOKIE_SECURE === \"true\"|process\.env\.COOKIE_SECURE" app lib middleware.ts instrumentation.ts` — прямые проверки остались только внутри helper.
- `npm run typecheck` — успешно.
- `npm run lint` — без новых A2-ошибок; остаются прежние A7-пункты:
	- `lib/prisma-audit.ts`: forbidden `require()` import.
	- `components/goals/GoalsChatPanel.tsx`: unused `MONTH_NAMES` warning.
- `npm run build` — успешно.
- `NODE_ENV=production COOKIE_SECURE=false npx tsx -e "import { shouldUseSecureCookies } from './lib/cookie-security'; shouldUseSecureCookies()"` — ожидаемо падает с `COOKIE_SECURE=false is not allowed when NODE_ENV=production`.
- `NODE_ENV=production npx tsx -e "import { shouldUseSecureCookies } from './lib/cookie-security'; console.log(shouldUseSecureCookies())"` — печатает `true`.

### Остаточные риски

- Перед production deploy нужно убедиться, что внешний reverse proxy действительно отдаёт приложение по HTTPS, иначе browser не будет отправлять Secure cookies по HTTP.

### Следующий шаг

- Перейти к A3: исправить Prisma audit context и убрать lint-блокирующий `require()`.

---

## A3 — Исправить Prisma audit context

**Статус:** выполнено

### Цель

Сделать audit middleware безопасным для параллельных запросов и убрать lint-блокирующий `require('./prisma')`.

### Исходное состояние

- `lib/prisma-audit.ts` хранил request context в глобальной переменной `currentRequestContext`.
- `setAuditContext()` вызывался только из `requireAuth()`, поэтому routes через `getUserId()` / `getAuthUser()` могли писать audit log без `userId`, `ipAddress`, `userAgent`.
- Для записи audit log middleware использовал `require('./prisma')`, что ломало `npm run lint` правилом `@typescript-eslint/no-require-imports`.

### Сделано

- `currentRequestContext` заменён на `AsyncLocalStorage` в `lib/prisma-audit.ts`.
- Добавлены функции:
	- `setAuditContext(ctx)` — записывает request-local audit context.
	- `getAuditRequestContext()` — читает context внутри Prisma middleware.
- `auditMiddleware` заменён на factory `createAuditMiddleware(db)`, чтобы писать `AuditLog` через текущий Prisma client без циклического `require()`.
- `lib/prisma.ts` теперь подключает `client.$use(createAuditMiddleware(client))`.
- `getAuthUser(request)` теперь выставляет audit context после успешной валидации сессии. Это покрывает и `requireAuth()`, и routes, которые используют `getUserId()` / прямой `getAuthUser()`.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — больше нет ошибки в `lib/prisma-audit.ts`; остался только warning A7 по `MONTH_NAMES`.
- `npm run build` — успешно.
- `rg "require\(|currentRequestContext" lib/**/*.{ts,tsx}` — совпадений нет.
- Ручная проверка изоляции двух параллельных async flows:
	- команда с `setAuditContext({ userId })`, разными задержками и `Promise.all()` вывела `user-b:user-b` и `user-a:user-a`.
	- Это подтверждает, что context не перетирается между параллельными ветками.

### Остаточные риски

- Для полной end-to-end проверки нужен реальный защищённый API write-запрос с валидной сессией и проверка записи `AuditLog` в БД. Локально не запускалось, чтобы не создавать тестовые пользовательские данные.

### Следующий шаг

- Быстро закрыть A7 warning по `MONTH_NAMES`, чтобы `npm run lint` был полностью чистым, затем перейти к A4.

---

## A7 — Привести lint к зелёному состоянию

**Статус:** выполнено досрочно после A3

### Цель

Вернуть `npm run lint` в полностью чистое состояние, чтобы он снова был usable quality gate.

### Сделано

- Ошибка `require()` в `lib/prisma-audit.ts` закрыта в рамках A3.
- Удалён неиспользуемый импорт `MONTH_NAMES` из `components/goals/GoalsChatPanel.tsx`.

### Проверки

- `npm run lint` — успешно, без warning.
- `npm run typecheck` — успешно.
- `npm run build` — успешно.

### Следующий шаг

- Перейти к A4: исправить расшифровку вложенных Prisma relations.

---

## A4 — Исправить расшифровку вложенных Prisma relations

**Статус:** выполнено

### Цель

Расшифровывать encrypted поля во вложенных Prisma relations, включая plural keys вроде `categories`, `items`, `children`, где прежняя логика `capitalize(key)` не могла определить модель.

### Исходное состояние

- `decryptResult()` пытался определить вложенную модель через `capitalize(key)`.
- Для `ProfileBlock.findMany({ include: { categories: { include: { items: true } }, items: true } })` ключи `categories` и `items` не совпадали с моделями `ProfileCategory` и `ProfileItem`.
- Если корневая модель сама не имела encrypted fields, middleware полностью пропускал результат и не расшифровывал вложенные encrypted relations.

### Сделано

- В `lib/prisma-encryption.ts` добавлена явная карта `RELATION_MODEL_BY_MODEL`.
- `decryptResult(model, result)` теперь определяет вложенную модель через `getRelationModel(model, relationKey)`.
- Добавлены связи для основных encrypted relations:
	- `User` -> `profileBlocks`, `dailyEntries`, `goals`, `openTasks`, `planningProfile` и другие encrypted child relations.
	- `DailyEntry` -> `evaluation`.
	- `Evaluation` -> `dailyEntry`.
	- `Goal` -> `parent`, `children`.
	- `ProfileBlock` -> `categories`, `items`.
	- `ProfileCategory` -> `block`, `items`.
	- `ProfileItem` -> `block`, `category`.
- Middleware теперь не пропускает read-запросы по нешифруемому parent model, если у него есть relation map. Это нужно для будущих `User.include` сценариев.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- Ручной middleware-тест без БД: encrypted `ProfileBlock.categories.items` после `encryptionMiddleware` вернулся как plaintext `Block`, `Category`, `Name`, `Value`, `Content`.
- Ручной middleware-тест без БД: encrypted `User.profileBlocks.items` тоже вернулся plaintext, хотя `User` сам не имеет encrypted fields.

### Остаточные риски

- Для новых Prisma relations карту нужно пополнять вручную, если relation содержит encrypted model. Это осознанный trade-off ради предсказуемости вместо fragile singular/plural guessing.
- End-to-end проверка через реальную БД не выполнялась, чтобы не создавать тестовые profile records в пользовательских данных.

### Следующий шаг

- Перейти к A5: хранить reset/email verification токены только в хешированном виде.

---

## A5 — Хранить reset/email verification токены только в хешированном виде

**Статус:** выполнено

### Цель

Убрать хранение raw password reset и email verification токенов в базе. Пользователь продолжает получать raw token в ссылке, но в БД сохраняется только SHA-256 hash.

### Исходное состояние

- `PasswordResetToken.token` сохранял raw token из ссылки сброса пароля.
- `EmailVerificationToken.token` сохранял raw token из ссылки подтверждения email.
- Поиск токенов в `reset-password` и `verifyEmailToken()` выполнялся по raw token.
- Сессионные токены уже были защищены через `hashToken(token)`.

### Сделано

- `hashToken(token)` экспортирован из `lib/auth.ts` для повторного использования.
- `createEmailVerificationToken()` теперь сохраняет `hashToken(token)`, а возвращает raw token только вызывающему коду для email-ссылки.
- `verifyEmailToken(token)` ищет запись по `hashToken(token)`.
- `app/api/auth/forgot-password/route.ts` теперь сохраняет hash reset token, а raw token использует только в email-ссылке.
- `app/api/auth/reset-password/route.ts` в GET и POST ищет reset token по `hashToken(token)`.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- Ручная проверка `hashToken()` показала 64-символьный hash, отличный от raw token.
- Поиск по коду не нашёл оставшихся `where: { token }` или `token: token` для auth token records.

### Остаточные риски

- Старые reset/verification ссылки, созданные до этого изменения, перестанут проходить lookup, потому что раньше в БД лежал raw token. Пользователь может запросить новую ссылку; при этом старые неиспользованные токены удаляются.
- Схема Prisma не переименована с `token` на `tokenHash`, чтобы не делать отдельную миграцию в рамках этого шага. Семантика поля теперь: hash от token.

### Следующий шаг

- Перейти к A6: ограничить диапазоны AI period/forecast endpoints.

---

## A6 — Ограничить диапазоны AI period/forecast endpoints

**Статус:** выполнено

### Цель

Не позволять API-запросам к AI endpoints загружать и отправлять в Anthropic чрезмерно большие диапазоны дат. Это снижает риск дорогих/длинных запросов, больших prompt payload и случайной обработки слишком большого объёма пользовательских данных.

### Исходное состояние

- `app/api/evaluate-period/route.ts` принимал `periodStart` и `periodEnd`, парсил даты и сразу загружал все `DailyEntry` за диапазон.
- `app/api/forecast/route.ts` принимал base period и forecast horizon, но не ограничивал длину base/horizon ranges.
- Некорректные даты могли превращаться в `Invalid Date` и доходить до Prisma/AI-подготовки.

### Сделано

- В `lib/dates.ts` добавлен `validateAiDateRange()`.
- Валидатор проверяет:
	- валидность `startDate`/`endDate`,
	- порядок `startDate <= endDate`,
	- максимум дней по типу периода.
- Лимиты:
	- `week`: 8 дней,
	- `month`: 32 дня,
	- `quarter`: 93 дня,
	- `year`: 367 дней,
	- `custom`: 367 дней.
- `evaluate-period` теперь валидирует period range до загрузки дневников и до вызова AI.
- `forecast` теперь валидирует base period и non-dream horizon range до загрузки данных и до вызова AI.

### Проверки

- `npm run typecheck` — успешно после явного guard для `horizonStartDate`.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- Ручная проверка `validateAiDateRange()`:
	- год `2026-01-01` — `2026-12-31` проходит,
	- custom range больше года отклоняется,
	- перевёрнутый week range отклоняется.

### Остаточные риски

- Лимиты выбраны консервативно с небольшим запасом под inclusive даты и timezone/DST эффекты. Если продуктово понадобится multi-year custom analytics, для неё лучше делать отдельный endpoint с pagination/aggregation, а не расширять AI prompt напрямую.
- В UI `forecast` есть состояние `custom` для горизонта, но backend schema его не принимает и до этого шага. Это не менялось в рамках A6, потому что задача была про server-side safety limits.

### Следующий шаг

- Все пункты Copilot-дополнения A1-A7 закрыты. Дальше можно переходить к исходному плану 1-33 по приоритетам.

---

## P0 #1 — Шифрование production-бэкапов БД

**Статус:** выполнено

### Цель

Исключить создание новых plaintext PostgreSQL backup-файлов в `./backups/` и документировать восстановление из зашифрованного дампа.

### Исходное состояние

- `scripts/prod-backup.sh` писал `pg_dump --no-owner --no-acl | gzip > pg_*.sql.gz`.
- Backup-контейнер `ai-assistant-backup` не получал отдельный secret/key для шифрования.
- `docs/DEPLOY.md` описывал восстановление через `gunzip -c backups/pg_*.sql.gz`.

### Сделано

- `scripts/prod-backup.sh` теперь пишет только `pg_*.sql.gz.enc`.
- Добавлено шифрование через:
	- `openssl enc -aes-256-cbc`,
	- `-salt`,
	- `-pbkdf2`,
	- `-iter 200000`,
	- `-md sha256`.
- Скрипт проверяет, что key file существует и не пустой, до запуска `pg_dump`.
- Включён `pipefail`, чтобы ошибка `pg_dump`, `gzip` или `openssl` не маскировалась успешным последним шагом.
- `BACKUP_DIR`, `BACKUP_KEY_FILE` и `MAX_BACKUPS` сделаны переопределяемыми через env для безопасной проверки и будущей эксплуатации.
- Retention теперь удаляет только старые `pg_*.sql.gz.enc` и не трогает старые plaintext backups автоматически.
- `docker-compose.production.yml` монтирует ключ с хоста:
	- `${BACKUP_KEY_FILE:-/home/oleg/.backup-key}` -> `/run/secrets/backup-key:ro`.
- Cron env теперь сохраняет `PG*` и `BACKUP_*` переменные в `/run/pg.env`.
- `docs/DEPLOY.md` дополнен генерацией `/home/oleg/.backup-key`, описанием encrypted backups и командой восстановления.
- `docs/INFRASTRUCTURE.md` синхронизирован с новой схемой backup/restore.

### Проверки

- `sh -n scripts/prod-backup.sh` — успешно.
- `POSTGRES_PASSWORD=dummy AUTH_SECRET=dummy docker compose -f docker-compose.production.yml config --quiet` — успешно.
- Dry-run без реальной БД:
	- временный fake `pg_dump` вывел `select 1;`,
	- `prod-backup.sh` создал `pg_*.sql.gz.enc`,
	- команда восстановления `openssl enc -d ... | gunzip` вернула исходный `select 1;`.
- Поиск старых `.sql.gz` путей показал только осознанное упоминание legacy plaintext backups и новый pattern `.sql.gz.enc`.

### Остаточные риски

- Старые `backups/pg_*.sql.gz`, созданные до включения шифрования, остаются незашифрованными. Их нужно вручную удалить или зашифровать после проверки новых `.sql.gz.enc` бэкапов.
- Перед production restart на сервере должен существовать `/home/oleg/.backup-key`; иначе backup-контейнер не сможет создавать новые бэкапы и запишет понятную ошибку в `backup.log`.

### Следующий шаг

- Перейти к P0 #2: добавить `ENCRYPTION_KEY` в `.env.production.example` и проверить fail-fast поведение шифрования.

---

## P0 #2 — Обязательный ENCRYPTION_KEY и fail-fast конфигурация

**Статус:** выполнено

### Цель

Сделать `ENCRYPTION_KEY` явной обязательной production-переменной и убрать production silent fallback, при котором Prisma encryption middleware мог молча отключить шифрование.

### Исходное состояние

- `.env.production.example` не содержал `ENCRYPTION_KEY`.
- `docker-compose.production.yml` передавал `ENCRYPTION_KEY=${ENCRYPTION_KEY:-}` и позволял старт с пустым ключом.
- `isEncryptionEnabled()` возвращал `false`, если ключа нет, поэтому middleware пропускал encryption/decryption без ошибки.

### Сделано

- В `.env.production.example` добавлен `ENCRYPTION_KEY` с инструкцией генерации `openssl rand -hex 32` и предупреждением не менять ключ после создания данных.
- В `docker-compose.production.yml` `ENCRYPTION_KEY` сделан обязательным через `${ENCRYPTION_KEY:?Set ENCRYPTION_KEY in .env.production}`.
- Добавлен `lib/encryption-config.ts` без Node `crypto`, чтобы проверку можно было вызывать из `instrumentation.ts` без Edge runtime warning.
- `assertEncryptionConfig()` проверяет:
	- в production ключ обязателен,
	- если ключ задан, он должен быть ровно 64 hex characters.
- `lib/encryption.ts` использует `assertEncryptionConfig()` перед получением ключа и в `isEncryptionEnabled()`.
- `instrumentation.ts` теперь проверяет и secure-cookie config, и encryption config при старте runtime.
- `docs/DEPLOY.md` добавлен `ENCRYPTION_KEY` в обязательный env-блок.

### Проверки

- `NODE_ENV=production ENCRYPTION_KEY= ... assertEncryptionConfig()` — ожидаемо падает с понятной ошибкой.
- `NODE_ENV=production ENCRYPTION_KEY=not-a-key ... assertEncryptionConfig()` — ожидаемо падает с ошибкой формата.
- `NODE_ENV=development ENCRYPTION_KEY= ... isEncryptionEnabled()` — возвращает `false`, локальный dev fallback сохранён.
- `NODE_ENV=production ENCRYPTION_KEY=<64 hex> ... encrypt/decrypt` — успешно возвращает исходный plaintext.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `POSTGRES_PASSWORD=dummy AUTH_SECRET=dummy ENCRYPTION_KEY=<64 hex> docker compose -f docker-compose.production.yml config --quiet` — успешно.
- `npm run build` — успешно; предупреждение про `crypto` в Edge instrumentation после выноса config-helper исчезло.

### Остаточные риски

- Перед production restart нужно убедиться, что текущий фактический `ENCRYPTION_KEY` в `.env.production` совпадает с ключом, которым были зашифрованы существующие данные.
- Полная проверка чтения старых production records не выполнялась локально, чтобы не обращаться к пользовательским данным.

### Следующий шаг

- Перейти к P0 #3: rate-limit на Cloudflare Workers proxy и tg-proxy.

---

## P0 #3 — Rate-limit на Cloudflare Workers proxy и tg-proxy

**Статус:** выполнено

### Цель

Ограничить ущерб при утечке shared secret для Cloudflare Worker прокси: один IP не должен иметь возможность бесконтрольно слать запросы в Anthropic или Telegram API через наши Workers.

### Исходное состояние

- `cloudflare-proxy` проверял только `x-proxy-secret`.
- `cloudflare-tg-proxy` проверял только `x-tg-proxy-secret`.
- При утечке секрета оба Worker’а могли проксировать неограниченный поток запросов.

### Сделано

- В `cloudflare-proxy/src/index.js` добавлен `RateLimitDO`.
- В `cloudflare-tg-proxy/src/index.js` добавлен `RateLimitDO`.
- Лимит считается по `CF-Connecting-IP`, fallback — первый IP из `x-forwarded-for`, затем `unknown`.
- При превышении лимита Worker возвращает `429` и header `Retry-After` до вызова внешнего API.
- Если binding `RATE_LIMITER` отсутствует, Worker fail-closed возвращает `429`, а не проксирует запрос наружу.
- Дефолтные лимиты:
	- Anthropic proxy: `60 req/min` на IP.
	- Telegram proxy: `30 req/min` на IP.
- В `wrangler.toml` обоих Worker’ов добавлены Durable Object bindings/migrations и `RATE_LIMIT_PER_MINUTE` vars.
- В `cloudflare-proxy/package.json` и `cloudflare-tg-proxy/package.json` добавлен `"type": "module"`, потому что Worker source использует ESM `export` syntax.
- `docs/INFRASTRUCTURE.md` дополнен описанием rate limit, defaults и места настройки лимитов.

### Проверки

- `node --check cloudflare-proxy/src/index.js` — успешно.
- `node --check cloudflare-tg-proxy/src/index.js` — успешно.
- Ручной тест `RateLimitDO` для Anthropic Worker: при `limit=2` три запроса вернули `200`, `200`, `429`.
- Ручной тест `RateLimitDO` для Telegram Worker: при `limit=2` три запроса вернули `200`, `200`, `429`.

### Остаточные риски

- In-memory buckets Durable Object сбрасываются при cold restart объекта, поэтому это защитный operational limiter, а не биллинговая гарантия. Для более строгой защиты можно дополнительно включить Cloudflare dashboard Rate Limiting Rules.
- Лимиты применяются после проверки shared secret. Это уменьшает шум от случайных внешних запросов, но не считает неавторизованные 403 в расход лимита.
- Деплой Worker’ов должен выполнить пользователь вручную через `wrangler deploy`; согласно repo policy я деплой не запускал.

### Следующий шаг

- Перейти к P0 #4: очистка просроченных sessions/reset/email verification tokens по cron.

---

## P0 #4 — Очистка просроченных sessions/reset/email verification tokens

**Статус:** выполнено

### Цель

Остановить бесконечный рост таблиц `sessions`, `password_reset_tokens`, `email_verification_tokens` и убрать из БД/бэкапов уже неиспользуемые auth records.

### Исходное состояние

- В `lib/auth.ts` был helper `cleanupExpiredSessions()`, но он чистил только expired sessions и нигде не запускался по расписанию.
- Expired password reset/email verification tokens оставались в БД.
- Used password reset/email verification tokens тоже оставались в БД, хотя повторно использоваться не могут.

### Сделано

- Добавлен `scripts/cleanup-expired.mjs`.
- Скрипт одной Prisma transaction удаляет:
	- sessions с `expiresAt < now`,
	- password reset tokens с `expiresAt < now` или `usedAt != null`,
	- email verification tokens с `expiresAt < now` или `usedAt != null`.
- Скрипт печатает JSON-summary с количеством удалённых записей.
- В `package.json` добавлен script `cleanup:expired` для ручного локального запуска.
- `Dockerfile` копирует `scripts/cleanup-expired.mjs` в production image, чтобы его можно было запускать через `docker exec ai-assistant-production node scripts/cleanup-expired.mjs`.
- `docs/DEPLOY.md` и `docs/INFRASTRUCTURE.md` дополнены командой ручного запуска и рекомендуемой cron-строкой `15 4 * * * ...`.

### Проверки

- `node --check scripts/cleanup-expired.mjs` — успешно, без подключения к БД.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- Поиск подтвердил, что cleanup script удаляет все три группы auth records и cron-команда задокументирована.

### Остаточные риски

- Скрипт не запускался против реальной БД локально, чтобы не удалять пользовательские данные. Первый production запуск стоит проверить по `backups/cleanup-expired.log`.
- Cron нужно добавить на сервере вручную; я не выполнял deploy/server changes.

### Следующий шаг

- Copilot-дополнение A1-A7 и исходные P0 #1-#4 закрыты. Дальше можно переходить к P1 #5: проверить и добавить только реально отсутствующие индексы Prisma.

---

## P1 #5 — Проверить и добавить только реально отсутствующие индексы Prisma

**Статус:** выполнено

### Цель

Добавлять Prisma indexes только под подтверждённые запросы, без ложных миграций на несуществующие поля или неподтверждённые access patterns.

### Проверка перед изменением

- Проверена `prisma/schema.prisma`: `InsightEntry` имел `@@index([userId])` и `@@index([userId, category])`.
- Проверены все обращения к `prisma.insightEntry`.
- Гипотеза из плана про `InsightEntry(userId, date)` не подтвердилась: текущий код не фильтрует и не сортирует `InsightEntry` по `date`.
- Подтверждённый повторяющийся pattern найден в `evaluate`, `evaluate/batch` и `daily/chat`: `where: { userId }`, `orderBy: { createdAt: 'desc' }`, `take: 50/100`.
- Проверен production migration contour: `docker-entrypoint.sh` запускает `prisma migrate deploy`, а не `db push`.
- `npx prisma validate` до изменения — успешно.

### Сделано

- В `InsightEntry` добавлен `@@index([userId, createdAt])`.
- Добавлена PostgreSQL migration `20260501120000_add_insight_entry_user_created_at_index` с `CREATE INDEX "insight_entries_userId_createdAt_idx" ON "insight_entries"("userId", "createdAt")`.
- В `docs/INFRASTRUCTURE.md` исправлена устаревшая строка: production фактически использует `prisma migrate deploy`.
- В action plan пункт P1 #5 обновлён, чтобы не рекомендовать неподтверждённый индекс `userId/date`.

### Проверки

- `npx prisma validate` — успешно до внесения изменения.

### Остаточные риски

- Миграция создаёт обычный index без `CONCURRENTLY`, потому что Prisma migrations выполняются внутри transaction. На очень большой таблице это может кратко заблокировать writes в `insight_entries`. Сейчас таблица knowledge cache ограниченно растёт по оценкам дней, риск принят как низкий.

### Следующий шаг

- Перейти к P1 #6: убрать лишний `/api/auth/me` запрос при каждой навигации в `AuthProvider`.

---

## P1 #6 — AuthProvider: убрать лишний `/api/auth/me` при каждой навигации

**Статус:** выполнено

### Цель

Сохранить единый auth state в `AuthProvider`, но не вызывать `/api/auth/me` на каждом переходе между защищёнными страницами.

### Проверка перед изменением

- Проверен `components/AuthProvider.tsx`: `useEffect` зависел от `pathname` и всегда вызывал `checkAuth(pathname)`.
- Проверен `components/AuthGuard.tsx`: guard рендерит публичные страницы без ожидания auth, а защищённые страницы зависят от `loading` и `isAuthenticated`.
- Проверены root providers/layout: `AuthProvider` оборачивает всё приложение, `AuthGuard` стоит вокруг page content.
- Проверен login/register flow: после успешного auth используется navigation + `router.refresh()`, значит при выходе с auth page на protected page Provider должен уметь сделать свежую проверку.

### Сделано

- В `AuthProvider` добавлен флаг `authChecked`.
- `checkAuth(pathname)` заменён на `loadUser()`, который только загружает `/api/auth/me` и обновляет `user/loading/authChecked`.
- Route effect теперь делает две разные вещи:
	- на auth pages сбрасывает `authChecked`, чтобы после login/register protected route сделал свежую проверку;
	- на protected/optional pages использует уже загруженного `user`, а `/api/auth/me` вызывает только если auth ещё не проверялся.
- Redirect logic сохранена:
	- неавторизованный пользователь на protected page уходит на `/login?redirect=...`;
	- не прошедший onboarding пользователь уходит на `/onboarding`.
- `logout()` сбрасывает `authChecked`, чтобы следующий login flow не использовал stale unauthenticated state.
- `refresh()` теперь явно вызывает `loadUser()`.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `get_errors` для `components/AuthProvider.tsx` — ошибок нет.

### Остаточные риски

- Browser-level smoke-check login → protected page → protected page ещё не запускался. По коду expected behavior: первый вход в protected контур делает один `/api/auth/me`, последующие protected navigations используют state.

### Следующий шаг

- Перейти к следующему быстрому P1-пункту: #9 hardcoded production URLs или #10 `$queryRawUnsafe` после финального build текущей пачки.

---

## P1 #9 — Убрать hardcoded production URLs из runtime-кода

**Статус:** выполнено

### Цель

Сделать app URL и Anthropic upstream URL управляемыми через окружение, чтобы staging/переезд домена не требовали правки runtime-кода.

### Проверка перед изменением

- Проверены все совпадения `assist.labaiion.ru`, `NEXT_PUBLIC_APP_URL`, `api.anthropic.com`, `ANTHROPIC_API_URL`.
- Подтверждённые runtime-точки:
	- `app/layout.tsx`: `metadataBase` и `openGraph.url` были прибиты к production-домену.
	- `app/opengraph-image.tsx` и `app/twitter-image.tsx`: hostname в изображении был прибит к production-домену.
	- auth email routes уже частично использовали `NEXT_PUBLIC_APP_URL`, но с локальным fallback в каждом файле.
	- `cloudflare-proxy/src/index.js`: Anthropic base URL был константой.
- Production-домен в `docs/*`, README и `cloudflare-proxy/wrangler.toml` как deploy/config reference оставлен осознанно; это не runtime-код приложения.

### Сделано

- Добавлен `lib/app-url.ts` с `getAppUrl()` и `getAppHost()`.
- `app/layout.tsx` теперь берёт `metadataBase` и `openGraph.url` из `NEXT_PUBLIC_APP_URL` через helper.
- `app/opengraph-image.tsx` и `app/twitter-image.tsx` теперь рисуют hostname из `NEXT_PUBLIC_APP_URL`.
- Email-ссылки verification/reset в auth routes переведены на общий helper:
	- `app/api/auth/forgot-password/route.ts`
	- `app/api/auth/resend-verification/route.ts`
	- `app/api/auth/register/route.ts`
- `.env.production.example` дополнен `NEXT_PUBLIC_APP_URL=https://your-domain.com`.
- `docker-compose.production.yml` теперь требует `NEXT_PUBLIC_APP_URL` через `${NEXT_PUBLIC_APP_URL:?Set NEXT_PUBLIC_APP_URL in .env.production}` вместо fallback на localhost.
- `cloudflare-proxy/src/index.js` теперь строит upstream через `env.ANTHROPIC_API_URL` с дефолтом `https://api.anthropic.com` и нормализует trailing slash.
- `cloudflare-proxy/wrangler.toml` получил `ANTHROPIC_API_URL = "https://api.anthropic.com"`.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `node --check cloudflare-proxy/src/index.js` — успешно.
- `docker compose -f docker-compose.production.yml config --quiet` с dummy secrets и `NEXT_PUBLIC_APP_URL=https://assist.labaiion.ru` — успешно.
- `rg` по `app/**` не нашёл оставшихся `assist.labaiion.ru`, `https://assist.labaiion.ru`, `https://api.anthropic.com` или старого fallback `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'`.

### Остаточные риски

- Если `NEXT_PUBLIC_APP_URL` задан невалидным URL в development, helper упадёт в безопасный fallback `http://localhost:3000`. В production compose переменная обязательна, но формат пока не валидируется startup-check'ом.

### Следующий шаг

- Перейти к P1 #10: заменить `$queryRawUnsafe` в `scripts/monitor.sh` на параметризованный `$queryRaw`.

---

## P1 #10 — Убрать `$queryRawUnsafe` из monitoring scripts

**Статус:** выполнено

### Цель

Убрать unsafe raw SQL string concatenation из operational scripts, чтобы не оставлять в проекте шаблон, который легко скопировать в более опасный контекст.

### Проверка перед изменением

- Проверен `scripts/monitor.sh`: в daily audit digest было три `$queryRawUnsafe` с конкатенацией `since.toISOString()` / `until.toISOString()`.
- Общий поиск по `scripts/**` нашёл такой же паттерн в `scripts/tg-bot.sh` внутри команды `cmd_check()`.
- Входные значения сейчас контролировались самим скриптом, поэтому это был не текущий exploit path, а anti-pattern/maintainability risk.

### Сделано

- В `scripts/monitor.sh` три unsafe-запроса заменены на Prisma tagged `$queryRaw`:
	- counts by `action`,
	- distinct `ipAddress`,
	- total audit count.
- В `scripts/tg-bot.sh` четыре unsafe-запроса заменены на tagged `$queryRaw`:
	- counts by `action`,
	- distinct IP count,
	- active sessions count,
	- login IP list.
- `h24` в Telegram bot snippet теперь Date object, а не preformatted ISO string; `loginAction` передаётся SQL-параметром.

### Проверки

- `rg "queryRawUnsafe" scripts/**` — совпадений нет.
- `sh -n scripts/monitor.sh && sh -n scripts/tg-bot.sh` — успешно.
- Ручная Node-проверка tagged-template синтаксиса с mock `p.$queryRaw` — успешно (`2 2 login`).

### Остаточные риски

- Скрипты не запускались против production БД. Изменение сохраняет те же SQL-выборки, но первый реальный cron/bot запуск стоит посмотреть в логах мониторинга.

### Следующий шаг

- Перейти к P1 #8: заменить оставшиеся `JSON.parse` без safe fallback.

---

## P1 #8 — Заменить оставшиеся unguarded JSON.parse

**Статус:** выполнено

### Цель

Защитить parsing JSON из БД/localStorage от падения UI/API при битых или устаревших данных.

### Проверка перед изменением

- Проверены все `JSON.parse(` в `app`, `components`, `hooks`, `lib`.
- Большинство мест уже были защищены `try/catch` или специальными helper'ами:
	- `hooks/useDaily.ts`, `app/daily/page.tsx`, `app/tasks/page.tsx`, `app/evaluation/[date]/page.tsx`.
	- `lib/fact-utils.ts` уже использовал `safeParseJsonArray()`.
	- AI/API parsing в `lib/api-utils.ts` и related routes намеренно бросает ошибку внутри контролируемого `try/catch`.
- Реальный незакрытый риск остался в `lib/user-stats.ts`: JSON из DB-backed полей парсился напрямую.

### Сделано

- В `lib/user-stats.ts` добавлен импорт `safeParseJson` из `lib/safe-json.ts`.
- На typed fallback переведены:
	- `selectedTasksJson` в основном расчёте статистики,
	- `selectedTasksJson` в `calculateCompletionPct()`,
	- `completionByDayJson`,
	- `completionByTypeJson`,
	- `frequentCompletedJson`,
	- `frequentFailedJson`.

### Проверки

- `rg "JSON.parse\(" lib/user-stats.ts` — совпадений нет.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `get_errors` для `lib/user-stats.ts` — ошибок нет.

### Остаточные риски

- В проекте остаются `JSON.parse` внутри мест, где ошибка уже явно обрабатывается `try/catch`, и в CLI/migration scripts. Их не трогал в рамках P1 #8, чтобы не менять поведение разовых служебных скриптов.

### Следующий шаг

- Перейти к следующему P1-пункту: #7 fetch wrapper / `.ok` checks или начать минимальный набор тестов P1 #11 после финальной сборки текущей пачки.

---

## P1 #7 — Checked fetch handling для рискованных UI flows

**Статус:** выполнено для первичного рискованного скоупа

### Цель

Сделать ошибки API явными в ключевых пользовательских сценариях и не продолжать workflow, если предыдущий API-шаг не подтвердился сервером.

### Проверка перед изменением

- Собраны все `fetch(` в `app`, `components`, `hooks`.
- Подтверждено, что AuthProvider уже осознанно обрабатывает `401` как normal unauthenticated state, поэтому механически переводить его на throwing helper нельзя.
- Выделены самые рискованные места:
	- `app/daily/page.tsx`: `process-uncompleted` продолжал evaluation даже после failed response; facts widget errors игнорировались.
	- `hooks/useDaily.ts`: daily screen actions местами читали error body вручную или показывали success после failed save.
	- `app/tasks/page.tsx`: mutations часто делали `if (!res.ok) return`, оставляя пользователя без причины отказа.

### Сделано

- Добавлен `lib/fetch-json.ts`:
	- `fetchJson<T>()` — fetch + parse + typed throw на `!ok`.
	- `expectOk()` — checked response для endpoints без нужного JSON body.
	- `FetchJsonError` — содержит `status`, `statusText`, `url`, `payload`.
	- `getFetchErrorMessage()` — единый способ показать readable API error.
- `app/daily/page.tsx`:
	- `process-uncompleted` теперь использует `fetchJson()` и делает `return` при ошибке, не запуская `evaluate()` на неподготовленных данных.
	- facts-загрузка использует `Promise.allSettled`; failed widget очищает stale data и пишет `console.error`.
- `hooks/useDaily.ts`:
	- checked fetch для сохранения плана и внеплана, создания/удаления привычек, переноса задач, `check-plan`, daily chat и `evaluate`.
	- `savePlanWithTasks()` теперь возвращает `boolean`, поэтому кнопка ручного сохранения не показывает «План сохранен!» после failed request.
	- `401` при сохранении плана сохранил прежний redirect на login.
- `app/tasks/page.tsx`:
	- загрузка open/closed/daily данных переведена на `fetchJson()`.
	- edit/close/reopen/delete/add-to-plan/add incoming task теперь показывают понятную ошибку вместо тихого `return`.

### Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `get_errors` для `lib/fetch-json.ts`, `app/daily/page.tsx`, `hooks/useDaily.ts`, `app/tasks/page.tsx` — ошибок нет.
- `rg` по изменённым daily/tasks/useDaily не нашёл старых паттернов `if (!res.ok) return`, `catch { /* игнорируем */ }` и unchecked `await fetch('/api/daily'`.

### Остаточные риски

- Это не полная миграция всех `fetch` по проекту. В P1 #7 намеренно закрыт рискованный первичный скоуп; менее критичные страницы можно переводить постепенно тем же helper'ом.
- Browser smoke-check daily/task flows ещё не запускался; поведение проверено статически, typecheck/lint/build должны пройти после финальной сборки.

### Следующий шаг

- Запустить финальный `npm run build`, затем перейти к P1 #11 — минимальные тесты критичных модулей.

---

## P1 #11 — Минимальные тесты критичных модулей

**Статус:** выполнено как стартовый safety-net

### Цель

Добавить тестовую инфраструктуру и минимальный набор unit-тестов для модулей, где регрессия может привести к потере данных, неверным auth/token flows, лишним AI-запросам или молчаливым UI/API ошибкам.

### Проверка перед изменением

- В `package.json` не было `test` script и тестового раннера.
- Проверен текущий runtime: Node `v24.10.0`, npm `11.6.0`.
- Проверен `vitest@4.1.5`:
	- engines: `^20.0.0 || ^22.0.0 || >=24.0.0`, текущий Node подходит.
	- peer deps совместимы с Node environment; jsdom/happy-dom не нужны для текущего pure-helper скоупа.
- Проверен Docker build-контур: `Dockerfile` использует `node:20-alpine`, актуальный image даёт Node `v20.20.2`, что также подходит под Vitest 4.
- Для тестов выбран DB-free/API-free скоуп, чтобы `npm test` был быстрым и безопасным для локального запуска перед следующими миграционными шагами.

### Сделано

- Установлен `vitest@4.1.5` в `devDependencies`.
- В `package.json` добавлены scripts:
	- `test`: `vitest run`,
	- `test:watch`: `vitest`.
- Добавлен `vitest.config.ts`:
	- `environment: 'node'`,
	- `include: ['tests/**/*.test.ts']`,
	- alias `@` на корень проекта.
- Добавлены тесты в `tests/lib/`:
	- `safe-json.test.ts` — valid parse, fallback на `undefined` и malformed JSON, ожидаемый `console.error` без шума в test output.
	- `dates.test.ts` — date-only local parsing и `validateAiDateRange()` для валидного, invalid, reversed и oversized ranges.
	- `encryption.test.ts` — encrypt/decrypt round-trip, `enc_v1:` detection, plaintext passthrough, production `ENCRYPTION_KEY` validation.
	- `fetch-json.test.ts` — ok JSON response, typed `FetchJsonError` на failed response, fallback error messages.
	- `auth.test.ts` — `hashToken()` deterministic, отличается от raw token, формат SHA-256 hex.
	- `anthropic.test.ts` — `getAnthropicClient()` требует API key, передаёт proxy `baseURL` и `x-proxy-secret`, кеширует client; `@anthropic-ai/sdk` мокается, реальных сетевых вызовов нет.

### Проверки

- `npm test` — успешно: 6 test files, 14 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- `npm run build` — успешно.
- `docker run --rm node:20-alpine node --version` — `v20.20.2`, engines Vitest 4 совместимы с Docker base image.

### Замечания после build

- Сохраняются уже известные предупреждения:
	- deprecated Next.js `middleware` convention, нужен будущий переход на `proxy`,
	- stale Browserslist/caniuse-lite data,
	- Edge runtime disables static generation warning.

### Остаточные риски

- Текущий P1 #11 закрывает минимальный unit safety-net. Более глубокие тесты AI retry/backoff с fake timers и API-level route tests остаются хорошим следующим расширением, но не блокируют переход к P1 #12.
- `npm audit` без `--omit=dev` после установки Vitest показывает dev-only findings; production graph остаётся чистым.

### Следующий шаг

- Перейти к P1 #12: soft delete + audit удаления для `User`.

---

## P1 #12 — Soft delete + аудит удаления для User

**Статус:** выполнено

### Цель

Защитить пользовательские данные от случайного или будущего hard delete `User`, который из-за `onDelete: Cascade` на связях мог бы физически удалить дневники, цели, профиль, задачи, статистику и другие связанные записи.

### Проверка перед изменением

- Перечитан текущий `package.json` после внешних изменений: scripts/dependencies соответствуют предыдущему состоянию, `vitest@4.1.5` на месте.
- Проверена модель `User` в `prisma/schema.prisma`: `deletedAt` отсутствовал, связи с дочерними моделями используют `onDelete: Cascade`.
- Поиск по app/lib/scripts не нашёл текущих прямых `prisma.user.delete()` / `deleteMany()` вызовов. Риск всё равно остаётся системным: будущий такой вызов запустил бы каскад.
- Проверены auth/session/reset/email verification ветки, где удалённый пользователь мог бы проходить через session include или auth token relations.

### Сделано

- В `User` добавлено поле `deletedAt: DateTime?` и индекс `@@index([deletedAt])`.
- Добавлена миграция `20260502090000_add_user_deleted_at`:
	- `ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);`
	- `CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");`
- Добавлен `lib/prisma-user-soft-delete.ts`:
	- `User.delete` преобразуется в `User.update` с `isActive=false`, `deletedAt=now()`;
	- `User.deleteMany` преобразуется в `User.updateMany` с теми же полями;
	- другие модели не затрагиваются, поэтому cleanup sessions/tokens и task delete flows сохраняют прежнее поведение.
- `lib/prisma.ts` подключает middleware после audit middleware. Audit middleware дополнительно изменён: теперь он сохраняет исходные `model`, `action`, `where.id` до `next()`, поэтому soft delete пользователя логируется как исходное действие `delete`.
- `User` добавлен в `AUDITED_MODELS`.
- Auth-related проверки усилены:
	- `loginUser`, `validateSession`, `getUserById`, `getUserByEmail`, `changePassword`, `resetPassword`, `verifyEmailToken` учитывают `deletedAt`.
	- `forgot-password` не создаёт reset token для `deletedAt` пользователя.
	- `reset-password` GET/POST включает user status и отклоняет deleted/inactive account.
	- `register` не переотправляет verification email soft-deleted пользователю; `MAX_USERS` считает только `deletedAt: null`.
	- `onboarding` и `profile/theme` используют `deletedAt: null` в user lookups/updateMany.
	- `scripts/reset-password.ts` не сбрасывает пароль deleted/inactive пользователю и показывает только active/non-deleted users в подсказке.
- Добавлен `tests/lib/prisma-user-soft-delete.test.ts` на преобразование `delete`, `deleteMany` и pass-through для non-User model.

### Проверки

- `npx prisma validate` — успешно.
- `npx prisma generate` — успешно.
- `npm test` — успешно: 7 test files, 17 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- `npm run build` — успешно.
- `get_errors` для изменённых TS/route/test файлов — ошибок нет.

### Замечания после build

- Сохраняются уже известные предупреждения:
	- deprecated Next.js `middleware` convention,
	- stale Browserslist/caniuse-lite data,
	- Edge runtime disables static generation warning.

### Остаточные риски

- Реальное физическое удаление пользователя теперь нужно делать отдельным будущим admin/maintenance-скриптом через 30 дней. Такой скрипт намеренно не добавлен в этот шаг, чтобы не вводить опасный hard-delete path без отдельного review.
- Soft-deleted пользователь сохраняет уникальный email в таблице `users`. Повторная регистрация на тот же email не создаёт новый аккаунт; текущий публичный flow продолжает отвечать безопасным generic verification response.
- Прямые raw SQL удаления или отдельный PrismaClient без подключённого middleware всё ещё могут обойти soft delete. В текущем app/lib runtime используется общий `lib/prisma.ts`; служебные скрипты нужно ревьюить отдельно перед добавлением hard-delete операций.

### Следующий шаг

- Перейти к P2 #13: разделить крупный `hooks/useDaily.ts` или выбрать более короткий P2-пункт по приоритету перед крупным рефакторингом.

---

## Контрольный прогон после P1 #12 — 02.05.2026

**Статус:** выполнено

### Что проверено

- `npm test` — успешно: 7 test files, 17 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npx prisma validate` — schema valid.
- `npm audit --omit=dev` — `found 0 vulnerabilities`.
- `npm run build` — успешно, Prisma Client сгенерирован, Next.js production build собран.
- `get_errors` по рабочим техдокам — ошибок нет.

### Замечания

- В build остаются прежние предупреждения: deprecated `middleware` convention, stale Browserslist/caniuse-lite data и Edge runtime disables static generation warning.
- Playwright/Cypress e2e-конфигурация в проекте не найдена, поэтому браузерный e2e-прогон не запускался.
- Для больших отчётных markdown-файлов добавлены локальные `markdownlint-disable` комментарии, чтобы VS Code Problems не засорялись сотнями предупреждений по длине строк и повторяющимся техническим заголовкам.

---

## P2 #13 — Первый безопасный разрез `hooks/useDaily.ts`

**Статус:** выполнено

### Цель

Разрезать большой public hook-файл без изменения внешнего API для `app/daily/page.tsx`: сначала вынести тестируемые части, проверить их, затем оставить материнский файл как фасад-заглушку.

### Сделано

- Создана директория `hooks/daily/`.
- Текущая реализация перенесена в `hooks/daily/useDailyController.ts`.
- `hooks/useDaily.ts` оставлен на месте и заменён на тонкий фасад:
	- re-export `useDaily` из controller;
	- re-export публичных типов из `hooks/daily/types.ts`.
- Вынесены типы:
	- `DailyPlanDraft`, `TaskSuggestion`, `CheckPlanResult`, `ChatMessage`, `Habit`, `HabitSuggestion`, `PeriodGoalItem`, `UseDailyReturn`.
- Вынесены чистые task-helper функции:
	- `buildTasksFromTexts`,
	- `sanitizeSelectedForTotal`,
	- `remapSelectionByText`,
	- `parseExtraTasksJson`.
- Вынесены helper'ы черновика плана:
	- `getPlanDraftKey`,
	- `parsePlanDraft`,
	- `readPlanDraftFromStorage`,
	- `writePlanDraftToStorage`,
	- `clearPlanDraftFromStorage`.
- Добавлены unit-тесты:
	- `tests/hooks/daily/task-helpers.test.ts`,
	- `tests/hooks/daily/plan-draft.test.ts`.

### Порядок проверки

- До заглушки материнского файла: `npm test` — успешно, 9 test files, 24 tests.
- После замены `hooks/useDaily.ts` на фасад:
	- `npm test` — успешно, 9 test files, 24 tests.
	- `npm run typecheck` — успешно.
	- `npm run lint` — успешно.
	- `npm run build` — успешно.
	- `get_errors` по новым/изменённым hook-файлам — ошибок нет.

### Замечания

- Внешний импорт `@/hooks/useDaily` не менялся; `app/daily/page.tsx` продолжает использовать прежний путь.
- Это первый безопасный разрез: поведение сохранено, а самые рискованные pure-срезы теперь тестируются отдельно.
- Следующий проход по P2 #13 можно делать уже внутри `useDailyController.ts`: выделять `useDailyChat`, `useDailyHabits` и `useDailyEvaluation` малыми пачками, сохраняя фасад `hooks/useDaily.ts`.

---

## P2 #15 — Единая категоризация задач

**Статус:** выполнено

### Цель

Убрать дублирование правил `getTaskCategory` / `getTaskType`, чтобы статистика, completed work и backfill-скрипт не расходились при будущих изменениях категорий.

### Исходное состояние

- `lib/completed-work.ts` экспортировал локальный `getTaskCategory()`.
- `lib/user-stats.ts` имел локальный `getTaskType()` с теми же правилами.
- `scripts/backfill-completed-work.ts` имел третью копию `getTaskCategory()`.

### Сделано

- Добавлен `lib/task-categorize.ts`.
- Вынесены единые правила категорий:
	- `привычки`,
	- `созвоны`,
	- `стратегические`,
	- `операционные`.
- Добавлен `TaskCategory` union type.
- Добавлен alias `getTaskType = getTaskCategory`, чтобы сохранить смысл старого `user-stats` API внутри модуля.
- `lib/completed-work.ts` импортирует общий helper и re-export'ит `getTaskCategory` для совместимости.
- `lib/user-stats.ts` импортирует `getTaskType` из общего helper.
- `scripts/backfill-completed-work.ts` импортирует `getTaskCategory` из `../lib/task-categorize`.
- Старые локальные копии функций удалены.
- Добавлен `tests/lib/task-categorize.test.ts` на привычки, созвоны, стратегические задачи, fallback в операционные и совместимость alias.

### Проверки

- `rg` подтвердил, что определения `getTaskCategory/getTaskType` остались только в `lib/task-categorize.ts`.
- `get_errors` по изменённым файлам — ошибок нет.
- `npm test` — успешно: 10 test files, 28 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npx tsc --noEmit --pretty false --project tsconfig.json` — успешно; `scripts/backfill-completed-work.ts` входит в project include.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- `npm run build` — успешно.

### Замечания

- Одна промежуточная ручная `tsc`-команда без `--project tsconfig.json` дала ложные TS2802 по итерации `Set/Map`, потому что не подтянула `target` из проекта. Повтор через проектный tsconfig прошёл чисто.
- Правила категоризации намеренно не менялись, только вынесены в один источник.

---

## P2 #14 — Общий AI user context для AI-роутов

**Статус:** выполнено

### Цель

Убрать копипасту сборки `dream`/`goals`/`profile`/`insights` из AI route handlers, сохранив текущие формы prompt payload и route-specific поведение.

### Проверка перед изменением

- Перечитаны ключевые AI routes:
	- `app/api/daily/chat/route.ts`,
	- `app/api/daily/check-plan/route.ts`,
	- `app/api/evaluate/route.ts`,
	- `app/api/evaluate/batch/route.ts`,
	- `app/api/evaluate-period/route.ts`,
	- `app/api/forecast/route.ts`.
- Проверены prompt types в `lib/prompts/types.ts`, `lib/prompts/check-plan.ts`, `lib/prompts/plan-chat.ts`.
- Подтверждено, что `profile` shape общий для daily/evaluate/period/forecast, а `insights` нужен только plan/check/chat контексту.
- Подтверждено отличие period goals логики:
	- daily evaluation берёт точные period starts через `getPeriodDates(date, ...)`,
	- period evaluation берёт последние period goals с `periodStart <= startDate`, как было раньше,
	- forecast horizon имеет отдельную ветку для `dream`/`year`/period horizons.

### Сделано

- Добавлен `lib/user-context.ts`.
- Добавлены pure helpers:
	- `mapUserProfile()` — общий профиль пользователя для AI prompts,
	- `mapUserInsights()` — общий insights context для plan/check/chat,
	- `buildGoalsContext()` — dream + year/half/quarter/month/week goals,
	- `buildPlanContext()` — dream + week/month goals + profile + insights.
- Добавлены async helpers:
	- `getPlanUserContext(userId, targetDate)`,
	- `getDailyEvaluationUserContext(userId, date)`,
	- `getDailyEvaluationGoalsContext(userId, date, dreamOverride?)`,
	- `getPeriodEvaluationUserContext(userId, startDate)`,
	- `getForecastHorizonGoals(...)`,
	- `getLatestDreamGoal(userId)`,
	- `getLatestUserProfile(userId)`.
- На shared context переведены:
	- `daily/chat` — общий plan context, локально остались history/progress/stats/knowledge/work context,
	- `daily/check-plan` — общий plan context, локально осталась recent history,
	- `evaluate` — общий daily evaluation goals + profile,
	- `evaluate/batch` — общий goals builder с предзагруженной dream/profile, чтобы не делать лишние запросы на каждый день,
	- `evaluate-period` — общий period evaluation goals + profile,
	- `forecast` — общий latest dream, profile и horizon goals.
- Добавлен `tests/lib/user-context.test.ts` на profile/insights mapping, goals context и plan context.

### Проверки

- `get_errors` по новым/изменённым route/helper/test/doc файлам — ошибок нет.
- `npm test` — успешно: 11 test files, 32 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- Контрольный `rg` по AI routes не нашёл оставшихся старых patterns `userProfile ? { ... }`, `insights: userInsights ? { ... }`, `dreamGoal: dream?.goalText` и `safeParseJson(...goalsJson...)` в AI route scope.

### Замечания

- `evaluate/batch` не был в первом коротком списке P2 #14, но grep показал тот же duplicated evaluation context. Он включён в этот шаг, чтобы не оставлять очевидный дубль.
- В `forecast` сохранён прежний 404, если dream отсутствует. Общий helper только загружает dream; route-specific response остался в route.
- В `daily/chat` и `check-plan` не объединялась история/статистика/knowledge cache, потому что это уже не общий user context, а специфичный prompt payload.

### Остаточные риски

- `app/api/goals/decompose/route.ts` тоже работает с profile/profileBlocks, но это другой prompt/domain: там нужен structured planning profile и profile blocks. Его стоит рассматривать отдельным будущим проходом, чтобы не смешивать goals decomposition с daily/evaluation context.
- Browser/API smoke с реальными AI вызовами не запускался, чтобы не тратить Anthropic quota; проверка была статической, unit и build-level.

---

## P2 #16 — AI-модель в env-переменную

**Статус:** выполнено

### Цель

Дать возможность менять Anthropic model id через окружение без правки кода и пересборки Docker, сохранив текущее поведение при пустом `AI_MODEL`.

### Проверка перед изменением

- Проверены все совпадения `claude-sonnet`, `AI_MODEL` и `model:` в `app`, `lib`, `tests`, env-шаблонах и docs.
- Подтверждено, что в коде было два разных hardcoded fallback:
	- `claude-sonnet-4-6` в shared AI-функциях [lib/anthropic.ts](../lib/anthropic.ts) для daily evaluation, period evaluation, forecast и insights update,
	- `claude-sonnet-4-20250514` в прямых route-вызовах `daily/chat`, `daily/check-plan` и `goals/decompose`.
- Модель не мигрировалась на новую версию: helper сохраняет текущие fallback’и, если `AI_MODEL` не задан.

### Сделано

- В [lib/anthropic.ts](../lib/anthropic.ts) добавлены:
	- `DEFAULT_AI_MODEL`,
	- `DEFAULT_ROUTE_AI_MODEL`,
	- `getAiModel(fallbackModel = DEFAULT_AI_MODEL)`.
- Shared AI-функции в [lib/anthropic.ts](../lib/anthropic.ts) используют локальную переменную `model = getAiModel()` и возвращают тот же `model` в usage data.
- Прямые route-вызовы переведены на `getAiModel(DEFAULT_ROUTE_AI_MODEL)`:
	- [app/api/daily/chat/route.ts](../app/api/daily/chat/route.ts),
	- [app/api/daily/check-plan/route.ts](../app/api/daily/check-plan/route.ts),
	- [app/api/goals/decompose/route.ts](../app/api/goals/decompose/route.ts).
- `logAIUsage()` в daily chat/check-plan теперь пишет фактически выбранную модель из helper’а.
- В [.env.example](../.env.example) добавлен пример `AI_MODEL` для локальной разработки.
- В [.env.production.example](../.env.production.example) добавлен `AI_MODEL=claude-sonnet-4-20250514` с пояснением, что значение можно менять без пересборки Docker.
- В [docker-compose.production.yml](../docker-compose.production.yml) добавлен passthrough `AI_MODEL=${AI_MODEL:-}` для app container.
- [tests/lib/anthropic.test.ts](../tests/lib/anthropic.test.ts) расширен проверками fallback и env override.

### Проверки

- `rg` подтвердил, что прямых `model: 'claude...'` literals в `app/lib` больше нет; остались только fallback-константы в [lib/anthropic.ts](../lib/anthropic.ts).
- `get_errors` по изменённым code/env/config/test файлам — ошибок нет.
- `npm test` — успешно: 11 test files, 34 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Замечания

- Реальные Anthropic smoke-вызовы не запускались, чтобы не тратить quota. Проверка была static/unit/build-level.
- Если `AI_MODEL` задан, он переопределяет модель во всех перечисленных сценариях. Если пустой — поведение остаётся прежним для каждого сценария.

---

## P2 #17 — Пагинация list API endpoints

**Статус:** выполнено

### Цель

Убрать unbounded list responses из API, где один запрос мог вернуть всю историю пользователя или все связанные цели/периодические оценки.

### Проверка перед изменением

- Перечитаны endpoint’ы из плана:
	- [app/api/tasks/closed/route.ts](../app/api/tasks/closed/route.ts),
	- [app/api/periods/route.ts](../app/api/periods/route.ts),
	- [app/api/daily/route.ts](../app/api/daily/route.ts),
	- [app/api/goals/items/route.ts](../app/api/goals/items/route.ts).
- Найдены реальные UI-потребители:
	- [app/tasks/page.tsx](../app/tasks/page.tsx) для закрытых задач,
	- [app/periods/page.tsx](../app/periods/page.tsx) для списка period evaluations,
	- [app/history/page.tsx](../app/history/page.tsx) для истории daily entries,
	- [hooks/useTrackedGoals.ts](../hooks/useTrackedGoals.ts) для tracked goals.
- Подтверждено, что `GET /api/daily?date=...` используется как single-entry contract и не должен менять форму ответа.

### Сделано

- Добавлен [lib/pagination.ts](../lib/pagination.ts):
	- `parsePaginationParams()` читает `limit`/`offset`, применяет defaults и max `100`,
	- `buildPaginatedResponse()` формирует `{ items, total, limit, offset, hasMore }`.
- В [lib/types.ts](../lib/types.ts) добавлен frontend type `PaginatedResponse<T>`.
- На paginated envelope переведены list GET ветки:
	- `GET /api/tasks/closed`,
	- `GET /api/periods`,
	- `GET /api/daily` для list/range режимов,
	- `GET /api/goals/items`.
- `GET /api/daily?date=...` сохранён без изменений: возвращает `DailyEntry | null`.
- Mutation endpoints `POST/PUT/DELETE` не менялись.
- Клиенты обновлены:
	- [app/tasks/page.tsx](../app/tasks/page.tsx) читает `closedData.items`,
	- [app/periods/page.tsx](../app/periods/page.tsx) читает `data.items`,
	- [app/history/page.tsx](../app/history/page.tsx) грузит daily entries страницами по `100` только для видимого диапазона месяцев,
	- [hooks/useTrackedGoals.ts](../hooks/useTrackedGoals.ts) догружает все tracked goals страницами по `100`, чтобы не сломать текущую логику синхронизации целей.
- Добавлен [tests/lib/pagination.test.ts](../tests/lib/pagination.test.ts) на defaults, invalid params, max clamp и `hasMore`.

### Проверки

- `get_errors` по новым/изменённым API/UI/helper/test файлам — ошибок нет.
- `npm test` — успешно: 12 test files, 37 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Замечания

- Для `history` теперь не запрашивается вся история одним запросом: календарь грузит страницы только для выбранного диапазона `3/6/12` месяцев.
- Для `goals/items` hook намеренно догружает все страницы, потому что текущая логика completion cascade и fuzzy matching работает с полным набором tracked goals. Ограничение теперь находится на уровне размера каждого API-запроса, а не полного client-side рабочего набора.
- Browser smoke не запускался; проверка была статической, unit и build-level.

---

## P2 #18 — `String` JSON поля → Prisma `Json`, срезы 1-8

**Статус:** выполнено

### Цель

Начать миграцию строковых JSON-полей с минимально рискованной области, не затрагивая зашифрованные payload и публичные API-контракты.

### Разведка

- В [prisma/schema.prisma](../prisma/schema.prisma) найдены JSON-подобные string-поля в `YearGoal`, `PeriodGoal`, `Goal`, `DailyEntry`, `Evaluation`, `UserStats`, `WorkSummary`.
- Для первого среза выбран `UserStats`, потому что эти поля не входят в `ENCRYPTED_FIELDS`, используются локально в [lib/user-stats.ts](../lib/user-stats.ts), и не требуют изменения client API.
- Для второго среза выбран `WorkSummary.topCategoriesJson`: поле не зашифровано, записывается только из summary builders и читается через `safeParseJson()`.
- Для третьего среза выбраны `Goal.tagsJson` и `Goal.blockedByJson`: оба поля не входят в `ENCRYPTED_FIELDS`, имеют default `[]`, и используются в ограниченном goal API scope.
- Перед encrypted-срезами добавлена поддержка `ENCRYPTED_JSON_FIELDS`, чтобы object/array values можно было шифровать как JSON payload и на чтении возвращать уже распарсенное значение.
- Для четвёртого среза выбран `WorkSummary.keyAchievements`: encrypted поле с ограниченными потребителями и безопасным fallback через `safeParseJson()`.
- Для пятого среза выбран `Goal.historyJson`: encrypted поле, потребители уже используют `safeParseJson()`, writers находятся только в goal routes.
- Для шестого среза выбраны `YearGoal.goalsJson` и `PeriodGoal.goalsJson`: оба encrypted, оба массивы целей; runtime consumers используют `safeParseJson()` или локальный `parseGoalsJson()`.
- Для седьмого среза взяты связанные `DailyEntry.planSnapshotJson`, `DailyEntry.extraTasksJson`, `DailyEntry.selectedTasksJson`: они образуют общий daily API/client contract и должны мигрировать вместе.
- Для восьмого среза выбран последний оставшийся `*Json String?` — `Evaluation.suggestedTasksJson`.

### Сделано

- [lib/safe-json.ts](../lib/safe-json.ts) расширен до `unknown` input:
	- legacy JSON string продолжает парситься через `JSON.parse`,
	- `null`/`undefined`/empty string возвращают fallback,
	- уже распарсенные Prisma `Json` object/array values возвращаются как typed value.
- [tests/lib/safe-json.test.ts](../tests/lib/safe-json.test.ts) дополнен проверкой already parsed object/array values.
- В [prisma/schema.prisma](../prisma/schema.prisma) поля `UserStats` переведены с `String` на `Json`:
	- `completionByDayJson`,
	- `completionByTypeJson`,
	- `frequentCompletedJson`,
	- `frequentFailedJson`.
- Добавлена миграция [prisma/migrations/20260503100000_user_stats_json_fields/migration.sql](../prisma/migrations/20260503100000_user_stats_json_fields/migration.sql):
	- переводит columns в `jsonb`,
	- использует временную `try_parse_jsonb(text, fallback jsonb)`, чтобы invalid legacy value не ронял migration и падал в прежние defaults `{}` / `[]`.
- [lib/user-stats.ts](../lib/user-stats.ts) больше не делает `JSON.stringify()` для этих четырёх полей при `create`/`update`; Prisma получает object/array напрямую.
- В [prisma/schema.prisma](../prisma/schema.prisma) `WorkSummary.topCategoriesJson` переведён с `String?` на `Json?`.
- Добавлена миграция [prisma/migrations/20260503101000_work_summary_top_categories_json/migration.sql](../prisma/migrations/20260503101000_work_summary_top_categories_json/migration.sql): nullable legacy string переводится в `jsonb`, invalid/empty payload становится `NULL`, что соответствует текущему fallback `{}` в API.
- [lib/completed-work.ts](../lib/completed-work.ts) и [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts) больше не делают `JSON.stringify(catCounts)` для `topCategoriesJson`.
- В [prisma/schema.prisma](../prisma/schema.prisma) `Goal.tagsJson` и `Goal.blockedByJson` переведены с `String` на `Json`.
- Добавлена миграция [prisma/migrations/20260503102000_goal_tags_blocked_json_fields/migration.sql](../prisma/migrations/20260503102000_goal_tags_blocked_json_fields/migration.sql): оба legacy string массива переводятся в `jsonb` с fallback `[]`.
- [app/api/goals/items/route.ts](../app/api/goals/items/route.ts) пишет `tagsJson` и `blockedByJson` как массивы напрямую, без `JSON.stringify()`.
- В [lib/encryption.ts](../lib/encryption.ts) добавлен `ENCRYPTED_JSON_FIELDS` с первым полем `WorkSummary.keyAchievements`.
- [lib/prisma-encryption.ts](../lib/prisma-encryption.ts) теперь:
	- шифрует encrypted JSON object/array через `JSON.stringify(value)`,
	- не шифрует повторно уже encrypted string,
	- после расшифровки пытается вернуть parsed JSON value,
	- оставляет plaintext object/array из direct scripts usable на read.
- Добавлен [tests/lib/prisma-encryption.test.ts](../tests/lib/prisma-encryption.test.ts) на encrypted JSON array round-trip и plaintext array из direct script path.
- В [prisma/schema.prisma](../prisma/schema.prisma) `WorkSummary.keyAchievements` переведён с `String` на `Json`.
- Добавлена миграция [prisma/migrations/20260503103000_work_summary_key_achievements_json/migration.sql](../prisma/migrations/20260503103000_work_summary_key_achievements_json/migration.sql): старые `enc_v1:*` сохраняются как JSON string, plaintext JSON строки парсятся в `jsonb`, invalid/empty значения падают в `[]`.
- [lib/completed-work.ts](../lib/completed-work.ts) и [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts) пишут `keyAchievements` как массив напрямую.
- `Goal.historyJson` добавлен в `ENCRYPTED_JSON_FIELDS`.
- В [prisma/schema.prisma](../prisma/schema.prisma) `Goal.historyJson` переведён с `String` на `Json`.
- Добавлена миграция [prisma/migrations/20260503104000_goal_history_json_field/migration.sql](../prisma/migrations/20260503104000_goal_history_json_field/migration.sql): старые `enc_v1:*` сохраняются как JSON string, plaintext JSON строки парсятся в `jsonb`, invalid/empty значения падают в `[]`.
- [app/api/goals/items/route.ts](../app/api/goals/items/route.ts) и [app/api/goals/move/route.ts](../app/api/goals/move/route.ts) пишут `historyJson` как массив напрямую.
- Тип `GoalMoveHistoryEntry` в [app/api/goals/move/route.ts](../app/api/goals/move/route.ts) сужен до JSON-совместимого `from/to`, потому что `unknown` внутри массива не принимается Prisma `InputJsonValue`.
- `YearGoal.goalsJson` и `PeriodGoal.goalsJson` добавлены в `ENCRYPTED_JSON_FIELDS`.
- В [prisma/schema.prisma](../prisma/schema.prisma) оба `goalsJson` поля переведены с `String` на `Json`.
- Добавлена миграция [prisma/migrations/20260503105000_year_period_goals_json_fields/migration.sql](../prisma/migrations/20260503105000_year_period_goals_json_fields/migration.sql): старые `enc_v1:*` сохраняются как JSON string, plaintext JSON строки парсятся в `jsonb`, invalid/empty значения падают в `[]`.
- [app/api/goals/year/route.ts](../app/api/goals/year/route.ts) и [app/api/goals/period/route.ts](../app/api/goals/period/route.ts) пишут `goalsJson` как массивы напрямую.
- [lib/user-context.ts](../lib/user-context.ts) теперь типизирует `GoalsJsonRecord.goalsJson` как `unknown`, потому что Prisma `Json` после middleware может быть array/object/string.
- Служебные scripts [scripts/fix-duplicates.ts](../scripts/fix-duplicates.ts), [scripts/migrate-year-goals-format.ts](../scripts/migrate-year-goals-format.ts), [scripts/check-quarters.ts](../scripts/check-quarters.ts) переведены с прямого `JSON.parse()` на local safe array parsing.
- `DailyEntry.planSnapshotJson`, `DailyEntry.extraTasksJson`, `DailyEntry.selectedTasksJson` добавлены в `ENCRYPTED_JSON_FIELDS`.
- В [prisma/schema.prisma](../prisma/schema.prisma) три DailyEntry поля переведены на `Json`.
- Добавлена миграция [prisma/migrations/20260503110000_daily_entry_json_fields/migration.sql](../prisma/migrations/20260503110000_daily_entry_json_fields/migration.sql): encrypted strings сохраняются, plaintext JSON strings парсятся, nullable поля падают в `NULL`, `extraTasksJson` в `[]`.
- [app/api/daily/route.ts](../app/api/daily/route.ts) продолжает принимать legacy string payload (`selectedTasksJson`, `extraTasksJson`), но парсит его и пишет Prisma Json arrays; nullable Json пишет через `Prisma.DbNull`.
- [lib/fact-utils.ts](../lib/fact-utils.ts), [hooks/daily/task-helpers.ts](../hooks/daily/task-helpers.ts), [app/tasks/page.tsx](../app/tasks/page.tsx), [app/evaluation/[date]/page.tsx](../app/evaluation/[date]/page.tsx), [app/api/tasks/process-uncompleted/route.ts](../app/api/tasks/process-uncompleted/route.ts), [scripts/backfill-completed-work.ts](../scripts/backfill-completed-work.ts) обновлены на safe parsing `unknown` / Json arrays.
- `Evaluation.suggestedTasksJson` добавлен в `ENCRYPTED_JSON_FIELDS`.
- В [prisma/schema.prisma](../prisma/schema.prisma) `Evaluation.suggestedTasksJson` переведён с `String?` на `Json?`.
- Добавлена миграция [prisma/migrations/20260503111000_evaluation_suggested_tasks_json_field/migration.sql](../prisma/migrations/20260503111000_evaluation_suggested_tasks_json_field/migration.sql): encrypted strings сохраняются, plaintext JSON strings парсятся, invalid/empty значения падают в `NULL`.
- [app/api/evaluate/route.ts](../app/api/evaluate/route.ts), [app/api/evaluate/batch/route.ts](../app/api/evaluate/batch/route.ts), [app/api/tasks/add-suggested/route.ts](../app/api/tasks/add-suggested/route.ts) и [app/evaluation/[date]/page.tsx](../app/evaluation/[date]/page.tsx) обновлены на Prisma Json arrays / `Prisma.DbNull` и `safeParseJson()`.
- Контрольный поиск `\w+Json\s+String|keyAchievements\s+String` по [prisma/schema.prisma](../prisma/schema.prisma) не нашёл совпадений.

### Проверки

- `npx prisma validate` — успешно.
- `npx prisma generate` — успешно.
- `npm test` — успешно: 12 test files, 38 tests.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- После второго среза повторены `npx prisma validate && npx prisma generate`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно.
- После третьего среза повторены `npx prisma validate && npx prisma generate`, `get_errors` по goal routes/schema, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно.
- После encrypted middleware и четвёртого среза повторены `npx prisma validate && npx prisma generate`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно: 13 test files, 40 tests.
- После пятого среза повторены `npx prisma validate && npx prisma generate`, `get_errors` по goal routes/schema/encryption, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно: 13 test files, 40 tests.
- После шестого среза повторены `npx prisma validate && npx prisma generate`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно: 13 test files, 40 tests.
- После седьмого среза повторены `npx prisma validate && npx prisma generate`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно: 13 test files, 41 tests.
- После восьмого среза повторены контрольный schema grep, `npx prisma validate && npx prisma generate`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev` — успешно: 13 test files, 41 tests.

### Следующий шаг

- Перейти к P2 #20: блокировать запуск evaluate, если обработка невыполненных задач не удалась.

---

## P2 #19 — Каскад API-вызовов на goals page

**Статус:** выполнено

### Цель

Заменить стартовый каскад запросов страницы целей одним агрегирующим API-вызовом без изменения существующих операций сохранения, редактирования и удаления целей.

### Разведка

- [app/goals/page.tsx](../app/goals/page.tsx) напрямую грузил progress и year evaluations, а через [hooks/useGoals.ts](../hooks/useGoals.ts), [hooks/usePeriodGoals.ts](../hooks/usePeriodGoals.ts), [hooks/useTrackedGoals.ts](../hooks/useTrackedGoals.ts), [hooks/useDreamGoal.ts](../hooks/useDreamGoal.ts) запускал отдельные запросы за мечтой, тегами, tracked goals, годовыми целями, 2 полугодиями, 4 кварталами, 12 месяцами и неделями выбранного месяца.
- Существующие mutation endpoints и hook methods нужны для сохранений/редактирования, поэтому их контракт не менялся.
- `GET /api/goals/period` возвращал goals with status, но UI страницы целей уже приводил их к строкам и считал completion через tracked goals, поэтому context может отдавать raw string goals.

### Сделано

- Добавлен [app/api/goals/context/route.ts](../app/api/goals/context/route.ts).
- Endpoint `/api/goals/context?year=YYYY` возвращает:
	- актуальную мечту с сохранением прежней семантики `createdAt` от earliest dream,
	- active/archive year metadata,
	- все годовые цели пользователя,
	- period goals выбранного года (`half_year`, `quarter`, `month`, `week`),
	- tracked goals в той же response shape, что `/api/goals/items`,
	- tags,
	- compact dream progress для `DreamBar`,
	- average `dreamProgressScore` по годам для `StrategyCards`.
- Добавлен [lib/goal-response.ts](../lib/goal-response.ts), общий mapper для response shape tracked goals; [app/api/goals/items/route.ts](../app/api/goals/items/route.ts) теперь использует тот же mapper.
- В [lib/types.ts](../lib/types.ts) добавлены `DreamProgressSummary` и `GoalsContextResponse`.
- [hooks/useGoals.ts](../hooks/useGoals.ts) получил `loadGoalsContext(year)` и гидратирует:
	- `dreamGoal`,
	- `yearGoals`,
	- `periodGoals`,
	- `goals`,
	- `tags`,
	- `dreamProgress`,
	- `yearEvaluations`,
	- `archivedYearGoalYears`.
- [hooks/useDreamGoal.ts](../hooks/useDreamGoal.ts), [hooks/usePeriodGoals.ts](../hooks/usePeriodGoals.ts), [hooks/useTrackedGoals.ts](../hooks/useTrackedGoals.ts) получили узкие setters/hydration helpers без изменения публичных mutation flows.
- [app/goals/page.tsx](../app/goals/page.tsx) больше не делает direct `fetch('/api/progress')`, `fetch('/api/goals/year-evaluations')` и не запускает эффекты с множественными `loadYearGoals` / `loadPeriodGoalsWithKey` / `loadAllWeeksForMonth`.

### Проверки

- `rg` по [app/goals/page.tsx](../app/goals/page.tsx) не нашёл `fetch(`, `/api/progress`, `year-evaluations`, `loadYearGoals`, `loadPeriodGoalsWithKey`, `loadAllWeeksForMonth`.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Замечания

- Старые endpoints `/api/goals/year`, `/api/goals/period`, `/api/goals/items`, `/api/goals/tags`, `/api/progress`, `/api/goals/year-evaluations` оставлены для совместимости, других страниц и mutation flows.
- Context endpoint намеренно грузит все week goals выбранного года, поэтому переключение месяца на странице больше не требует отдельного запроса за неделями.

### Следующий шаг

- Перейти к P2 #20: блокировать запуск evaluate, если обработка невыполненных задач не удалась.

---

## P2 #20 — Блокировать evaluate после failed `process-uncompleted`

**Статус:** выполнено как часть P1 #7, подтверждено 03.05.2026

### Проверка

- Перечитан [app/daily/page.tsx](../app/daily/page.tsx) вокруг `handleEvaluateClick()` и `handleUncompletedDecisions()`.
- Подтверждено, что `process-uncompleted` уже вызывается через `fetchJson('/api/tasks/process-uncompleted', ...)`.
- При ошибке API или сетевом исключении `catch` показывает сообщение через `showMessage(...)` и делает `return`.
- `evaluate(router)` находится после `try/catch` и достижим только при успешном ответе `process-uncompleted`.

### Сделано

- Код менять не пришлось: риск был уже закрыт в P1 #7 checked-fetch проходом.
- План обновлён, чтобы P2 #20 не висел как открытый пункт.

### Проверки

- Статическая проверка flow в [app/daily/page.tsx](../app/daily/page.tsx) — failed `process-uncompleted` не продолжает оценку.

---

## P2 #21 — Race condition в `recalculateUserStats`

**Статус:** выполнено

### Цель

Убрать гонку `findFirst` -> `create/update` при параллельном пересчёте пользовательской статистики.

### Проверка перед изменением

- В [lib/user-stats.ts](../lib/user-stats.ts) подтверждён старый pattern: `prisma.userStats.findFirst({ where: { userId } })`, затем `update` по `id` или `create`.
- В [prisma/schema.prisma](../prisma/schema.prisma) проверено, что `UserStats.userId` уже `@unique`, поэтому Prisma `upsert` можно делать без новой миграции.

### Сделано

- Общий payload статистики вынесен в `statsData`.
- Сохранение заменено на атомарный `prisma.userStats.upsert({ where: { userId }, create: { userId, ...statsData }, update: statsData })`.
- Чтение в `getUserStatsForAI()` оставлено без изменений: это read-only lookup и не участвует в create/update гонке.

### Проверки

- `get_errors` для [lib/user-stats.ts](../lib/user-stats.ts) — ошибок нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P2 #22: stale closure в `sendChatMessage`.

---

## P2 #22 — Stale closure в `sendChatMessage`

**Статус:** выполнено

### Цель

Убрать зависимость отправки daily chat от устаревшего `chatMessages` closure, сохранив текущий API-контракт `/api/daily/chat`.

### Проверка перед изменением

- После P2 #13 public [hooks/useDaily.ts](../hooks/useDaily.ts) стал фасадом, а фактический код `sendChatMessage` находится в [hooks/daily/useDailyController.ts](../hooks/daily/useDailyController.ts).
- Подтверждено, что hook уже вычислял `updatedMessages`, но request body отправлял `messages: chatMessages` из closure.
- Проверен [app/api/daily/chat/route.ts](../app/api/daily/chat/route.ts): route принимает `messages` как историю и отдельно добавляет `userMessage` в Claude messages. Поэтому простая отправка `updatedMessages` в `messages` продублировала бы текущее сообщение пользователя.

### Сделано

- В `sendChatMessage` добавлен `currentMessages = chatMessagesRef.current`.
- `updatedMessages` строится от `currentMessages`, а не от captured `chatMessages`.
- При обычном пользовательском сообщении `chatMessagesRef.current` обновляется синхронно вместе с optimistic UI `setChatMessages(updatedMessages)`.
- В request body отправляется `messages: currentMessages` и отдельный `userMessage`, что сохраняет контракт route и не дублирует prompt.
- После ответа AI формируется `finalMessages`, ref обновляется синхронно и затем записывается через `setChatMessages(finalMessages)`.
- `chatMessages` убран из dependency list `sendChatMessage`, потому что актуальная история читается через ref.

### Проверки

- `get_errors` для [hooks/daily/useDailyController.ts](../hooks/daily/useDailyController.ts) — ошибок нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P2 #23: явная обработка ошибок миграций в `docker-entrypoint.sh`.

---

## P2 #23 — Явная обработка ошибок миграций в `docker-entrypoint.sh`

**Статус:** выполнено

### Цель

Сделать production startup failure при ошибке `prisma migrate deploy` явным и понятным в логах контейнера.

### Проверка перед изменением

- [docker-entrypoint.sh](../docker-entrypoint.sh) содержал `set -e` и прямой запуск `node ./node_modules/prisma/build/index.js migrate deploy 2>&1`.
- При ошибке контейнер и так завершался, но без собственного сообщения, объясняющего, что приложение не стартует именно из-за failed migration.

### Сделано

- Фактическая Prisma-команда сохранена, чтобы не менять startup contour и не добавлять `npx` overhead.
- Команда обёрнута в `if ! node ./node_modules/prisma/build/index.js migrate deploy 2>&1; then ... fi`.
- При ошибке пишется `Prisma migration failed — refusing to start` в stderr и выполняется `exit 1` до `exec "$@"`.

### Проверки

- `sh -n docker-entrypoint.sh` — успешно.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P2 #24: уменьшить prop drilling в `TaskCard`.

---

## P2 #24 — Уменьшить prop drilling в `TaskCard`

**Статус:** выполнено

### Цель

Сократить длинный контракт `TaskCard` и `TaskSection`, где один и тот же набор flags/callbacks повторялся для каждой секции задач.

### Проверка перед изменением

- Перечитана [app/tasks/page.tsx](../app/tasks/page.tsx) вокруг `TaskCard`, `TaskSection` и трёх call sites в `TasksPage`.
- Подтверждено, что изменение можно сделать локально в одном файле: UI-разметка, API calls и логика закрытия/удаления/редактирования задач остаются прежними.

### Сделано

- Добавлены типы:
	- `TaskCardState`,
	- `TaskCardActions`,
	- `TaskSectionState`.
- `TaskCard` теперь принимает `task`, `state` и `actions` вместо набора отдельных props для дат, флагов подтверждения и callbacks.
- `TaskSection` теперь принимает общий `state` и `actions`, а внутри собирает per-card `state` с `tone`, `inPlanDate`, `closeRequested` и `deleteRequested`.
- В `TasksPage` добавлены общие `taskSectionState` и `taskSectionActions`.
- Три вызова `TaskSection` для personal/strategic/operational секций переведены на короткий контракт `state={taskSectionState}` и `actions={taskSectionActions}`.
- Старые props `onAddToPlan`, `onRequestClose`, `onConfirmClose`, `onRequestDelete`, `onConfirmDelete`, `onSaveEdit` и связанные флаги удалены из call sites.

### Проверки

- `get_errors` для [app/tasks/page.tsx](../app/tasks/page.tsx) — ошибок нет.
- Контрольный поиск старых `on*` props в [app/tasks/page.tsx](../app/tasks/page.tsx) — совпадений нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P3 #25: добавить Error Boundary (`app/error.tsx`, `app/global-error.tsx`) или выбрать следующий P3-пункт по плану.

---

## P3 #25 — Error Boundary для App Router

**Статус:** выполнено

### Цель

Добавить пользовательский fallback для runtime-ошибок в App Router, чтобы сбой страницы не оставлял пользователя без понятного действия.

### Проверка перед изменением

- Поиск подтвердил, что [app/error.tsx](../app/error.tsx) и [app/global-error.tsx](../app/global-error.tsx) отсутствовали.
- Перечитан [app/layout.tsx](../app/layout.tsx), чтобы route-level fallback визуально попадал в существующий layout, а global fallback мог заменить корневую разметку по convention Next.js.

### Сделано

- Добавлен [app/error.tsx](../app/error.tsx): client boundary с `reset()`, переходом на главную, выводом `digest` при наличии и логированием ошибки в `console.error`.
- Добавлен [app/global-error.tsx](../app/global-error.tsx): client global fallback с собственными `html/body`, импортом [app/globals.css](../app/globals.css), `reset()` и ручной перезагрузкой страницы.
- Тексты fallback'ов сделаны пользовательскими и без раскрытия технических деталей stack trace.

### Проверки

- `get_errors` для [app/error.tsx](../app/error.tsx) и [app/global-error.tsx](../app/global-error.tsx) — ошибок нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P3 #26: заменить оставшиеся `alert()` на toast или inline error state.

---

## P3 #26 — Заменить оставшиеся `alert()` на inline error state

**Статус:** выполнено

### Цель

Убрать browser modal alerts из пользовательских flows прогноза и оценки дня, чтобы ошибки не блокировали интерфейс и отображались в контексте действия.

### Проверка перед изменением

- `rg "alert\\(" app hooks` показал 8 вызовов:
	- 3 в [app/forecast/page.tsx](../app/forecast/page.tsx),
	- 3 в прежнем `hooks/useForecast.ts`,
	- 2 в [app/evaluation/[date]/page.tsx](../app/evaluation/[date]/page.tsx).
- Подтверждено, что прежний `hooks/useForecast.ts` на тот момент не имел активных потребителей, но был сделан безопасным для возможного будущего подключения. Позже в P3 #34 файл удалён как подтверждённый dead code.

### Сделано

- В [app/forecast/page.tsx](../app/forecast/page.tsx):
	- добавлен `errorMessage`,
	- validation errors показываются inline под кнопкой генерации,
	- сетевые/API ошибки показываются через `getFetchErrorMessage()`,
	- ручной `fetch` заменён на общий `fetchJson<ForecastApiResponse>()`.
- В прежнем `hooks/useForecast.ts`:
	- добавлены `errorMessage` и `clearError` в return contract,
	- validation/API failures больше не вызывают `alert()`,
	- генерация прогноза также использует `fetchJson()`.
- В [app/evaluation/[date]/page.tsx](../app/evaluation/[date]/page.tsx):
	- добавлен `taskError`,
	- ошибка отсутствующих данных дня и ошибка добавления suggested task выводятся inline,
	- обновление `addedTasks` переведено на functional setState, чтобы не зависеть от captured `Set`.

### Проверки

- `get_errors` для [app/forecast/page.tsx](../app/forecast/page.tsx), прежнего `hooks/useForecast.ts`, [app/evaluation/[date]/page.tsx](../app/evaluation/[date]/page.tsx) — ошибок нет.
- `rg "alert\\(" app` — совпадений нет.
- `rg "alert\\(" hooks` — совпадений нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к следующему пункту P3-бэклога после уточнения/добавления новых низкоприоритетных задач.

---

## P3 #27 — ESLint с `eslint-config-next` и React Hooks rules

**Статус:** выполнено

### Цель

Подключить Next.js ESLint presets и сделать React Hooks rules явной частью lint-контура без миграции Next/React версий.

### Проверка перед изменением

- [eslint.config.mjs](../eslint.config.mjs) использовал только `@eslint/js` и `typescript-eslint`, хотя [package.json](../package.json) уже содержал `eslint-config-next@16.2.4`.
- `eslint-plugin-react-hooks@7.0.1` уже присутствовал в [package-lock.json](../package-lock.json) транзитивно через `eslint-config-next`, но не был закреплён прямой dev-зависимостью.
- Проверены peer ranges: `eslint-plugin-react-hooks@7.0.1` поддерживает ESLint 9; `eslint-config-next@16.2.4` ожидает ESLint `>=9.0.0`.

### Сделано

- Выполнено `npm install --save-dev eslint-plugin-react-hooks@7.0.1`; обновлены [package.json](../package.json) и [package-lock.json](../package-lock.json).
- [eslint.config.mjs](../eslint.config.mjs) переведён на flat presets:
	- `eslint-config-next/core-web-vitals`,
	- `eslint-config-next/typescript`.
- Сохранены локальные TypeScript-настройки:
	- `@typescript-eslint/no-unused-vars` как warning с `argsIgnorePattern: "^_"`,
	- `@typescript-eslint/no-explicit-any` как warning.
- Явно зафиксированы stable hooks rules:
	- `react-hooks/rules-of-hooks`: `error`,
	- `react-hooks/exhaustive-deps`: `warn`.
- Отключены React Compiler diagnostics:
	- `react-hooks/set-state-in-effect`,
	- `react-hooks/preserve-manual-memoization`.
- Исправлены две JSX quote-ошибки, которые surfaced после подключения Next/React правил:
	- кавычки вокруг suggested habit в [app/daily/page.tsx](../app/daily/page.tsx),
	- заголовок сценариев в [app/forecast/page.tsx](../app/forecast/page.tsx).

### Проверки

- `npm run lint` — завершился успешно без errors; осталось 11 warnings:
	- 10 `react-hooks/exhaustive-deps`,
	- 1 `@next/next/no-page-custom-font` в [app/layout.tsx](../app/layout.tsx), который относится к P3 #28.
- `get_errors` для [eslint.config.mjs](../eslint.config.mjs), [package.json](../package.json), [app/daily/page.tsx](../app/daily/page.tsx), [app/forecast/page.tsx](../app/forecast/page.tsx) — ошибок нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- `npm ls eslint-plugin-react-hooks eslint-config-next eslint --depth=1` подтвердил:
	- `eslint-config-next@16.2.4`,
	- `eslint-plugin-react-hooks@7.0.1`,
	- `eslint@9.39.1`.

### Остаточные риски

- `react-hooks/exhaustive-deps` warnings теперь видны и должны разбираться отдельным безопасным проходом: часть исправлений может менять поведение effects/callbacks, поэтому они намеренно не смешаны с конфигурационной задачей.
- Полный `npm audit` без `--omit=dev` по-прежнему показывает dev-only vulnerabilities в lint/tooling graph; production audit чистый.

### Следующий шаг

- Перейти к P3 #28: заменить custom font `<link>` в [app/layout.tsx](../app/layout.tsx) на `next/font`.

---

## P3 #28 — Next.js font optimization

**Статус:** выполнено

### Цель

Заменить ручную загрузку Google Fonts через `<link>` в root layout на `next/font/google`, чтобы убрать Next lint warning и использовать встроенную оптимизацию шрифтов.

### Проверка перед изменением

- [app/layout.tsx](../app/layout.tsx) содержал `preconnect` и stylesheet link на Google Fonts для `Orbitron` и `Manrope`.
- [app/globals.css](../app/globals.css) явно использовал `'Manrope', sans-serif` в навигационных классах.
- `rg` подтвердил, что других прямых ссылок на Google Fonts в `app/**` нет.

### Сделано

- В [app/layout.tsx](../app/layout.tsx) подключены `Manrope` и `Orbitron` из `next/font/google`.
- На `<html>` добавлены CSS variables `--font-manrope` и `--font-orbitron`.
- На `<body>` добавлен `manrope.className`, чтобы базовый интерфейс использовал тот же основной шрифт без ручного stylesheet.
- Ручной `<head>` с `fonts.googleapis.com` / `fonts.gstatic.com` удалён.
- В [app/globals.css](../app/globals.css) навигационные классы переведены с literal `'Manrope'` на `var(--font-manrope)`.

### Проверки

- `get_errors` для [app/layout.tsx](../app/layout.tsx) и [app/globals.css](../app/globals.css) — ошибок нет.
- `rg "fonts.googleapis|fonts.gstatic" app/**` — совпадений нет.
- `npm run lint` — успешно, warning `@next/next/no-page-custom-font` исчез; осталось 10 warnings `react-hooks/exhaustive-deps` из P3 #27.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P3 #29: проверить и добавить ресурсные лимиты `tg-bot.service`, если unit-файл есть в репозитории.

---

## P3 #29 — Ресурсные лимиты `tg-bot.service`

**Статус:** выполнено

### Цель

Ограничить потребление ресурсов Telegram bot long-polling systemd service, чтобы зависание или runaway process не забирали память/CPU хоста.

### Проверка перед изменением

- Найден unit-файл [scripts/tg-bot.service](../scripts/tg-bot.service).
- В секции `[Service]` уже были `Restart=always`, `RestartSec=10`, `User=ubuntu`, `WorkingDirectory`, но не было `MemoryMax` и `CPUQuota`.

### Сделано

- В [scripts/tg-bot.service](../scripts/tg-bot.service) добавлены:
	- `MemoryMax=256M`,
	- `CPUQuota=25%`.

### Проверки

- `grep`/workspace search подтвердил наличие обеих директив в секции `[Service]`.
- `get_errors` для [scripts/tg-bot.service](../scripts/tg-bot.service) — ошибок нет.
- `systemd-analyze verify` не запускался полноценно: в текущей macOS-среде `systemd-analyze` не доступен.

### Следующий шаг

- Перейти к P3 #30: исправить устаревание `today` после полуночи в [app/page.tsx](../app/page.tsx).

---

## P3 #30 — `today` устаревает после полуночи

**Статус:** выполнено

### Цель

Исправить главную страницу, которая держала дату из первого mount и могла показывать/загружать вчерашний день после полуночи.

### Проверка перед изменением

- В [app/page.tsx](../app/page.tsx) `today` был создан как `const [today] = useState(new Date())` без setter.
- `today` использовался для:
	- ссылки на evaluation текущего дня,
	- заголовка даты,
	- `GET /api/daily?date=...`,
	- week goal query через `startOfWeek(today)`.

### Сделано

- Добавлен helper `getDateKey(date)` для date-only сравнения.
- `today` заменён на `useState(() => new Date())` с setter.
- Добавлен effect `refreshToday`, который:
	- слушает `document.visibilitychange`,
	- слушает `window.focus`,
	- раз в минуту проверяет смену date-key,
	- не обновляет state, если календарный день не изменился.
- `fetchData` переведён на `useCallback([today])` и effect загрузки данных зависит от `fetchData`, поэтому при смене даты главная перезагружает daily/week data для нового дня.

### Проверки

- `get_errors` для [app/page.tsx](../app/page.tsx) — ошибок нет.
- `npm run lint` — успешно без errors; warning по [app/page.tsx](../app/page.tsx) исчез, осталось 9 `react-hooks/exhaustive-deps` warnings в других файлах.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Следующий шаг

- Перейти к P3 #31: аудит `'use client'` директив и поиск компонентов, которые можно сделать серверными.

---

## P3 #31 — Аудит `'use client'` директив

**Статус:** выполнен первый безопасный срез

### Цель

Снять лишние client boundaries там, где компоненты не используют hooks, browser APIs, context, router или event handlers.

### Проверка перед изменением

- Проведён read-only аудит файлов с `'use client'` в `app/`, `components/`, `hooks/`.
- Подтверждено, что все `hooks/**` и большинство app/pages/components остаются client-side по реальным причинам: `useState`, `useEffect`, `useAuth`, `useRouter`, `usePathname`, callbacks, drag/edit interactions.
- Отдельно проверен пример [app/analytics/page.tsx](../app/analytics/page.tsx): страница read-only по данным, но сейчас грузит trend data через `useEffect` и state; простое снятие директивы невозможно без server data-loading refactor.

### Сделано

- Удалена лишняя директива `'use client'` из pure presentational components:
	- `components/BalanceFlags.tsx` — позже удалён в P3 #34 как dead code,
	- [components/ProgressIndicator.tsx](../components/ProgressIndicator.tsx),
	- `components/goals/HorizonsCard.tsx` — позже удалён в P3 #34 как dead code.
- JSX и логика компонентов не менялись.

### Проверки

- `get_errors` для трёх изменённых компонентов — ошибок нет.
- `npm run lint` — успешно без errors; осталось 9 `react-hooks/exhaustive-deps` warnings в других файлах.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run build` — успешно; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.
- Контрольный поиск показал 48 оставшихся явных `'use client'` директив в `app/components/hooks` scope.

### Остаточные риски

- Дальнейшее уменьшение client surface требует не механического удаления директив, а разделения страниц на server data loaders и client interactive children. Это особенно актуально для [app/analytics/page.tsx](../app/analytics/page.tsx), [app/profile/page.tsx](../app/profile/page.tsx), [app/daily/page.tsx](../app/daily/page.tsx), [app/goals/page.tsx](../app/goals/page.tsx).

### Следующий шаг

- Перейти к P3 #32: bundle size аудит через Next-compatible tooling.

---

## P3 #32 — Bundle size аудит

**Статус:** выполнено как audit-only срез

### Цель

Получить актуальную картину client bundle size на Next.js 16/Turbopack, не меняя production config и не добавляя analyzer-зависимость без необходимости.

### Проверка tooling перед запуском

- Проверен [next.config.js](../next.config.js): analyzer не подключён, production build использует `output: 'standalone'`, `reactStrictMode: true`, `serverExternalPackages: ['bcrypt']` и security headers.
- Проверен [package.json](../package.json): отдельного bundle analyzer dependency/script нет.
- Проверено существование `@next/bundle-analyzer@16.2.4`: версия есть, dependency — `webpack-bundle-analyzer@4.10.1`.
- Проверен `npx next build --help`: для текущего Turbopack-контура доступен встроенный флаг `--experimental-analyze` с пометкой “Only compatible with Turbopack”.
- Принято решение не менять [next.config.js](../next.config.js) и не добавлять `@next/bundle-analyzer`, потому что встроенный analyzer точнее соответствует Next.js 16/Turbopack build path.

### Сделано

- Запущен `npx next build --experimental-analyze`.
- Build завершился успешно; остались только известные предупреждения:
	- deprecated `middleware` convention / будущий переход на `proxy`,
	- устаревший Browserslist/caniuse-lite,
	- Edge runtime disables static generation.
- Analyzer artifacts найдены в:
	- `.next/diagnostics/analyze/`,
	- `.next/diagnostics/route-bundle-stats.json`.
- Дополнительно просмотрены `.next/static/chunks` и route bundle stats, чтобы выделить самые крупные маршруты и shared chunks.

### Результаты аудита

Крупнейшие first-load uncompressed JS routes:

| Route | Size | Chunks |
| --- | ---: | ---: |
| `/analytics` | 905.7 KiB | 11 |
| `/goals` | 653.6 KiB | 12 |
| `/` | 621.4 KiB | 13 |
| `/daily` | 612.9 KiB | 13 |
| `/tasks` | 582.6 KiB | 12 |
| `/forecast` | 575.7 KiB | 12 |
| `/periods` | 571.3 KiB | 12 |
| `/periods/[id]` | 568.6 KiB | 12 |
| `/history` | 568.2 KiB | 12 |
| `/evaluation/[date]` | 565.3 KiB | 12 |
| `/progress` | 547.7 KiB | 11 |
| `/reset-password` | 531.8 KiB | 11 |

Крупные chunks:

- `0ht7om9gej82g.js` — ~385.0 KiB, используется 1 route; grep по minified chunk показывает `recharts-*`, `LineChart`, `Bar`, `Tooltip`, `Legend`, оси и shape-компоненты. Это основной кандидат для `/analytics`.
- `0rnqmir4cd5p9.js` — ~227.3 KiB, используется 19 routes; по содержимому похож на общий React/DOM/event runtime.
- `0pa24m5~18l_8.js` — ~134.0 KiB, используется 19 routes; по содержимому похож на Next/App Router/RSC runtime.
- Остальные shared chunks на 19 routes меньше: ~53.4 KiB, ~43.8 KiB, ~29.7 KiB.

### Вывод

- Главный подтверждённый bundle hotspot — [app/analytics/page.tsx](../app/analytics/page.tsx), потому что страница тянет тяжёлую charting-библиотеку в route-specific chunk.
- Большая часть shared JS — framework/runtime baseline для App Router, поэтому без изменения архитектуры client boundaries быстрых безопасных сокращений здесь не видно.
- Низкорисковая правка прямо в P3 #32 не внесена: простая замена/ленивая загрузка графиков требует отдельной UX-проверки, чтобы не ухудшить analytics workflow.

### Рекомендации

- Следующим performance-пунктом сделать отдельную задачу по `/analytics`:
	1. Измерить текущий UX: какие графики нужны сразу above-the-fold.
	2. Вынести Recharts-зависимые блоки в отдельный lazy client child или dynamic import с понятным skeleton.
	3. Повторить `npx next build --experimental-analyze` и сравнить `/analytics` first-load JS до/после.
- Не трогать shared runtime chunks без более крупного server/client boundary refactor и повторных замеров.

### Проверки

- `npx next build --experimental-analyze` — успешно.
- `grep` по largest route-specific chunk подтвердил, что chunk содержит `recharts`.
- `.next/diagnostics/analyze/data/modules.data` и route `analyze.data` являются binary analyzer data; текстом прочитаны только route stats и generated text/html artifacts.

### Остаточные риски

- Analyzer metrics — uncompressed JS, поэтому network impact на gzip/brotli будет меньше, но parse/execute cost у крупного charting chunk всё равно остаётся.
- Без runtime performance профиля нельзя утверждать, что bundle size сейчас является пользовательской проблемой, только что есть очевидный hotspot для будущей оптимизации.

### Следующий шаг

- Перейти к P3 #33: проверить денормализованные поля `UserStats` и решить, нужен ли VIEW/TTL cache или достаточно текущего пересчёта.

---

## P3 #33 — Денормализованные поля `UserStats`

**Статус:** выполнено как архитектурная проверка, без изменения кода

### Цель

Проверить, нужно ли заменять денормализованные поля [prisma/schema.prisma](../prisma/schema.prisma) модели `UserStats` на DB VIEW или TTL-cache, либо текущий подход является оправданным materialized cache.

### Проверка кода

- [lib/user-stats.ts](../lib/user-stats.ts) содержит две публичные операции:
	- `recalculateUserStats(userId)` — пересчитывает snapshot по оценённым `DailyEntry` и делает `prisma.userStats.upsert({ where: { userId } })`.
	- `getUserStatsForAI(userId)` — читает готовый snapshot и форматирует компактный AI-context.
- `UserStats.userId` в [prisma/schema.prisma](../prisma/schema.prisma) уже `@unique`, поэтому текущий `upsert` атомарен по пользователю.
- Запись snapshot вызывается после write-path оценки:
	- [app/api/evaluate/route.ts](../app/api/evaluate/route.ts) — после одиночной оценки дня.
	- [app/api/evaluate/batch/route.ts](../app/api/evaluate/batch/route.ts) — один раз в конце batch-оценки.
- Чтение snapshot найдено в [app/api/daily/chat/route.ts](../app/api/daily/chat/route.ts), где `getUserStatsForAI(userId)` входит в параллельную сборку AI-контекста.
- Других UI/API consumers, которые зависят от отдельных полей `UserStats`, не найдено.

### Вывод

- `UserStats` сейчас не является источником истины; это materialized summary поверх `DailyEntry` + `Evaluation`.
- DB VIEW не подходит как простая замена: текущий расчёт включает keyword extraction из текста задач, streak tracking, recent-vs-previous trend, выбор оптимального количества задач и JSON aggregates. Перенос этого в SQL усложнит поддержку сильнее, чем уменьшит техдолг.
- TTL-cache не нужен: stale-window был бы хуже текущей модели, потому что пересчёт уже привязан к write path оценки. После batch endpoint пересчёт сделан один раз, что защищает от N пересчётов на N дней.
- Текущий подход стоит оставить, пока объём оценённых дней на пользователя не станет заметной performance-проблемой. Если такая проблема появится, правильная следующая оптимизация — incremental aggregation или background job, а не VIEW.

### Решение

- Код и Prisma schema не менялись.
- Пункт закрыт как проверенное архитектурное решение: оставить `UserStats` materialized cache, не добавлять VIEW/TTL-cache сейчас.

### Проверки

- Поиск usages `UserStats|userStats|recalculateUserStats|getUserStatsForAI` подтвердил ограниченный контур read/write.
- `get_errors` для обновлённых документов — ошибок нет.

### Остаточные риски

- `recalculateUserStats(userId)` каждый раз сканирует все оценённые дни пользователя. Это нормально для текущего масштаба, но при росте истории может стать latency-cost после оценки.
- Если появятся новые write paths, которые меняют `DailyEntry.planText`, `selectedTasksJson` или `Evaluation`, им нужно будет явно вызывать пересчёт или перейти на background/incremental модель.

### Следующий шаг

- Перейти к P3 #34: dead code audit последним проходом, сначала только в report mode и с ручной классификацией результатов.

---

## P3 #34 — Dead code audit последним проходом

**Статус:** выполнен первый cleanup-проход

### Цель

Проверить unused files/exports/dependencies после закрытия функциональных и security-пунктов, удалить только подтверждённый dead code и не трогать framework/ops/manual entrypoints по одному import-графу.

### Проверка tooling

- Проверена актуальная версия `knip`: `6.11.0`.
- Проверены engine requirements: `node ^20.19.0 || >=22.12.0`.
- Локальный runtime подходит: `node v24.10.0`, `npm 11.6.0`.
- `npx knip@6.11.0 --help` был заменён на `npm exec --yes knip@6.11.0 -- ...`, чтобы избежать интерактивной установки/ожидания.

### Отчёт до удаления

Команда:

```bash
npm exec --yes knip@6.11.0 -- --production --no-progress --reporter compact --no-exit-code --max-show-issues 200
```

Исходный report:

- Unused files: 18.
- Unused exports: 20.
- Unused exported types: 18.
- Duplicate exports: 2.

### Удалено как подтверждённый source dead code

- `components/BalanceFlags.tsx` — runtime imports не найдены; компонент упоминался только в docs/legacy status.
- `components/ThemeToggle.tsx` — runtime imports не найдены; компонент возвращал `null`, приложение всегда использует dark mode.
- `components/goals/HorizonsCard.tsx` — runtime imports не найдены; упоминался только в docs/status.
- `components/goals/WeekStrip.tsx` — default component не использовался, а тип `WeekData` был нужен только [components/goals/WeekCard.tsx](../components/goals/WeekCard.tsx).
- `hooks/useForecast.ts` — активных consumers не было; forecast page содержит собственную реализацию.

Сопутствующие правки:

- `WeekData` перенесён локально в [components/goals/WeekCard.tsx](../components/goals/WeekCard.tsx).
- Из [hooks/index.ts](../hooks/index.ts) удалён re-export `useForecast`.
- Активные plan/log записи P3 #26 и P3 #31 обновлены, чтобы не оставлять кликабельные ссылки на удалённые файлы.

### Отчёт после удаления

Повторный `knip` report:

- Unused files: 15.
- Unused exports: 18.
- Unused exported types: 18.
- Duplicate exports: 2.

Оставленные `unused files` классифицированы как неавтоматические deletion candidates:

- [cloudflare-proxy/src/index.js](../cloudflare-proxy/src/index.js) — Worker entrypoint через `wrangler.toml`, не импортируется Next-приложением.
- `scripts/cleanup-expired.mjs` — запускается cron/docker exec, есть npm script `cleanup:expired`.
- `scripts/backfill-completed-work.ts`, `scripts/check-quarters.ts`, `scripts/fix-duplicates.ts`, `scripts/migrate-year-goals-format.ts`, `scripts/reset-password.ts`, encryption/check scripts — manual/ops tools, часть документирована в deploy/development docs.
- `fix-gradients.js`, `scripts/_debug-apr28.js`, `scripts/update-docs.js`, `test-wave.mjs` — legacy/manual/debug utilities; требуют отдельного product/ops решения перед удалением.

Оставленные `unused exports/types`:

- В основном barrel exports, public helper APIs, prompt/AI DTO types и auth/helper functions. Их нельзя безопасно удалять пакетом без отдельной проверки call sites, tests и документации.
- Duplicate exports `MONTH_NAMES/monthNames` и `getTaskCategory/getTaskType` выглядят как deliberate compatibility aliases после предыдущих refactors; оставлены без изменения.

### Проверки

- `get_errors` для [components/goals/WeekCard.tsx](../components/goals/WeekCard.tsx), [hooks/index.ts](../hooks/index.ts) — ошибок нет.
- Повторный `knip` report подтвердил уменьшение unused files с 18 до 15.
- `get_errors` для активных plan/log документов — ошибок нет.
- `npm run typecheck` — успешно.
- `npm test` — успешно: 13 test files, 41 tests.
- `npm run lint` — успешно без errors; осталось 9 известных `react-hooks/exhaustive-deps` warnings.
- `npm run build` — успешно на Next.js 16.2.4/Turbopack; остались известные warnings Next middleware/proxy, Browserslist, Edge runtime.
- `npm audit --omit=dev` — успешно, `found 0 vulnerabilities`.

### Остаточные риски

- Legacy docs вроде README/ARCHITECTURE/PROJECT_STATUS всё ещё могут упоминать удалённые исторические компоненты как часть старой структуры. Это documentation drift, но не runtime-риск; лучше чистить отдельным docs refresh, чтобы не смешивать с code cleanup.
- Следующий dead-code проход можно делать точечно по unused exports/types после стабилизации публичных helper APIs.

### Следующий шаг

- Основной план A1-A7 и 1-34 закрыт. Следующие работы лучше вести как отдельные targeted follow-up задачи: hook dependency audit, `/analytics` bundle optimization, docs refresh по README/ARCHITECTURE/PROJECT_STATUS и точечная проверка public unused exports.
