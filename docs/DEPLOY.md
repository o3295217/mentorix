# Деплой AI Assistant

> Пошаговое руководство по развёртыванию на VK Cloud (или любом Ubuntu-сервере)
> 
> Актуальность: 25 марта 2026

---

## Текущий production

| Параметр | Значение |
|----------|----------|
| **URL** | https://assist.labaiion.ru |
| **Сервер** | VK Cloud, 212.233.76.195 |
| **SSH** | `ssh vk` |
| **ОС** | Ubuntu, 4 vCPU, 4GB RAM, 60GB SSD |
| **Docker** | 29.2.1 + Compose v5.0.2 |
| **SSL** | Let's Encrypt (nginx + certbot) |

---

## Требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 2 ядра | 4+ ядра |
| RAM | 2 GB | 4+ GB |
| Диск | 10 GB | 20+ GB |
| Docker | 20.10+ | 29.0+ |
| Docker Compose | 2.0+ | 5.0+ |

---

## Шаг 1: Подготовка сервера

```bash
# Проверяем Docker
docker --version
docker compose version

# Создаём директорию
mkdir -p ~/ai-assistant
cd ~/ai-assistant
```

---

## Шаг 2: Копирование проекта

### rsync (рекомендуется)
```bash
# С мака:
rsync -avz --delete \
  -e "ssh -o ServerAliveInterval=10 -o ServerAliveCountMax=3" \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude 'data/*.db' --exclude '.env' --exclude '.env.local' \
  --exclude '.env.production' --exclude 'backups/*' \
  --exclude 'vkcloud-key/*.pem' --exclude 'logs/' \
  /Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec/ vk:/home/ubuntu/ai-assistant-spec/
```

### Или скрипт деплоя
```bash
./deploy-vk.sh
```

---

## Шаг 3: Настройка переменных окружения

```bash
# На сервере
cd ~/ai-assistant

# Создаём файл конфигурации
touch .env.production

# Генерируем секретный ключ
AUTH_SECRET=$(openssl rand -hex 32)
echo "AUTH_SECRET=$AUTH_SECRET"

# Редактируем конфигурацию
nano .env.production
```

### Обязательные переменные:
```env
AUTH_SECRET=<сгенерированный-ключ>
ANTHROPIC_API_KEY=<ваш-api-key>
REGISTRATION_MODE=open
COOKIE_SECURE=true

# Cloudflare Worker прокси для Anthropic API (обход гео-блокировки РФ)
# Если сервер в РФ — обязательно. С других локаций — не нужно.
ANTHROPIC_PROXY_URL=https://anthropic-proxy.o3295217.workers.dev
ANTHROPIC_PROXY_SECRET=<секрет-прокси>

# Telegram уведомления приложения
TG_BOT_TOKEN=<telegram-bot-token>
TG_CHAT_ID=<telegram-chat-id>

# SMTP для отправки писем (верификация, сброс пароля)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<app-password>
SMTP_FROM=your@gmail.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

> **Примечание:** Anthropic блокирует запросы с российских IP. Если сервер в РФ, необходимо использовать Cloudflare Worker прокси. Подробнее — см. [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

> **Важно:** после перехода на хеширование session token'ов при первом деплое миграции `20260401000000_invalidate_existing_sessions` все существующие сессии будут инвалидированы.

---

## Шаг 4: Запуск

```bash
# Сборка и запуск
cd ~/ai-assistant-spec
docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache
docker compose --env-file .env.production -f docker-compose.production.yml up -d

# Перезапуск Telegram-бота (зависает при пересоздании контейнера)
sudo systemctl restart tg-bot

# Проверяем логи
docker logs -f ai-assistant-production

# Проверяем статус
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

> **Важно:** всегда указывайте `--env-file .env.production` — Docker Compose не читает его автоматически.

---

## Шаг 5: Настройка Nginx + SSL

### Установка Nginx
```bash
sudo apt install nginx -y
```

### Конфигурация reverse proxy
```bash
sudo nano /etc/nginx/sites-available/ai-assistant
```

```nginx
# Rate limiting (60 запросов/сек, burst 30)
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=60r/s;

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting для API
    location /api/ {
        limit_req zone=general_limit burst=30 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Важно:** Не используйте слишком строгий rate limit (напр. 10r/m) для `/api/` — страницы загружают ~20 параллельных GET-запросов, что приведёт к массовым 503 ошибкам.

```bash
sudo ln -s /etc/nginx/sites-available/ai-assistant /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

Certbot автоматически обновит конфиг nginx для HTTPS и настроит автопродление.

---

## Шаг 6: Первый пользователь

1. Откройте `https://your-domain.com/register`
2. Введите имя, email и пароль
3. На почту придёт ссылка для подтверждения email
4. Перейдите по ссылке и войдите

---

## Полезные команды

```bash
# Перезапуск
cd ~/ai-assistant-spec
docker compose --env-file .env.production -f docker-compose.production.yml restart

# Остановка
docker compose --env-file .env.production -f docker-compose.production.yml down

# Логи
docker logs -f ai-assistant-production

# Бэкап БД (автоматический через Docker-контейнер ai-assistant-backup)
docker exec ai-assistant-backup /usr/local/bin/prod-backup.sh

# Обновление (с мака)
./deploy-vk.sh
```

---

## Автозапуск при загрузке

```bash
# Создаём systemd сервис
sudo nano /etc/systemd/system/ai-assistant.service
```

```ini
[Unit]
Description=AI Assistant
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/ai-assistant-spec
ExecStart=/usr/bin/docker compose --env-file .env.production -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker compose --env-file .env.production -f docker-compose.production.yml down
User=ubuntu

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-assistant
sudo systemctl start ai-assistant
```

---

## Безопасность

### Обязательные настройки

Все меры безопасности уже настроены в `docker-compose.production.yml`:

```yaml
# Порт доступен только nginx'у (не извне)
ports:
  - "127.0.0.1:3000:3000"

# Файловая система только для чтения
read_only: true
tmpfs:
  - /tmp:size=50M,noexec,nosuid,nodev
  - /app/.next/cache:size=200M,noexec,nosuid,nodev

# Запрет эскалации привилегий
security_opt:
  - no-new-privileges:true

# Запуск от непривилегированного пользователя
user: "1001:1001"
```

### Файрволл (ufw)

```bash
# Включение (выполнить один раз на сервере)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Проверка
sudo ufw status verbose
```

### Проверка безопасности контейнера

```bash
# Порт слушает только localhost
ss -tlnp | grep 3000
# Ожидаемый результат: 127.0.0.1:3000

# Только 1 процесс (next-server)
docker exec ai-assistant-production ps aux

# /tmp/ пустой
docker exec ai-assistant-production ls -la /tmp/

# Файловая система read-only
docker exec ai-assistant-production sh -c 'echo test > /app/test' 
# Ожидаемый результат: Read-only file system
```

---

## Мониторинг

Автоматический скрипт безопасности запускается каждые 30 минут.

### Настройка (выполнить один раз)
```bash
# Добавить в crontab на сервере
ssh vk
crontab -e
# Добавить строку:
*/30 * * * * sudo /bin/sh /home/ubuntu/ai-assistant-spec/scripts/monitor.sh >> /home/ubuntu/ai-assistant-spec/logs/monitor/cron.log 2>&1
```

### Проверка алертов (с мака)
```bash
bash scripts/check-alerts.sh
```

Скрипт покажет:
- Алерты за сегодня
- Последний запуск мониторинга (состояние сервера)
- Зафиксированные IP владельца

### Что проверяется
- Процессы и файлы в контейнере (индикаторы малвари)
- Health endpoint, CPU/RAM, диск
- Firewall, порт 3000, Docker security flags
- SSH-входы с неизвестным ключом
- Аномальная активность Anthropic API

### Логи мониторинга
```bash
# На сервере
ls ~/ai-assistant-spec/logs/monitor/

# Алерты
cat ~/ai-assistant-spec/logs/monitor/alerts.log

# Зафиксированные IP
cat ~/ai-assistant-spec/logs/monitor/known_ips.txt
```

> **Важно:** папка `logs/` исключена из rsync — логи мониторинга не затираются при деплое.

---

## Troubleshooting

### Ошибка "permission denied"
```bash
sudo chown -R 1001:1001 ~/ai-assistant-spec/backups
```

### Не запускается контейнер
```bash
docker logs ai-assistant-production
```

### Проблемы с БД
```bash
# Проверяем логи PostgreSQL
docker logs ai-assistant-db

# Подключаемся к БД
docker exec -it ai-assistant-db psql -U ai_assistant

# Пересоздать БД (осторожно — данные будут утеряны!)
docker compose --env-file .env.production -f docker-compose.production.yml down -v
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

---

## Бекапы

Бэкапы работают автоматически через Docker-контейнер `ai-assistant-backup` (описан в `docker-compose.production.yml`).
Ежедневно в 03:00 делается `pg_dump + gzip`, хранятся последние 30 бэкапов в `./backups/`.

```bash
# Ручной бэкап
docker exec ai-assistant-backup /usr/local/bin/prod-backup.sh

# Проверка лога
cat backups/backup.log

# Восстановление из бэкапа
gunzip -c backups/pg_YYYY-MM-DD_HH-MM-SS.sql.gz | docker exec -i ai-assistant-db psql -U ai_assistant
```

---

## Мониторинг

```bash
# Использование ресурсов
docker stats ai-assistant-production

# Health check
curl http://localhost:3000/api/health
```
