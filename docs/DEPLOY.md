# Деплой AI Assistant

> Пошаговое руководство по развёртыванию на VK Cloud (или любом Ubuntu-сервере)
> 
> Актуальность: 16 февраля 2026

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
  --exclude 'vkcloud-key/*.pem' \
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

# Копируем пример конфигурации
cp .env.production.example .env.production

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

# SMTP для отправки писем (верификация, сброс пароля)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<app-password>
SMTP_FROM=your@gmail.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Шаг 4: Запуск

```bash
# Сборка и запуск
cd ~/ai-assistant-spec
docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache
docker compose --env-file .env.production -f docker-compose.production.yml up -d

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
}
```

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

# Бэкап БД (PostgreSQL)
./scripts/backup-db.sh

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

### Автоматический бекап (cron)
```bash
crontab -e
```

Добавьте:
```
0 3 * * * cd /home/ubuntu/ai-assistant-spec && ./scripts/backup-db.sh
```

---

## Мониторинг

```bash
# Использование ресурсов
docker stats ai-assistant-production

# Health check
curl http://localhost:3000/api/health
```
