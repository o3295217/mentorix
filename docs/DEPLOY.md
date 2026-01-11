# Деплой AI Assistant на домашний сервер

> Пошаговое руководство по развёртыванию многопользовательской версии

---

## Требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 2 ядра | 4+ ядра |
| RAM | 1 GB | 2+ GB |
| Диск | 5 GB | 20+ GB |
| Docker | 20.10+ | 24.0+ |
| Docker Compose | 2.0+ | 2.20+ |

Ваш сервер (i7-7700K, 16GB RAM) — **более чем достаточно** ✅

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

### Вариант A: Git clone
```bash
git clone <your-repo-url> .
```

### Вариант B: SCP с Mac
```bash
# На Mac:
scp -r /Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec/* oleg_d_b@192.168.2.74:~/ai-assistant/
```

### Вариант C: rsync (рекомендую)
```bash
# На Mac:
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude 'data' \
  /Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec/ \
  oleg_d_b@192.168.2.74:~/ai-assistant/
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
REGISTRATION_MODE=invite  # Рекомендую для начала
INVITE_CODE=your-secret-code
MAX_USERS=5
```

---

## Шаг 4: Миграция на многопользовательскую схему

```bash
# Заменяем схему БД
cp prisma/schema-multiuser.prisma prisma/schema.prisma

# Если есть старые данные и нужно их сохранить:
# 1. Сделайте бекап
cp data/dev.db data/dev.db.backup

# 2. Создайте новую БД (старые данные не мигрируются автоматически)
rm -f data/production.db
```

---

## Шаг 5: Запуск

```bash
# Сборка и запуск
docker compose -f docker-compose.production.yml up -d --build

# Проверяем логи
docker logs -f ai-assistant-production

# Проверяем статус
docker ps
```

---

## Шаг 6: Первый пользователь

1. Откройте в браузере: `http://192.168.2.74:3000`
2. Перейдите на `/register`
3. Введите код приглашения (если REGISTRATION_MODE=invite)
4. Создайте аккаунт

---

## Доступ из интернета (опционально)

### Вариант A: VPN (рекомендую для безопасности)
```bash
# Установите WireGuard
sudo apt install wireguard

# Настройте VPN и подключайтесь через него
```

### Вариант B: Reverse Proxy с HTTPS

Создайте файл `Caddyfile`:
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Раскомментируйте секцию Caddy в `docker-compose.production.yml`.

### Вариант C: Port Forwarding
```bash
# На роутере настройте проброс порта 3000 → 192.168.2.74:3000
# НЕ РЕКОМЕНДУЕТСЯ без HTTPS!
```

---

## Полезные команды

```bash
# Перезапуск
docker compose -f docker-compose.production.yml restart

# Остановка
docker compose -f docker-compose.production.yml down

# Логи
docker logs -f ai-assistant-production

# Бекап БД
cp ~/ai-assistant/data/production.db ~/ai-assistant/backups/production-$(date +%Y%m%d).db

# Обновление
git pull
docker compose -f docker-compose.production.yml up -d --build
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
WorkingDirectory=/home/oleg_d_b/ai-assistant
ExecStart=/usr/bin/docker compose -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.production.yml down
User=oleg_d_b

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
sudo chown -R 1001:1001 ~/ai-assistant/data
```

### Не запускается контейнер
```bash
docker logs ai-assistant-production
```

### Проблемы с БД
```bash
# Проверяем права
ls -la ~/ai-assistant/data/

# Пересоздаём БД
docker compose -f docker-compose.production.yml down
rm -f ~/ai-assistant/data/production.db
docker compose -f docker-compose.production.yml up -d
```

---

## Бекапы

### Автоматический бекап (cron)
```bash
crontab -e
```

Добавьте:
```
0 3 * * * cp /home/oleg_d_b/ai-assistant/data/production.db /home/oleg_d_b/ai-assistant/backups/production-$(date +\%Y\%m\%d).db
```

---

## Мониторинг

```bash
# Использование ресурсов
docker stats ai-assistant-production

# Health check
curl http://localhost:3000/api/health
```
