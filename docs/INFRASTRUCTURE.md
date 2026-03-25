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
```bash
# Ручной бэкап
./scripts/backup-db.sh

# Автоматический (cron)
0 3 * * * cd /home/ubuntu/ai-assistant-spec && ./scripts/backup-db.sh
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
- **Деплой Worker:** `cd cloudflare-proxy && wrangler deploy`
- **Аккаунт Cloudflare:** авторизация через `wrangler login`

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

**Cron (на сервере):**
```
*/30 * * * * sudo /bin/sh /home/ubuntu/ai-assistant-spec/scripts/monitor.sh >> /home/ubuntu/ai-assistant-spec/logs/monitor/cron.log 2>&1
```

### Ротация секретов
После компрометации контейнера нужно сменить:
- `ANTHROPIC_API_KEY` — на https://console.anthropic.com
- `AUTH_SECRET` — сгенерировать новый: `openssl rand -hex 32`
- `ANTHROPIC_PROXY_SECRET` — обновить в Cloudflare Secrets и `.env.production`

---

## Известные особенности
- Проект на сервере НЕ git-репозиторий — синхронизация через rsync
- Cookie: флаг `Secure=true` (HTTPS через nginx + Let's Encrypt)
- Prisma: используется `prisma db push` (не migrate) при старте контейнера
- Docker Compose требует флаг `--env-file .env.production` (не читает автоматически)
- Nginx слушает порты 80 и 443, проксирует на localhost:3000
- Порт 3000 привязан к 127.0.0.1 — недоступен извне
- ufw включён: разрешены только 22/tcp, 80/tcp, 443/tcp
- Контейнер app: read_only + tmpfs noexec + no-new-privileges
- SSH может быть нестабильным при множестве параллельных сессий
- Anthropic API блокирует запросы с IP в РФ — используется Cloudflare Worker прокси
- Все вызовы Anthropic SDK идут через `getAnthropicClient()` из `lib/anthropic.ts` (с автоматическим проксированием)
