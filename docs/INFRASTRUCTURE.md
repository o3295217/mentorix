# Инфраструктура проекта AI Assistant

> Актуальность: 16 февраля 2026

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

## Переменные окружения (на сервере)
Файл: `/home/ubuntu/ai-assistant-spec/.env.production`

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Секрет для JWT |
| `ANTHROPIC_API_KEY` | Ключ API Claude |
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

## Известные особенности
- Проект на сервере НЕ git-репозиторий — синхронизация через rsync
- Cookie: флаг `Secure=true` (HTTPS через nginx + Let's Encrypt)
- Prisma: используется `prisma db push` (не migrate) при старте контейнера
- Docker Compose требует флаг `--env-file .env.production` (не читает автоматически)
- Nginx слушает порты 80 и 443, проксирует на localhost:3000
- SSH может быть нестабильным при множестве параллельных сессий
