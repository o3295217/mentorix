# Инфраструктура проекта AI Assistant

> Актуальность: 25 марта 2026

## Серверы

### Production — VK Cloud
- **IP:** 212.233.76.195
- **Домен:** https://assist.labaiion.ru
- **Пользователь:** ubuntu
- **SSH:** `ssh vk` (алиас в ~/.ssh/config)
- **SSH-ключ:** `vkcloud-key/ai-assistant-vk-43wvzX3E.pem`
- **ОС:** Ubuntu Linux 6.8.0, 4 vCPU (Intel Ice Lake), 4GB RAM, 60GB SSD
- **DNS:** ns1.reg.ru / ns2.reg.ru (A-запись assist.labaiion.ru → 212.233.76.195)

### Старый сервер (домашний) — деактивирован
- ~~192.168.2.74 (oleg_d_b) — локальная сеть~~

## Расположение
- **На маке:** `/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec`
- **На сервере:** `/home/ubuntu/ai-assistant-spec`
- **GitHub:** https://github.com/o3295217/ai-assistant-spec

## Docker
- **Контейнеры:** `ai-assistant-production`, `ai-assistant-db`
- **Порт:** 3000 (внутренний, проксируется через nginx)
- **URL:** https://assist.labaiion.ru
- **Compose файл:** `docker-compose.production.yml`
- **Env файл:** `.env.production` (на сервере, исключён из git/rsync)

## Web-сервер
- **Nginx** — reverse proxy (порт 80/443 → localhost:3000)
- **SSL:** Let's Encrypt (certbot, автопродление)
- **Конфиг:** `/etc/nginx/sites-available/ai-assistant`
- **Rate limiting:** `general_limit` — 60 запросов/сек, burst 30 (для всех `/api/` запросов). Ранее использовался `post_limit` (10 запросов/мин), который блокировал параллельные GET-запросы при загрузке страниц

## Быстрые команды

### Деплой (с мака)
```bash
./deploy-vk.sh
```

### SSH на сервер
```bash
ssh vk
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
cd ~/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate

# Пересборка
cd ~/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache && docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate
```

### База данных
- **СУБД:** PostgreSQL 16 (контейнер `ai-assistant-db`)
- **Данные:** Docker volume `pgdata`
- **Подключение:** `docker exec -it ai-assistant-db psql -U ai_assistant`
- **Проверка таблиц:** `\dt` внутри psql

### Бэкап

Бэкап работает автоматически через Docker-контейнер `ai-assistant-backup` (ежедневно в 03:00, хранит 30 последних зашифрованных файлов `pg_*.sql.gz.enc`). Ключ хранится на сервере вне проекта: `/home/ubuntu/.backup-key`.

```bash
# Ручной бэкап
docker exec ai-assistant-backup /usr/local/bin/prod-backup.sh

# Проверка лога
cat backups/backup.log

# Расшифровка для восстановления
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass file:/home/ubuntu/.backup-key \
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
15 4 * * * docker exec ai-assistant-production node scripts/cleanup-expired.mjs >> /home/ubuntu/ai-assistant-spec/backups/cleanup-expired.log 2>&1
```

### Проверка алертов мониторинга (с мака)
```bash
bash scripts/check-alerts.sh
```

### Зафиксированные IP
```bash
ssh vk 'cat /home/ubuntu/ai-assistant-spec/logs/monitor/known_ips.txt'
```

## Cloudflare Worker — прокси для Anthropic API

Anthropic блокирует API-запросы с российских IP. Для обхода используется Cloudflare Worker + Durable Object:

- **Worker URL:** `https://anthropic-proxy.o3295217.workers.dev`
- **Расположение кода:** `cloudflare-proxy/` в корне проекта
- **Механизм:** Worker принимает запрос → передаёт Durable Object (location hint: wnam/US) → DO вызывает Anthropic API с американского IP
- **Защита:** заголовок `x-proxy-secret` (секрет хранится в Cloudflare Secrets и в `.env.production`)
- **Rate limit:** Durable Object `RATE_LIMITER`, по умолчанию `60 req/min` на IP (`CF-Connecting-IP`)
- **Деплой Worker:** `cd cloudflare-proxy && wrangler deploy`
- **Аккаунт Cloudflare:** авторизация через `wrangler login`

Лимит меняется в `cloudflare-proxy/wrangler.toml` через `RATE_LIMIT_PER_MINUTE`. При превышении Worker возвращает `429` и header `Retry-After`, не вызывая Anthropic API.

## Cloudflare Worker — прокси для Telegram Bot API

Для обхода блокировок Telegram API используется отдельный Worker `cloudflare-tg-proxy/`.

- **Worker name:** `tg-proxy`
- **Защита:** заголовок `x-tg-proxy-secret` (секрет `TG_PROXY_SECRET` хранится в Cloudflare Secrets)
- **Rate limit:** Durable Object `RATE_LIMITER`, по умолчанию `30 req/min` на IP (`CF-Connecting-IP`)
- **Деплой Worker:** `cd cloudflare-tg-proxy && wrangler deploy`

Лимит меняется в `cloudflare-tg-proxy/wrangler.toml` через `RATE_LIMIT_PER_MINUTE`. При превышении Worker возвращает `429` и header `Retry-After`, не вызывая Telegram API.

### Локальная разработка
На маке прокси не нужен — API Anthropic работает напрямую. Переменные `ANTHROPIC_PROXY_URL` и `ANTHROPIC_PROXY_SECRET` в `.env.local` не задаются.

---

## Переменные окружения (на сервере)
Файл: `/home/ubuntu/ai-assistant-spec/.env.production`

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Секрет для JWT |
| `ANTHROPIC_API_KEY` | Ключ API Claude |
| `ANTHROPIC_PROXY_URL` | URL Cloudflare Worker прокси |
| `ANTHROPIC_PROXY_SECRET` | Секрет для аутентификации прокси |
| `COOKIE_SECURE` | `true` (HTTPS) |
| `REGISTRATION_MODE` | `open` (регистрация с верификацией email) |
| `SMTP_HOST` / `SMTP_PORT` | smtp.gmail.com:587 |
| `SMTP_USER` / `SMTP_PASS` | Gmail App Password |
| `SMTP_FROM` | Адрес отправителя |
| `NEXT_PUBLIC_APP_URL` | https://assist.labaiion.ru |

## Автозапуск
- systemd сервис: `ai-assistant.service`
- Контейнеры запускаются автоматически при загрузке сервера

## SSH Config (на маке)
```
Host vk
  HostName 212.233.76.195
  User ubuntu
  IdentityFile ~/Documents/GooglDisk/ai-assistant-spec/vkcloud-key/ai-assistant-vk-43wvzX3E.pem
```

## Безопасность

> Обновлено: 25 марта 2026 — после инцидента с криптомайнером TeamTNT

### Инцидент (24 марта 2026)
Контейнер `ai-assistant-production` был заражён криптомайнером TeamTNT через открытый порт 3000 (был доступен всему интернету, минуя nginx). Малварь скачала бинарники в `/tmp/` и запустила 5 процессов-майнеров. Хост-система не пострадала — заражение ограничилось контейнером.

### Принятые меры

| Мера | Статус | Описание |
|------|--------|----------|
| Порт 3000 → 127.0.0.1 | ✅ | Контейнер слушает только localhost, доступ только через nginx |
| ufw firewall | ✅ | Включён, разрешены только порты 22, 80, 443 |
| read_only: true | ✅ | Файловая система контейнера только для чтения |
| tmpfs /tmp noexec | ✅ | /tmp — 50 МБ, флаг noexec запрещает выполнение бинарников |
| no-new-privileges | ✅ | Запрет эскалации привилегий внутри контейнера |
| Контейнер пересоздан | ✅ | Чистый образ собран с нуля (--no-cache) |

### Checklist при деплое
- [ ] Убедиться что порт 3000 привязан к `127.0.0.1` в docker-compose
- [ ] Убедиться что `ufw` активен (`sudo ufw status`)
- [ ] Проверить процессы в контейнере (`docker exec ai-assistant-production ps aux`)
- [ ] Проверить `/tmp/` в контейнере (`docker exec ai-assistant-production ls -la /tmp/`)
- [ ] Проверить что мониторинг в cron (`ssh vk 'crontab -l'`)
- [ ] Проверить алерты (`bash scripts/check-alerts.sh`)

### Мониторинг безопасности

Автоматический скрипт `scripts/monitor.sh` запускается каждые 30 минут через cron и проверяет:

| # | Проверка | Алерт при |
|---|---------|----------|
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
- `/home/ubuntu/ai-assistant-spec/logs/monitor/YYYY-MM-DD.log` — ежедневный лог
- `/home/ubuntu/ai-assistant-spec/logs/monitor/alerts.log` — только алерты
- `/home/ubuntu/ai-assistant-spec/logs/monitor/known_ips.txt` — зафиксированные IP владельца
- `/home/ubuntu/ai-assistant-spec/logs/monitor/cron.log` — вывод cron

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
| 📊 Состояние сервера | Статус контейнеров, нагрузка, диск, безопасность (цветовые индикаторы 🟢🟡🔴) |
| 🛡 Проверка безопасности | Запуск полной проверки (12 чеков из monitor.sh) |
| ⚠️ Алерты за сегодня | Список сегодняшних алертов из alerts.log |
| 👥 Пользователи | Список пользователей из базы данных |
| 🌐 IP-адреса | Зафиксированные SSH-входы владельца |

**Автоматические алерты с кнопками действий:**

При обнаружении проблемы мониторинг отправляет алерт с двумя кнопками (действие + «❌ Игнорировать»):

| Алерт | Кнопка действия | Что делает |
|-------|----------------|------------|
| Сайт недоступен (health ≠ 200) | 🔄 Перезапустить контейнер | `docker compose restart app` |
| Контейнер не запущен | 🔄 Перезапустить контейнер | `docker compose restart app` |
| CPU контейнера > 80% | 🔄 Перезапустить контейнер | `docker compose restart app` |
| Диск заполнен > 85% | 🧹 Очистить диск | Docker prune + удаление логов старше 7 дней |
| Криптомайнер обнаружен | 🛑 Остановить и пересобрать | Stop → rm → build --no-cache → up (~1-2 мин) |

**Безопасность:** бот отвечает только на `TG_CHAT_ID` владельца. Бот-токен больше не хранится в репозитории.

**Хранение секретов на сервере:**
- `/home/ubuntu/.tg-bot-token` — только `TG_BOT_TOKEN`
- `/home/ubuntu/.tg-bot-env` — `TG_CHAT_ID=...`
- `/home/ubuntu/ai-assistant-spec/.env.production` — `TG_BOT_TOKEN` и `TG_CHAT_ID` для контейнера приложения

**Файлы:**
- `scripts/tg-bot.sh` — скрипт бота (bash + jq для парсинга JSON)
- `scripts/tg-bot.service` — systemd unit-файл
- `scripts/monitor.sh` — мониторинг, отправляет алерты с кнопками действий

**Управление сервисом:**
```bash
# Статус
sudo systemctl status tg-bot

# Перезапуск
sudo systemctl restart tg-bot

# Логи
sudo journalctl -u tg-bot --no-pager -n 50
```

> **Важно:** При деплое (`deploy-vk.sh`) бот перезапускается автоматически. Это необходимо, потому что при пересоздании Docker-контейнера бот может зависнуть на `docker exec`.

**После ротации Telegram-токена:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart tg-bot
cd ~/ai-assistant-spec && docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate app
```

**Автоматические уведомления** (кроме кнопок):
- Алерты мониторинга — из `scripts/monitor.sh` (каждые 30 мин)
- Новые регистрации — из `app/api/auth/register/route.ts`
- Ошибки Anthropic API — из `lib/anthropic.ts` (после исчерпания ретраев)
- Общая утилита: `lib/telegram.ts` (дедупликация, кулдаун 5 мин)

**Cron (на сервере):**
```
*/30 * * * * sudo /bin/sh /home/ubuntu/ai-assistant-spec/scripts/monitor.sh >> /home/ubuntu/ai-assistant-spec/logs/monitor/cron.log 2>&1
```

### Ротация секретов
После компрометации контейнера нужно сменить:
- `ANTHROPIC_API_KEY` — на https://console.anthropic.com
- `AUTH_SECRET` — сгенерировать новый: `openssl rand -hex 32`
- `ANTHROPIC_PROXY_SECRET` — обновить в Cloudflare Secrets и `.env.production`
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
- Anthropic API блокирует запросы с IP в РФ — используется Cloudflare Worker прокси
- Все вызовы Anthropic SDK идут через `getAnthropicClient()` из `lib/anthropic.ts` (с автоматическим проксированием)
