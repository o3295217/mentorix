# AI Effectiveness Assistant

Личный ИИ-ассистент для управления эффективностью с иерархической системой целей и автоматической оценкой через Claude API.

## Возможности

- 🎯 Иерархия целей: День → Неделя → Месяц → Квартал → Полугодие → Год → Мечта (5 лет)
- 📝 Ежедневное планирование с планом и фактом выполнения
- 🤖 Автоматическая оценка дня через Claude API с детальным анализом
- 📊 Аналитика и графики эффективности
- 🔗 Проверка alignment (выравнивания) целей между уровнями
- 📈 История всех дней с оценками
- ✅ Управление незакрытыми задачами
- 🚗 Прогресс к мечте с расчётом прогноза достижения
- 🔮 AI-прогнозы и периодические оценки (неделя, месяц, квартал, год)
- 👤 Персонализированный профиль пользователя
- ⚖️ Мониторинг баланса: здоровье, семья, энергия

## Технологии

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** SQLite + Prisma ORM
- **AI:** Anthropic Claude API (claude-sonnet-4-5-20250929) с Prompt Caching
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
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="ваш-api-ключ-здесь"
```

### 4. Инициализировать базу данных

```bash
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
│   │   ├── evaluate/          # Оценка дня (Claude AI)
│   │   ├── evaluate-period/   # Оценка периодов (неделя/месяц/квартал/год)
│   │   ├── forecast/          # AI-прогнозы
│   │   ├── goals/             # Цели (dream, period)
│   │   ├── health/            # Данные здоровья
│   │   ├── periods/           # Периодические цели
│   │   ├── profile/           # Профиль пользователя
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
│   └── tasks/                 # Управление задачами
├── components/                # React компоненты
│   ├── BalanceFlags.tsx       # Флаги баланса (здоровье/семья/энергия)
│   ├── DatePickerWithIndicators.tsx  # Календарь с индикаторами
│   ├── DreamProgress.tsx      # Виджет прогресса к мечте
│   ├── Navigation.tsx         # Навигация с активной вкладкой
│   ├── ProgressIndicator.tsx  # Индикатор прогноза на главной
│   └── Speedometer.tsx        # Визуализация скорости
├── lib/                       # Утилиты
│   ├── anthropic.ts           # Claude API интеграция с кэшированием
│   ├── dates.ts               # Работа с датами
│   ├── prisma.ts              # Prisma клиент
│   ├── types.ts               # TypeScript типы
│   └── prompts/               # Системные промпты для AI
│       ├── core.ts            # Базовый промпт
│       └── daily.ts           # Промпт для оценки дня
├── prisma/
│   └── schema.prisma          # Схема базы данных
├── docs/
│   ├── SPECIFICATION.md       # Техническая спецификация
│   └── USER_GUIDE.md          # Руководство пользователя
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Документация

- 📘 [Руководство пользователя](docs/USER_GUIDE.md) — как пользоваться приложением
- 📋 [Техническая спецификация](docs/SPECIFICATION.md) — детальное описание архитектуры

## Получение API ключа Anthropic

1. Зарегистрируйтесь на https://console.anthropic.com
2. Создайте новый API ключ
3. Добавьте его в `.env.local`

**Примерная стоимость:** $5-20/месяц при активном использовании (с учётом Prompt Caching).

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
| `DATABASE_URL` | Путь к SQLite файлу | Да |
| `ANTHROPIC_API_KEY` | API ключ Anthropic | Да |

## Лицензия

MIT

## Автор

AI Effectiveness Assistant © 2025
