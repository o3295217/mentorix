# Инфраструктура проекта AI Assistant

## Сервер
- **Хост:** 192.168.2.74
- **Пользователь:** oleg_d_b
- **SSH:** `ssh oleg_d_b@192.168.2.74`

## Расположение
- **На маке:** `/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec`
- **На сервере:** `/home/oleg_d_b/ai-assistant`
- **GitHub:** https://github.com/o3295217/ai-assistant-spec

## Docker
- **Контейнер:** `ai-assistant-production`
- **Порт:** 3010 (внешний) → 3000 (внутренний)
- **URL:** http://192.168.2.74:3010
- **Compose файл:** `docker-compose.production.yml`

## Быстрые команды

### Деплой (с мака)
```bash
./deploy-home.sh
```

### Проверка на сервере
```bash
# Статус контейнера
docker ps | grep ai-assistant

# Логи
docker logs -f ai-assistant-production

# Перезапуск
docker restart ai-assistant-production

# Пересборка
cd /home/oleg_d_b/ai-assistant && docker compose -f docker-compose.production.yml build --no-cache && docker compose -f docker-compose.production.yml up -d
```

### База данных
- **СУБД:** PostgreSQL 16 (контейнер `ai-assistant-db`)
- **Данные:** Docker volume `pgdata`
- **Подключение из хоста:** `docker exec -it ai-assistant-db psql -U ai_assistant`
- **Проверка таблиц:** `\dt` внутри psql

### Бэкап
```bash
# Ручной бэкап
./scripts/backup-db.sh

# Автоматический (cron)
0 3 * * * cd /home/oleg_d_b/ai-assistant && ./scripts/backup-db.sh
```

## Переменные окружения (на сервере)
Файл: `/home/oleg_d_b/ai-assistant/.env.production`
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` - креды PostgreSQL
- `AUTH_SECRET` - секрет для JWT
- `ANTHROPIC_API_KEY` - ключ API Claude
- `APP_PORT` - порт (3010)
- `COOKIE_SECURE` - false для HTTP, true для HTTPS

## Известные особенности
- Проект на сервере НЕ git-репозиторий — синхронизация через rsync
- Cookie: флаг `Secure` управляется через `COOKIE_SECURE` env var
- Prisma: используется PostgreSQL, миграции в `/prisma/migrations`
- При старте контейнера автоматически применяются миграции (`prisma migrate deploy`)
