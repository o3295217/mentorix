# Рабочий процесс разработки

## Быстрый старт

### 1. Клонировать и установить
```bash
git clone https://github.com/o3295217/ai-assistant-spec.git
cd ai-assistant-spec
npm install
```

### 2. Настроить окружение
```bash
cp .env.example .env.local
# Заполнить переменные в .env.local
```

### 3. Запустить PostgreSQL
```bash
docker compose up -d
```

### 4. Настроить БД
```bash
npx prisma generate
npx prisma db push
```

### 5. Запустить dev сервер
```bash
npm run dev
```

Приложение: http://localhost:3003

---

## Окружение

### Переменные (.env.local)
```env
# База данных PostgreSQL
DATABASE_URL="postgresql://ai_assistant:ai_assistant_dev@localhost:5432/ai_assistant"

# Аутентификация
AUTH_ENABLED=true
AUTH_SECRET="your-secret-key-min-32-chars"

# Claude API
ANTHROPIC_API_KEY="sk-ant-..."

# Шифрование данных at rest (AES-256-GCM)
# Генерация: openssl rand -hex 32
ENCRYPTION_KEY="64-hex-characters-here"

# Anthropic proxy (для production за блокировкой, опционально для dev)
# ANTHROPIC_PROXY_URL="https://anthropic-proxy.example.workers.dev"
# ANTHROPIC_PROXY_SECRET="your-proxy-secret"

# Email (для верификации и сброса пароля)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
# EMAIL_FROM=noreply@example.com

# Опционально
REGISTRATION_MODE=open
COOKIE_SECURE=false
```

### Docker контейнеры
| Контейнер | Порт | Назначение |
|-----------|------|------------|
| ai-assistant-db | 5432 | PostgreSQL |

---

## Команды

### Разработка
```bash
npm run dev          # Запуск dev сервера (Turbopack)
npm run build        # Сборка для продакшена
npm run start        # Запуск собранного приложения
```

### База данных
```bash
npx prisma studio    # GUI для просмотра данных
npx prisma generate  # Сгенерировать Prisma Client
npx prisma db push   # Применить схему к БД
npx prisma migrate dev --name описание  # Создать миграцию
```

### Docker
```bash
docker compose up -d          # Запустить PostgreSQL
docker compose down           # Остановить
docker compose logs -f        # Логи
```

### Проверка БД напрямую
```bash
docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -c "SELECT * FROM users;"
```

---

## Типичные задачи

### Добавить новую страницу
1. Создать `app/mypage/page.tsx`
2. Создать `app/mypage/layout.tsx` если нужен свой layout
3. Добавить в навигацию `components/Navigation.tsx`
4. Если страница должна отображаться без Navigation/LayoutFooter (как auth или onboarding) — добавить путь в `HIDDEN_PATHS` в обоих компонентах

### Layout-структура (app/layout.tsx)

```
<body>
  <Providers>
    <AuthGuard>
      <Navigation />       ← <header> внутри, скрывается на landing/auth/onboarding
      <main>{children}</main>
      <LayoutFooter />     ← скрывается на landing/auth/onboarding
    </AuthGuard>
  </Providers>
</body>
```

Для публичных страниц (неавторизованные пользователи) — `app/page.tsx` рендерит `Landing.tsx` вместо Dashboard.

### Добавить новый API endpoint
1. Создать `app/api/myendpoint/route.ts`
2. Использовать `requireUserId(request)` для авторизации
3. Фильтровать данные по `userId`

### Изменить схему БД
1. Изменить `prisma/schema.prisma`
2. `npx prisma generate`
3. `npx prisma db push`
4. Обновить типы в `lib/types.ts` если нужно

### Добавить новый промпт для AI
1. Создать/изменить файл в `lib/prompts/`
2. Экспортировать функцию генерации промпта
3. Использовать в соответствующем API route

---

## Отладка

### Логи сервера
Смотреть терминал где запущен `npm run dev`

### Логи PostgreSQL
```bash
docker compose logs -f ai-assistant-db
```

### Prisma Studio (GUI для БД)
```bash
npx prisma studio
```
Откроется http://localhost:5555

### Проверить сессию пользователя
```bash
docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -c "SELECT * FROM sessions;"
```

---

## Частые проблемы

### Ошибка "Table does not exist"
```bash
npx prisma db push
```

### Ошибка "Unique constraint on id"
После миграции данных сбросить sequences:
```bash
docker exec ai-assistant-db psql -U ai_assistant -d ai_assistant -c "
SELECT setval('daily_entries_id_seq', (SELECT MAX(id) FROM daily_entries) + 1, false);
SELECT setval('evaluations_id_seq', (SELECT MAX(id) FROM evaluations) + 1, false);
-- и т.д. для других таблиц
"
```

### Prisma Client устарел
```bash
npx prisma generate
# Перезапустить dev сервер
```

### Порт 3003 занят
```bash
lsof -i :3003
kill -9 <PID>
```

### PostgreSQL не запускается
```bash
docker compose down
docker compose up -d
```

---

## Тестирование

### Ручное тестирование
1. Зарегистрировать нового пользователя
2. Создать план на день
3. Добавить факт выполнения
4. Запустить оценку
5. Проверить историю

### Проверка изоляции данных
1. Создать второго пользователя
2. Убедиться что данные первого не видны

---

## Шифрование данных (SSE)

Все чувствительные текстовые поля шифруются AES-256-GCM через Prisma middleware (`lib/prisma-encryption.ts`).

### Настройка

1. Сгенерировать ключ:
```bash
openssl rand -hex 32
```

2. Добавить в `.env.local`:
```env
ENCRYPTION_KEY="ваши-64-hex-символа"
```

3. Для шифрования существующих данных:
```bash
npx tsx scripts/encrypt-existing-data.ts
```

### Для production (Docker)
Контейнер read-only, поэтому миграция запускается через:
```bash
docker exec ai-assistant-app node -e "$(cat scripts/encrypt-standalone.js)"
```

### Важно
- **Prod и dev** используют **разные ключи** `ENCRYPTION_KEY`
- Зашифрованные значения имеют префикс `enc_v1:` — middleware автоматически пропускает уже зашифрованные
- При утрате ключа данные **невозможно** расшифровать

---

## Аудит-лог

Все write-операции автоматически логируются через Prisma middleware (`lib/prisma-audit.ts`).

- Auth events (login, logout, lockout) логируются вручную через `audit()` из `lib/audit.ts`
- Логи хранятся в таблице `audit_logs`
- Просмотр: `npx prisma studio` → AuditLog

---

## Аутентификация (детали)

### HMAC-подпись токенов
- При логине создаётся сессия + HMAC подпись токена (`lib/hmac.ts`)
- `middleware.ts` проверяет подпись через `crypto.subtle` (Edge Runtime, без БД)
- `AUTH_SECRET` — обязательная env-переменная (используется как HMAC ключ)

### Хэширование паролей
- bcrypt с 12 раундами (`lib/auth.ts`)
- Transparent migration: старые SHA-256 хэши автоматически перехэшируются при успешном входе

### Rate limiting
- Login: 5 попыток за 15 минут
- Register: 3 за 1 час
- AI endpoints: 10 запросов в минуту
- После 10 неудачных входов — lockout аккаунта на 30 минут

---

## Деплой

См. `docs/DEPLOY.md`

Краткая версия:
```bash
docker compose -f docker-compose.production.yml up --build -d
```


## Последние изменения инструментария

### 2026-01-28 — feat: автоматическое обновление документации во время коммита
- `.husky/pre-commit`
- `.husky/commit-msg`
- `scripts/update-docs.js`
