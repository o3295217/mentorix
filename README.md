# AI Effectiveness Assistant

Личный ИИ-ассистент для управления эффективностью с иерархической системой целей и автоматической оценкой через Claude API.

## Возможности

- 🎯 Иерархия целей: День → Неделя → Месяц → Квартал → Полугодие → Год → Мечта
- 📝 Ежедневное планирование с планом и фактом выполнения
- 🤖 Автоматическая оценка дня через Claude API с детальным анализом
- 🧠 **Профиль понимания** — ИИ учится понимать ваши паттерны и даёт персонализированные советы
- 🔄 **Привычки** — ежедневные/еженедельные привычки с автодобавлением в план
- 💬 **Чат с ИИ** — обсуждение плана на день с учётом контекста
- 📊 Аналитика и графики эффективности
- 🔗 Проверка alignment (выравнивания) целей между уровнями
- 📈 История всех дней с оценками
- ✅ Управление незакрытыми задачами
- 🚗 Прогресс к мечте с расчётом прогноза достижения
- 🔮 AI-прогнозы и периодические оценки (неделя, месяц, квартал, год)
- 👤 Персонализированный профиль пользователя
- ⚖️ Мониторинг баланса: здоровье, семья, энергия

## Технологии

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **AI:** Anthropic Claude API напрямую через официальный SDK (без Cloudflare/Wrangler proxy)
  - `claude-sonnet-4-5-20250929` — для оценки дней и прогнозов
  - `claude-3-5-haiku-20241022` — для чата и проверки плана (дешевле)
- **Charts:** Recharts

## Установка и запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/o3295217/ai-assistant-spec.git
cd ai-assistant-spec
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Настроить переменные окружения

Создайте файл `.env.local`:

```env
DATABASE_URL="postgresql://ai_assistant:ai_assistant_dev@localhost:5432/ai_assistant"
ANTHROPIC_API_KEY="ваш-api-ключ-здесь"
```

### 4. Запустить PostgreSQL и инициализировать базу данных

```bash
# Если PostgreSQL не запущен локально:
docker run -d --name postgres-dev -e POSTGRES_USER=ai_assistant -e POSTGRES_PASSWORD=ai_assistant_dev -e POSTGRES_DB=ai_assistant -p 5432:5432 postgres:16-alpine

# Применить миграции
npx prisma migrate dev
```

### 5. Запустить приложение

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## Запуск в Docker

### Локальная сборка

```bash
docker-compose up --build
```

### Использование готового образа из GitHub Container Registry

```bash
docker pull ghcr.io/o3295217/ai-assistant-spec:latest
docker run -p 3000:3000 --env-file .env.local ghcr.io/o3295217/ai-assistant-spec:latest
```

## Структура проекта

```
ai-assistant-spec/
├── app/                       # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── analytics/         # Аналитика и тренды
│   │   ├── daily/             # Ежедневные записи
│   │   │   ├── chat/          # Чат с ИИ о плане дня
│   │   │   ├── check-plan/    # Проверка плана ИИ
│   │   │   └── indicators/    # Индикаторы календаря
│   │   ├── evaluate/          # Оценка дня (Claude AI)
│   │   ├── evaluate-period/   # Оценка периодов (неделя/месяц/квартал/год)
│   │   ├── forecast/          # AI-прогнозы
│   │   ├── goals/             # Цели (dream, period, year)
│   │   ├── habits/            # Привычки (CRUD, suggestions)
│   │   ├── health/            # Данные здоровья
│   │   ├── periods/           # Периодические цели
│   │   ├── profile/           # Профиль пользователя
│   │   │   └── insights/      # Профиль понимания (обновляется ИИ)
│   │   ├── progress/          # Статистика прогресса
│   │   └── tasks/             # Задачи (open, closed, reopen)
│   ├── analytics/             # Страница аналитики
│   ├── daily/                 # Страница планирования
│   ├── evaluation/            # Страница оценки дня
│   ├── forecast/              # Страница прогнозов
│   ├── goals/                 # Страница целей
│   ├── history/               # История оценок
│   ├── periods/               # Периодические оценки
│   ├── profile/               # Профиль пользователя
│   ├── progress/              # Прогресс к мечте
│   ├── tasks/                 # Управление задачами
│   └── onboarding/            # Онбординг (5 слайдов, тёмная тема)
├── components/                # React компоненты
│   ├── BalanceFlags.tsx       # Флаги баланса (здоровье/семья/энергия)
│   ├── DatePickerWithIndicators.tsx  # Календарь с индикаторами
│   ├── DreamProgress.tsx      # Виджет прогресса к мечте
│   ├── Landing.tsx            # Публичный лендинг для неавторизованных
│   ├── LayoutFooter.tsx       # Футер (скрывается на лендинге/auth/онбординге)
│   ├── Navigation.tsx         # Навигация с <header>, активной вкладкой
│   ├── ProgressIndicator.tsx  # Индикатор прогноза на главной
│   └── Speedometer.tsx        # Визуализация скорости
├── lib/                       # Утилиты
│   ├── anthropic.ts           # Claude API интеграция с кэшированием
│   ├── dates.ts               # Работа с датами
│   ├── prisma.ts              # Prisma клиент
│   ├── types.ts               # TypeScript типы
│   └── prompts/               # Системные промпты для AI
│       ├── core.ts            # Базовый промпт
│       ├── daily.ts           # Промпт для оценки дня
│       ├── check-plan.ts      # Промпт для проверки плана
│       ├── plan-chat.ts       # Промпт для чата о плане
│       ├── period.ts          # Промпт для периодических оценок
│       └── forecast.ts        # Промпт для прогнозов
├── hooks/                     # React хуки
│   ├── useDaily.ts            # Хук для ежедневного планирования
│   ├── useForecast.ts         # Хук для прогнозов
│   └── useGoals.ts            # Хук для целей
├── prisma/
│   └── schema.prisma          # Схема базы данных
├── docs/
│   ├── ARCHITECTURE.md        # Архитектура проекта
│   ├── DEPLOY.md              # Деплой на Contabo
│   ├── DEVELOPMENT.md         # Рабочий процесс разработки
│   ├── INFRASTRUCTURE.md      # Инфраструктура и сервер
│   ├── ROADMAP.md             # Дорожная карта
│   ├── SPECIFICATION.md       # Техническая спецификация
│   └── USER_GUIDE.md          # Руководство пользователя
├── Dockerfile
├── docker-compose.local.yml
└── package.json
```

## Документация

- 📘 [Руководство пользователя](docs/USER_GUIDE.md) — как пользоваться приложением
- 📋 [Техническая спецификация](docs/SPECIFICATION.md) — детальное описание архитектуры
- 🏗️ [Архитектура](docs/ARCHITECTURE.md) — структура проекта, БД, AI, алгоритмы
- 🚀 [Деплой](docs/DEPLOY.md) — развёртывание на Contabo
- 🛠️ [Разработка](docs/DEVELOPMENT.md) — рабочий процесс
- 🗺️ [Дорожная карта](docs/ROADMAP.md) — план развития

## Получение API ключа Anthropic

1. Зарегистрируйтесь на https://console.anthropic.com
2. Создайте новый API ключ
3. Добавьте его в `.env.local`

**Примерная стоимость:** $3-10/месяц при активном использовании (с учётом Prompt Caching и Haiku для чата).

## Ключевые фичи

### 🧠 Профиль понимания

ИИ накапливает знания о вас после каждой оценки дня:
- **Паттерны** — когда вы продуктивнее, что откладываете
- **Сильные стороны** — что хорошо получается
- **Сложности** — над чем работать
- **Предпочтения** — как вам удобнее планировать
- **Мотивация** — что вас движет

Профиль используется в чате и при проверке плана для персонализации советов.

### 🔄 Привычки

- Создайте привычки (ежедневные, по дням недели, с интервалом)
- При открытии пустого дня привычки автоматически добавляются в план
- Можно добавить привычку в план вручную одним кликом
- Отслеживание серий (streak) и статистики

### 💬 Чат с ИИ

Обсуждайте план на день с ИИ-помощником:
- Учитывает ваши цели (неделя/месяц/мечта)
- Использует профиль понимания
- Даёт персонализированные рекомендации
- Принимает ваши возражения (вы знаете контекст лучше)

## Разработка

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## База данных

```bash
# Создать миграцию
npx prisma migrate dev --name migration_name

# Применить миграции (production)
npx prisma migrate deploy

# Просмотр БД в браузере
npx prisma studio

# Сброс БД (осторожно!)
npx prisma migrate reset
```

## Переменные окружения

| Переменная | Описание | Обязательно |
|------------|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string | Да |
| `ANTHROPIC_API_KEY` | API ключ Anthropic | Да |
| `AUTH_SECRET` | HMAC/сессионный секрет для opaque sessions (min 32 символа) | Да |
| `REGISTRATION_MODE` | `open` / `invite` / `closed` | Нет (default: open) |
| `INVITE_CODE` | Код приглашения (для режима invite) | Нет |
| `COOKIE_SECURE` | `true` для HTTPS, `false` для HTTP | Нет |
| `SMTP_HOST` | SMTP-сервер (напр. smtp.gmail.com) | Для email |
| `SMTP_PORT` | Порт SMTP (587) | Для email |
| `SMTP_USER` | Email отправителя | Для email |
| `SMTP_PASS` | Пароль приложения SMTP | Для email |
| `SMTP_FROM` | Адрес отправителя | Для email |
| `NEXT_PUBLIC_APP_URL` | Публичный HTTPS URL приложения; обязателен на Docker build-time (Next metadata/standalone) и runtime (email/API helpers) | Да в production |

## Production

- **URL:** https://mentorix.aionlab.ru
- **Сервер:** Contabo (Ubuntu)
- **SSH:** `ssh contabo`
- **Путь:** `/home/oleg/ai-assistant-spec`
- **Деплой:** `./deploy/deploy-contabo.sh` (rsync + Docker build)
- **SSL:** Let's Encrypt (Nginx reverse proxy)
- **Внешние API:** production обращается напрямую к `api.anthropic.com` и `api.telegram.org`; Cloudflare/Wrangler/Workers не используются.
- **Worker fallback:** `cloudflare-proxy/` и `cloudflare-tg-proxy/` сохранены как отключённый архивный fallback (`WORKER_ENABLED=false`, fail-closed 503); production deploy их не запускает.
- **Документация:** [docs/DEPLOY.md](docs/DEPLOY.md), [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)

## Лицензия

MIT

## Автор

AI Effectiveness Assistant © 2025-2026
