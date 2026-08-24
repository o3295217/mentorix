# Инфраструктура проекта AI Assistant

> Актуальность: 18 июля 2026

## Серверы

### Production — Contabo
- **Домен:** https://mentorix.aionlab.ru
- **SSH:** `ssh contabo` (алиас в `~/.ssh/config`)
- **Пользователь:** `oleg`
- **Путь проекта:** `/home/oleg/ai-assistant-spec`
- **ОС:** Ubuntu
- **DNS:** домен `mentorix.aionlab.ru` указывает на production-сервер; IP хранится в SSH/DNS-конфигурации, не в репозитории

## Расположение
- **Локально:** корень текущего git-репозитория
- **На сервере:** `/home/oleg/ai-assistant-spec`
- **GitHub:** https://github.com/o3295217/ai-assistant-spec

## Docker
- **Контейнеры:** `ai-assistant-production`, `ai-assistant-db`, `ai-assistant-backup`
- **Порт:** 3000 (только `127.0.0.1`, проксируется через nginx)
- **URL:** https://mentorix.aionlab.ru
- **Compose файл:** `docker-compose.production.yml`
- **Env файл:** `.env.production` (на сервере, исключён из git/rsync)

## Web-сервер
- **Nginx** — reverse proxy (порт 80/443 → localhost:3000)
- **SSL:** Let's Encrypt (certbot, автопродление)
- **Конфиг:** `/etc/nginx/sites-available/ai-assistant`
- **Rate limiting:** `general_limit` — 60 запросов/сек, burst 30 (для `/api/`). Ранее использовался `post_limit` (10 запросов/мин), который блокировал параллельные GET-запросы при загрузке страниц.

## Быстрые команды

### Деплой (с мака)
```bash
./deploy/deploy-contabo.sh
```

### SSH на сервер
```bash
ssh contabo
```

### Проверка на сервере
```bash
# Статус контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}'

# Логи приложения
docker logs -f ai-assistant-production

# Логи БД
docker logs -f ai-assistant-db

# Перезапуск
cd /home/oleg/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml up -d

# Пересборка
cd /home/oleg/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache && docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

### База данных
- **СУБД:** PostgreSQL 16 (контейнер `ai-assistant-db`)
- **Данные:** Docker volume `pgdata`
- **Подключение:** `docker exec -it ai-assistant-db psql -U ai_assistant`
- **Проверка таблиц:** `\dt` внутри psql

### Бэкап

Бэкап работает автоматически через Docker-контейнер `ai-assistant-backup` (ежедневно в 03:00, хранит 30 последних зашифрованных файлов `pg_*.sql.gz.enc`). Контейнер собирается из `Dockerfile.backup` на базе `postgres:16-alpine` с предустановленным `openssl`, чтобы шифрование было доступно при первом запуске и в cron. Ключ хранится на сервере вне проекта: `/home/oleg/.backup-key`.

```bash
# Ручной бэкап
docker exec ai-assistant-backup /usr/local/bin/prod-backup.sh

# Проверка лога
cat backups/backup.log

# Расшифровка для восстановления
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass file:/home/oleg/.backup-key \
  -in backups/pg_YYYY-MM-DD_HH-MM-SS.sql.gz.enc \
  | gunzip \
  | docker exec -i ai-assistant-db psql -U ai_assistant
```

### Очистка auth-токенов

Скрипт `scripts/cleanup-expired.mjs` удаляет expired sessions, expired reset/email verification tokens и уже использованные reset/email verification tokens.

```bash
# Ручной запуск внутри production-контейнера
docker exec ai-assistant-production node scripts/cleanup-expired.mjs

# Рекомендуемый cron на сервере
15 4 * * * docker exec ai-assistant-production node scripts/cleanup-expired.mjs >> /home/oleg/ai-assistant-spec/backups/cleanup-expired.log 2>&1
```

### Проверка алертов мониторинга (с мака)
```bash
bash scripts/check-alerts.sh
```

### Зафиксированные IP
```bash
ssh contabo 'cat /home/oleg/ai-assistant-spec/logs/monitor/known_ips.txt'
```

## Внешние API (без Cloudflare)

Текущая production-архитектура на Contabo использует прямые исходящие HTTPS-запросы:

```
Contabo production → api.anthropic.com
Contabo production → api.telegram.org
```

- Anthropic: `lib/anthropic.ts` лениво инициализирует официальный SDK без `baseURL` и proxy-заголовков.
- Telegram: `lib/telegram.ts`, `scripts/monitor.sh` и `scripts/tg-bot.sh` отправляют запросы напрямую в Telegram Bot API.
- `deploy/deploy-contabo.sh` не запускает `wrangler` и перед Docker build проверяет прямую доступность `api.anthropic.com` без API-ключа.
- Proxy-переменные и Worker-конфиги не используются в runtime.

Cloudflare/Wrangler/Workers не являются частью текущей production-инфраструктуры.

### Dormant Worker fallback

Исходники `cloudflare-proxy/` и `cloudflare-tg-proxy/` сохранены только как архивный fallback. Оба Worker по умолчанию отключены через `WORKER_ENABLED = "false"` в `wrangler.toml` и отвечают 503 до проверки proxy-secret, rate limit или вызова upstream. Их нельзя деплоить или включать без отдельного operational/security решения.

---

## Переменные окружения (на сервере)
Файл: `/home/oleg/ai-assistant-spec/.env.production`

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Секрет auth/session подписи |
| `ENCRYPTION_KEY` | Ключ шифрования полей БД |
| `ANTHROPIC_API_KEY` | Ключ API Claude для прямого доступа к `api.anthropic.com` |
| `COOKIE_SECURE` | `true` (HTTPS) |
| `REGISTRATION_MODE` | `open` / `invite` / `closed` |
| `SMTP_HOST` / `SMTP_PORT` | SMTP-сервер |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials |
| `SMTP_FROM` | Адрес отправителя (для Gmail — сам аккаунт или его алиас) |
| `EMAIL_FROM_NAME` | Отображаемое имя отправителя (по умолчанию `mentorix`) |
| `NEXT_PUBLIC_APP_URL` | https://mentorix.aionlab.ru; обязательна на build-time (`app.build.args`) и runtime (`environment`), публичная не-secret переменная |

`NEXT_PUBLIC_APP_URL` используется Next.js во время `next build` для standalone/metadata и остаётся в runtime env для ссылок в email/API helpers. В build args передаётся только эта публичная переменная; Dockerfile валидирует её через Node URL parser (строго `https://`, hostname обязателен, credentials запрещены). `.dockerignore` и deploy rsync рекурсивно исключают `.env*`, key/secrets/cert paths (`*.pem`, `*.key`, `*.p12`, `*.pfx`) и SQL/backup dumps; обратно включаются только `prisma/migrations/**/migration.sql`, чтобы Prisma migrations оставались в Docker build context/remote sync.

## Автозапуск
- systemd сервис: `ai-assistant.service`
- Контейнеры запускаются автоматически при загрузке сервера

## SSH Config (на маке)
```sshconfig
Host contabo
  # HostName/User/IdentityFile настроены локально; IP не хранится в репозитории.
  User oleg
```

## Безопасность

> Обновлено: 25 марта 2026 — после инцидента с криптомайнером TeamTNT

### Инцидент (24 марта 2026)
Контейнер `ai-assistant-production` был заражён криптомайнером TeamTNT через открытый порт 3000 (был доступен всему интернету, минуя nginx). Малварь скачала бинарники в `/tmp/` и запустила 5 процессов-майнеров. Хост-система не пострадала — заражение ограничилось контейнером. Инцидент сохраняется как security history без привязки к текущему production-провайдеру.

### Принятые меры

| Мера | Статус | Описание |
|------|--------|----------|
| Порт 3000 → 127.0.0.1 | ✅ | Контейнер слушает только localhost, доступ только через nginx |
| ufw firewall | ✅ | Включён, разрешены только порты 22, 80, 443 |
| read_only: true | ✅ | Файловая система контейнера только для чтения |
| tmpfs /tmp noexec | ✅ | /tmp — 50 МБ, флаг noexec запрещает выполнение бинарников |
| no-new-privileges | ✅ | Запрет эскалации привилегий внутри контейнера |
| Контейнер пересоздан | ✅ | Чистый образ собран с нуля (`--no-cache`) |

### Checklist при деплое
- [ ] Убедиться что порт 3000 привязан к `127.0.0.1` в docker-compose
- [ ] Убедиться что `ufw` активен (`sudo ufw status`)
- [ ] Проверить процессы в контейнере (`docker exec ai-assistant-production ps aux`)
- [ ] Проверить `/tmp/` в контейнере (`docker exec ai-assistant-production ls -la /tmp/`)
- [ ] Проверить что мониторинг в cron (`ssh contabo 'crontab -l'`)
- [ ] Проверить алерты (`bash scripts/check-alerts.sh`)

### Мониторинг безопасности

Автоматический скрипт `scripts/monitor.sh` запускается каждые 30 минут через cron и проверяет:

| # | Проверка | Алерт при |
|---|----------|-----------|
| 1 | Процессы контейнера | Более 3 процессов |
| 2 | Файлы в /tmp/ | Наличие файлов |
| 3 | Health endpoint | HTTP ≠ 200 |
| 4 | CPU/RAM контейнера | CPU > 80% |
| 5 | CPU/RAM/диск хоста | Диск > 85% |
| 6 | Подозрительные процессы | xmrig, cryptonight и т.д. |
| 7 | Firewall | ufw не активен |
| 8 | Порт 3000 | Открыт на 0.0.0.0 |
| 9 | Docker security flags | read_only или no-new-privileges отключены |
| 10 | SSH-входы | Вход с неизвестным SSH-ключом |
| 11 | Anthropic API | > 100 вызовов за 30 мин |
| 12 | Ротация логов | Автоочистка старше 30 дней |

**SSH-мониторинг** работает по отпечатку ключа (не по IP). IP владельца автоматически записываются в `known_ips.txt` — удобно при использовании VPN.

**Логи:**
- `/home/oleg/ai-assistant-spec/logs/monitor/YYYY-MM-DD.log` — ежедневный лог
- `/home/oleg/ai-assistant-spec/logs/monitor/alerts.log` — только алерты
- `/home/oleg/ai-assistant-spec/logs/monitor/known_ips.txt` — зафиксированные IP владельца
- `/home/oleg/ai-assistant-spec/logs/monitor/cron.log` — вывод cron

**Проверка алертов (с мака):**
```bash
bash scripts/check-alerts.sh
```

### Telegram-бот (@ai_ion_assist_monitor_bot)

Бот для управления сервером прямо из Telegram. Работает как systemd-сервис `tg-bot` на сервере (long polling, bash + jq).

**Интерфейс:** inline-кнопки с русскоязычными названиями. При любом сообщении или `/start` показывает меню.

**Кнопки меню:**
| Кнопка | Действие |
|--------|----------|
| 📊 Состояние сервера | Статус контейнеров, нагрузка, диск, безопасность |
| 🛡 Проверка безопасности | Запуск полной проверки (12 чеков из monitor.sh) |
| ⚠️ Алерты за сегодня | Список сегодняшних алертов из alerts.log |
| 👥 Пользователи | Список пользователей из базы данных |
| 🌐 IP-адреса | Зафиксированные SSH-входы владельца |

**Автоматические алерты с кнопками действий:**

| Алерт | Кнопка действия | Что делает |
|-------|----------------|------------|
| Сайт недоступен (health ≠ 200) | 🔄 Перезапустить контейнер | `docker compose restart app` |
| Контейнер не запущен | 🔄 Перезапустить контейнер | `docker compose restart app` |
| CPU контейнера > 80% | 🔄 Перезапустить контейнер | `docker compose restart app` |
| Диск заполнен > 85% | 🧹 Очистить диск | Docker prune + удаление логов старше 7 дней |
| Криптомайнер обнаружен | 🛑 Остановить и пересобрать | Stop → rm → build --no-cache → up |

**Безопасность:** бот отвечает только на `TG_CHAT_ID` владельца. Бот-токен не хранится в репозитории.

**Хранение секретов на сервере:**
- `/home/oleg/.tg-bot-token` — только `TG_BOT_TOKEN`
- `/home/oleg/.tg-bot-env` — `TG_CHAT_ID=...`
- `/home/oleg/ai-assistant-spec/.env.production` — `TG_BOT_TOKEN` и `TG_CHAT_ID` для контейнера приложения

**Файлы:**
- `scripts/tg-bot.sh` — скрипт бота (bash + jq для парсинга JSON)
- `scripts/tg-bot.service` — systemd unit-файл
- `scripts/monitor.sh` — мониторинг, отправляет алерты с кнопками действий

**Управление сервисом:**
```bash
sudo systemctl status tg-bot
sudo systemctl restart tg-bot
sudo journalctl -u tg-bot --no-pager -n 50
```

> **Важно:** При деплое (`deploy/deploy-contabo.sh`) бот перезапускается автоматически best-effort. Это необходимо, потому что при пересоздании Docker-контейнера бот может зависнуть на `docker exec`.

**После ротации Telegram-токена:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart tg-bot
cd /home/oleg/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate app
```

**Автоматические уведомления** (кроме кнопок):
- Алерты мониторинга — из `scripts/monitor.sh` (каждые 30 мин)
- Новые регистрации — из `app/api/auth/register/route.ts`
- Ошибки Anthropic API — из `lib/anthropic.ts` (после исчерпания ретраев)
- Общая утилита: `lib/telegram.ts` (дедупликация, кулдаун 5 мин)

**Cron (на сервере):**
```cron
*/30 * * * * sudo /bin/sh /home/oleg/ai-assistant-spec/scripts/monitor.sh >> /home/oleg/ai-assistant-spec/logs/monitor/cron.log 2>&1
```

### Ротация секретов
После компрометации контейнера нужно сменить:
- `ANTHROPIC_API_KEY` — на https://console.anthropic.com
- `AUTH_SECRET` — сгенерировать новый: `openssl rand -hex 32`
- `TG_BOT_TOKEN` — перевыпустить через @BotFather и обновить в `.tg-bot-token` и `.env.production`

### Сессии после P0-фикса
- Сессионные токены в БД теперь хранятся как SHA-256 hash
- При выкладке миграции `20260401000000_invalidate_existing_sessions` все старые сессии удаляются, пользователи должны перелогиниться

---

## Известные особенности
- Проект на сервере НЕ git-репозиторий — синхронизация через rsync
- Cookie: флаг `Secure=true` (HTTPS через nginx + Let's Encrypt)
- Prisma: используется `prisma migrate deploy` при старте контейнера
- Docker Compose требует флаги `-f docker-compose.production.yml --env-file .env.production`
- Nginx слушает порты 80 и 443, проксирует на localhost:3000
- Nginx rate limit: `general_limit` 60r/s burst 30 для `/api/` (не хранить `.bak` файлы в sites-enabled!)
- Порт 3000 привязан к 127.0.0.1 — недоступен извне
- ufw включён: разрешены только 22/tcp, 80/tcp, 443/tcp
- Контейнер app: read_only + tmpfs noexec + no-new-privileges
- SSH может быть нестабильным при множестве параллельных сессий
- Anthropic API вызывается напрямую через официальный SDK endpoint
- Все вызовы Anthropic SDK идут через `getAnthropicClient()` из `lib/anthropic.ts` без proxy/baseURL
