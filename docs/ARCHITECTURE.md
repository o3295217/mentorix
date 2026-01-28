# АРХИТЕКТУРА ПРОЕКТА: AI Effectiveness Assistant

> Техническая документация для разработчиков. Актуальность: январь 2026.

---

## СОДЕРЖАНИЕ

1. [Структура проекта](#1-структура-проекта)
2. [Технологический стек](#2-технологический-стек)
3. [База данных](#3-база-данных)
4. [API Routes](#4-api-routes)
5. [React Hooks](#5-react-hooks)
6. [Библиотечный код (lib/)](#6-библиотечный-код-lib)
7. [Компоненты](#7-компоненты)
8. [AI Integration](#8-ai-integration)
9. [Потоки данных](#9-потоки-данных)
10. [Алгоритмы](#10-алгоритмы)
11. [Безопасность](#11-безопасность)
12. [Быстрый поиск: где что менять](#12-быстрый-поиск-где-что-менять)

---

## 1. СТРУКТУРА ПРОЕКТА

```
ai-assistant-spec/
├── app/                      # Next.js App Router
│   ├── api/                  # Backend API routes
│   │   ├── daily/            # Ежедневные записи
│   │   │   ├── route.ts      # CRUD для DailyEntry
│   │   │   ├── chat/         # Чат с AI о плане
│   │   │   ├── check-plan/   # Проверка плана AI
│   │   │   └── indicators/   # Индикаторы календаря
│   │   ├── evaluate/         # Оценка дня через AI
│   │   ├── evaluate-period/  # Оценка периодов
│   │   ├── forecast/         # AI прогноз достижения мечты
│   │   ├── goals/            # Управление целями
│   │   │   ├── dream/        # Мечта (5 лет)
│   │   │   ├── year/         # Годовые цели
│   │   │   ├── period/       # Периодические цели (legacy)
│   │   │   ├── items/        # Tracked Goals (новая модель)
│   │   │   ├── tags/         # Теги целей
│   │   │   └── move/         # Перемещение целей
│   │   ├── habits/           # Привычки
│   │   │   ├── route.ts      # CRUD привычек
│   │   │   └── suggestions/  # AI suggestions
│   │   ├── tasks/            # Открытые задачи
│   │   ├── profile/          # Профиль пользователя
│   │   │   ├── route.ts      # UserProfile
│   │   │   ├── blocks/       # ProfileBlock
│   │   │   ├── categories/   # ProfileCategory
│   │   │   ├── items/        # ProfileItem
│   │   │   └── insights/     # UserInsights (AI понимание)
│   │   ├── periods/          # Периодические оценки
│   │   ├── analytics/        # Аналитика и тренды
│   │   ├── progress/         # Статистика прогресса
│   │   └── health/           # Health check
│   ├── daily/                # Страница дневного планирования
│   ├── goals/                # Страница целей
│   ├── evaluation/[date]/    # Страница оценки дня
│   ├── forecast/             # Страница прогноза
│   ├── analytics/            # Страница аналитики
│   ├── history/              # История дней
│   ├── periods/              # Периодические оценки
│   ├── profile/              # Профиль пользователя
│   ├── progress/             # Прогресс
│   ├── tasks/                # Открытые задачи
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Dashboard
├── components/               # React компоненты
│   ├── goals/                # Компоненты целей
│   │   ├── DreamSection.tsx
│   │   ├── YearSection.tsx
│   │   ├── HalfYearSection.tsx
│   │   ├── QuarterSection.tsx
│   │   └── MonthSection.tsx
│   ├── DatePickerWithIndicators.tsx
│   ├── Speedometer.tsx       # Прогресс к мечте
│   ├── BalanceFlags.tsx      # Флаги баланса
│   ├── DreamProgress.tsx
│   ├── ProgressIndicator.tsx # Индикатор прогресса на Dashboard
│   ├── Navigation.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx       # Переключатель темы
│   └── Providers.tsx
├── hooks/                    # React Custom Hooks
│   ├── index.ts              # Реэкспорт хуков
│   ├── useDaily.ts           # Логика дневного планирования (~1100 строк)
│   ├── useGoals.ts           # Управление целями (~500 строк)
│   ├── useGoalsCopy.ts       # Копирование целей между периодами
│   └── useForecast.ts        # Логика прогнозов (~224 строки)
├── lib/                      # Утилиты и конфигурация
│   ├── prisma.ts             # Prisma Client singleton
│   ├── anthropic.ts          # Claude API integration (~575 строк)
│   ├── api-utils.ts          # API утилиты, безопасность
│   ├── dates.ts              # Работа с датами
│   ├── fact-utils.ts         # Утилиты для фактов
│   ├── goals-utils.ts        # Утилиты для целей
│   ├── rate-limit.ts         # Rate limiting для API
│   ├── task-match.ts         # Определение похожих задач
│   ├── types.ts              # TypeScript типы
│   ├── user-stats.ts         # Накопительная статистика (~437 строк)
│   └── prompts/              # AI промпты
│       ├── core.ts           # Базовые константы
│       ├── daily.ts          # Промпт оценки дня
│       ├── check-plan.ts     # Промпт проверки плана
│       ├── plan-chat.ts      # Промпт чата о плане
│       ├── forecast.ts       # Промпт прогноза
│       ├── period.ts         # Промпт оценки периода
│       └── types.ts          # Типы для промптов
├── prisma/
│   ├── schema.prisma         # Схема БД
│   └── migrations/           # Миграции
├── docs/
│   ├── SPECIFICATION.md      # ТЗ проекта
│   ├── USER_GUIDE.md         # Руководство пользователя
│   └── ARCHITECTURE.md       # Этот файл
└── public/                   # Статика
```

---

## 2. ТЕХНОЛОГИЧЕСКИЙ СТЕК

| Категория | Технология | Версия | Назначение |
|-----------|------------|--------|------------|
| **Framework** | Next.js | 16.0.1 | Full-stack React framework |
| **Language** | TypeScript | 5.7.2 | Типизация |
| **UI** | React | 19.0.0 | Компоненты |
| **Styling** | Tailwind CSS | 3.4.17 | Стили |
| **Charts** | Recharts | 2.15.0 | Графики |
| **ORM** | Prisma | 5.22.0 | База данных |
| **Database** | PostgreSQL | 15+ | Production БД в Docker |
| **AI** | Anthropic SDK | latest | Claude API |
| **Validation** | Zod | 4.1.13 | Schema validation |
| **Dates** | date-fns | 4.1.0 | Работа с датами |

### Модели Claude

| Задача | Модель | Причина |
|--------|--------|---------|
| Оценка дня | `claude-sonnet-4-5-20250929` | Качество важнее скорости |
| Оценка периода | `claude-sonnet-4-5-20250929` | Сложный анализ |
| Прогноз | `claude-sonnet-4-5-20250929` | Важные выводы |
| Чат о плане | `claude-3-5-haiku-20241022` | Скорость, низкая цена |
| Проверка плана | `claude-3-5-haiku-20241022` | Скорость, низкая цена |
| Update Insights | `claude-3-5-haiku-20241022` | Частые обновления |

---

## 3. БАЗА ДАННЫХ

### Схема (prisma/schema.prisma)

```prisma
// МЕЧТА (5 лет)
model DreamGoal {
  id        Int      @id @default(autoincrement())
  goalText  String   // Текст мечты
  years     Int      @default(5)  // Горизонт в годах
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ГОДОВЫЕ ЦЕЛИ
model YearGoal {
  id        Int      @id @default(autoincrement())
  year      Int      @unique
  goalsJson String   // JSON array of strings
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ПЕРИОДИЧЕСКИЕ ЦЕЛИ (legacy)
model PeriodGoal {
  id          Int      @id @default(autoincrement())
  periodType  String   // 'week', 'month', 'quarter', 'half_year', 'year'
  periodStart DateTime
  periodEnd   DateTime
  goalsJson   String   // JSON array of strings
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([periodType, periodStart])
}

// TRACKED GOALS (новая модель с метаданными)
model Goal {
  id           Int       @id @default(autoincrement())
  text         String
  periodType   String    // 'year', 'half_year', 'quarter', 'month', 'week'
  periodKey    String    // '2025', '2025-Q1', '2025-01', '2025-01-W1'
  completed    Boolean   @default(false)
  completedAt  DateTime?
  deadline     DateTime?
  priority     String    @default("none")  // 'high', 'medium', 'none'
  tagsJson     String    @default("[]")
  blockedByJson String   @default("[]")
  historyJson  String    @default("[]")
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@index([periodType, periodKey])
  @@index([completed])
  @@index([periodType, periodKey, completed])
}

// ДНЕВНАЯ ЗАПИСЬ
model DailyEntry {
  id                Int         @id @default(autoincrement())
  date              DateTime    @unique
  planText          String?     // План на день
  factText          String?     // Факт выполнения
  selectedTasksJson String?     // Выбранные задачи (JSON)
  // Контекст дня
  emotionalState    String?
  physicalState     String?
  importantEvents   String?
  energyLevel       Int?        // 1-10
  sleepQuality      Int?        // 1-10
  familyTimeMinutes Int?
  sportTimeMinutes  Int?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  evaluation        Evaluation?
}

// ОЦЕНКА ДНЯ
model Evaluation {
  id                   Int        @id @default(autoincrement())
  dailyEntryId         Int        @unique
  dailyEntry           DailyEntry @relation(...)

  // ГЛАВНАЯ МЕТРИКА
  dreamProgressScore   Int        @default(5)  // 1-10

  // Классические метрики
  strategyScore        Int        // 1-10
  operationsScore      Int        // 1-10
  teamScore            Int        // 1-10
  efficiencyScore      Int        // 1-10
  overallScore         Float      // Среднее

  // Текстовые поля
  feedbackText         String?
  planVsFactText       String?
  recommendationsText  String?

  // Alignment (день → неделя → месяц → ... → мечта)
  alignmentDayWeek     String?
  alignmentWeekMonth   String?
  alignmentMonthQuarter String?
  alignmentQuarterHalf String?
  alignmentHalfYear    String?
  alignmentYearDream   String?

  // Флаги баланса
  healthFlag           String?    // 'норма', 'внимание', 'критично'
  familyFlag           String?
  energyFlag           String?

  // Horizontal alignment
  workHealthAlignment  Int?       // 1-10
  workFamilyAlignment  Int?       // 1-10
  workValuesAlignment  Int?       // 1-10

  // AI suggestions
  suggestedTasksJson   String?
  suggestedTasksFromYesterday String?

  createdAt            DateTime   @default(now())
  @@index([dreamProgressScore])
  @@index([createdAt])
}

// ПРИВЫЧКИ
model Habit {
  id          Int      @id @default(autoincrement())
  taskText    String
  frequency   String   @default("daily")  // daily, weekdays, weekends, weekly, custom
  daysOfWeek  String?  // JSON: [1,2,3,4,5]
  interval    Int?     // Каждые N дней
  isActive    Boolean  @default(true)
  streak      Int      @default(0)
  bestStreak  Int      @default(0)
  totalDone   Int      @default(0)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([isActive])
  @@index([isActive, sortOrder])
}

// ОТКРЫТЫЕ ЗАДАЧИ
model OpenTask {
  id         Int       @id @default(autoincrement())
  taskText   String
  taskType   String    // 'strategic', 'operational'
  originDate DateTime
  isClosed   Boolean   @default(false)
  closedAt   DateTime?
  createdAt  DateTime  @default(now())
  @@index([isClosed])
  @@index([taskType, isClosed])
}

// USER INSIGHTS (AI понимание пользователя)
model UserInsights {
  id              Int      @id @default(autoincrement())
  patterns        String?  // Выявленные паттерны поведения
  strengths       String?  // Сильные стороны
  challenges      String?  // Сложности и зоны роста
  preferences     String?  // Предпочтения в планировании
  recommendations String?  // Рекомендации от AI
  motivators      String?  // Что мотивирует
  values          String?  // Ценности
  weeklySummary   String?  // Еженедельная сводка
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
}

// НАКОПИТЕЛЬНАЯ СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ
model UserStats {
  id                    Int      @id @default(autoincrement())
  totalDays             Int      @default(0)   // Всего оценённых дней
  totalPlanned          Int      @default(0)   // Всего запланировано задач
  totalCompleted        Int      @default(0)   // Всего выполнено задач
  avgCompletionPct      Float    @default(0)   // Средний % выполнения
  avgDailyScore         Float    @default(0)   // Средняя оценка дня
  completionByDayJson   String   @default("{}") // По дням недели
  completionByTypeJson  String   @default("{}") // По типам задач
  frequentCompletedJson String   @default("[]") // Часто выполняемые
  frequentFailedJson    String   @default("[]") // Часто проваливаемые
  habitsAvgCompletion   Float    @default(0)   // Средний % привычек
  trendDirection        String?  // up, down, stable
  trendPct              Float    @default(0)   // % изменения тренда
  bestDayOfWeek         String?  // Лучший день недели
  worstDayOfWeek        String?  // Худший день недели
  optimalTaskCount      Int      @default(5)   // Оптимальное кол-во задач
  currentStreak         Int      @default(0)   // Текущий streak
  bestStreak            Int      @default(0)   // Лучший streak
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

// КОНТЕКСТ МИРА (внешние события)
model WorldContext {
  id             Int      @id @default(autoincrement())
  date           DateTime @unique
  marketEvents   String?  // Рыночные события
  personalEvents String?  // Личные события
  constraints    String?  // Ограничения
  notes          String?  // Заметки
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### Индексы для производительности

Добавлены индексы на часто запрашиваемые поля:
- `Goal`: periodType + periodKey, completed
- `Evaluation`: dreamProgressScore, createdAt
- `OpenTask`: isClosed, taskType + isClosed
- `Habit`: isActive, isActive + sortOrder
- `PeriodGoal`: periodType + periodStart

---

## 4. API ROUTES

### Основные endpoints

| Endpoint | Методы | Файл | Описание |
|----------|--------|------|----------|
| `/api/daily` | GET, POST | `app/api/daily/route.ts` | CRUD дневных записей |
| `/api/daily/chat` | POST | `app/api/daily/chat/route.ts` | Чат с AI о плане |
| `/api/daily/check-plan` | POST | `app/api/daily/check-plan/route.ts` | Проверка плана AI |
| `/api/daily/indicators` | GET | `app/api/daily/indicators/route.ts` | Индикаторы для календаря |
| `/api/evaluate` | POST | `app/api/evaluate/route.ts` | Оценка дня через AI |
| `/api/evaluate-period` | POST | `app/api/evaluate-period/route.ts` | Оценка периода |
| `/api/forecast` | GET | `app/api/forecast/route.ts` | AI прогноз |
| `/api/goals/dream` | GET, POST | `app/api/goals/dream/route.ts` | Мечта |
| `/api/goals/year` | GET, POST | `app/api/goals/year/route.ts` | Годовые цели |
| `/api/goals/period` | GET, POST | `app/api/goals/period/route.ts` | Периодические цели |
| `/api/goals/items` | GET, POST, PUT, DELETE | `app/api/goals/items/route.ts` | Tracked Goals |
| `/api/goals/move` | POST | `app/api/goals/move/route.ts` | Перемещение целей |
| `/api/goals/tags` | GET, POST, DELETE | `app/api/goals/tags/route.ts` | Теги |
| `/api/habits` | GET, POST, PUT, DELETE | `app/api/habits/route.ts` | Привычки |
| `/api/habits/suggestions` | GET | `app/api/habits/suggestions/route.ts` | AI suggestions |
| `/api/tasks/open` | GET | `app/api/tasks/open/route.ts` | Открытые задачи |
| `/api/tasks/[id]/close` | POST | `app/api/tasks/[id]/close/route.ts` | Закрыть задачу |
| `/api/profile` | GET, POST | `app/api/profile/route.ts` | Профиль |
| `/api/profile/insights` | GET, PUT | `app/api/profile/insights/route.ts` | AI insights |
| `/api/analytics/trend` | GET | `app/api/analytics/trend/route.ts` | Тренды |
| `/api/progress` | GET | `app/api/progress/route.ts` | Статистика |

### Паттерн API route

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeParseJson } from '@/lib/api-utils'
import { z } from 'zod'

const Schema = z.object({
  field: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const param = searchParams.get('param')

    const data = await prisma.model.findMany({ where: { ... } })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = Schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const result = await prisma.model.create({ data: validation.data })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

---

## 5. REACT HOOKS

### useDaily.ts (~1100 строк)

**Назначение:** Управление дневным планированием

**State:**
```typescript
const [selectedDate, setSelectedDate] = useState<string>(...)
const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null)
const [tasks, setTasks] = useState<OpenTask[]>([])
const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
const [habits, setHabits] = useState<Habit[]>([])
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
const [checkPlanResult, setCheckPlanResult] = useState<CheckPlanResponse | null>(null)
const [isLoading, setIsLoading] = useState(true)
// ... и другие
```

**Основные функции:**
- `loadData()` — загрузка данных при смене даты
- `savePlanWithTasks()` — сохранение плана
- `addTask()` / `removeTask()` — управление задачами
- `toggleTaskSelection()` — выбор задач
- `checkPlan()` — проверка плана через AI
- `sendChatMessage()` — отправка сообщения в чат
- `addSuggestedTask()` — добавление предложенной задачи

**Зависимости:**
- `lib/types.ts` — типы
- `/api/daily` — backend
- `/api/daily/chat` — чат
- `/api/daily/check-plan` — проверка плана

### useGoals.ts (~500 строк)

**Назначение:** Управление целями всех уровней

**State:**
```typescript
const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())
const [goals, setGoals] = useState<Goal[]>([])  // Tracked goals
const [processingGoals, setProcessingGoals] = useState<Set<string>>(new Set())
```

**Основные функции:**
- `loadDreamGoal()` — загрузка мечты
- `saveDreamGoal()` — сохранение мечты
- `loadYearGoals()` — загрузка годовых целей
- `saveYearGoals()` — сохранение годовых целей
- `loadPeriodGoals()` — загрузка периодических целей
- `savePeriodGoals()` — сохранение периодических целей
- `loadTrackedGoals()` — загрузка tracked goals
- `createTrackedGoal()` — создание tracked goal
- `updateGoal()` — обновление цели
- `deleteGoal()` — удаление цели
- `moveGoal()` — перемещение цели

**Lock механизм:**
```typescript
const processingLockRef = useRef<Set<string>>(new Set())
// Используется для предотвращения race conditions при создании целей
```

### useGoalsCopy.ts

**Назначение:** Копирование целей между периодами

**Функции:**
- `copyGoalToParent()` — копирование вверх по иерархии
- `copyGoalToChild()` — копирование вниз по иерархии
- `isDuplicate()` — проверка дубликатов

### useForecast.ts

**Назначение:** AI прогноз достижения мечты

---

## 6. БИБЛИОТЕЧНЫЙ КОД (lib/)

### lib/anthropic.ts (~600 строк)

**Назначение:** Интеграция с Claude API

**Структура:**
```typescript
// Lazy initialization клиента
let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic { ... }

// Retry logic
async function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>

// Основные функции
export async function evaluateDay(request: DailyEvaluationRequest): Promise<DailyEvaluationResponse>
export async function evaluatePeriod(request: PeriodEvaluationRequest): Promise<PeriodEvaluationResponse>
export async function generateForecast(request: ForecastRequest): Promise<ForecastResponse>
export async function updateUserInsights(request: UpdateInsightsRequest): Promise<UserInsights>
```

**Retry с exponential backoff:**
```typescript
const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options
// Обработка: rate limit, server errors, network errors
// Delay = baseDelayMs * 2^attempt + jitter
```

### lib/api-utils.ts

**Назначение:** Утилиты для API

```typescript
// Error handling
export function apiError(message: string, status: number, error?: unknown): NextResponse
export const ApiErrors = { notFound, badRequest, validationFailed, serverError }

// JSON parsing
export function safeParseJson<T>(json: string | null | undefined, fallback: T): T
export function safeParseJsonArray<T>(json: string | null | undefined, validator?): T[]

// Input sanitization
export function sanitizeUserInput(text: string, maxLength?: number): string
export function validateInputSize(inputs, limits): { valid: boolean; errors: string[] }

// AI response parsing
export function extractJsonFromAIResponse<T>(responseText: string, validator, errorContext): T

// Score validation
export function isValidScore(value: unknown, min?: number, max?: number): boolean
export function clampScore(value: number, min?: number, max?: number): number
```

**Prompt injection patterns:**
```typescript
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /ignore\s+(all\s+)?above\s+instructions/gi,
  /disregard\s+(all\s+)?previous/gi,
  // ... и другие
]
```

### lib/dates.ts

**Назначение:** Работа с датами

```typescript
export type PeriodType = 'week' | 'month' | 'quarter' | 'half_year' | 'year'

export function getPeriodDates(date: Date, periodType: PeriodType): { start: Date; end: Date }
export function getPeriodName(date: Date, periodType: PeriodType): string
export function getYearDistance(year: number, currentYear?: number): number
export function getDetailLevel(year: number, currentYear?: number): 'month' | 'quarter' | 'half' | 'year'

// Date-only helpers (избегаем UTC shift для 'YYYY-MM-DD')
export function parseDateParam(value: string): Date
export function toDateKey(date: Date): string
```

### lib/task-match.ts

**Назначение:** Определение похожих задач (Jaccard similarity)

```typescript
export function areTasksSimilar(aText: string, bText: string): boolean
// Использует:
// - normalize() — приведение к нижнему регистру, удаление пунктуации
// - tokens() — разбивка на токены, фильтрация стоп-слов
// - jaccard() — Jaccard similarity coefficient
// Threshold: 0.6 (60% совпадения токенов)
```

### lib/rate-limit.ts

**Назначение:** Rate limiting для API (защита от злоупотреблений)

```typescript
// Sliding window algorithm
export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitResult
export function getClientIdentifier(request: Request): string

// Предустановленные лимиты
export const rateLimiters = {
  ai: { limit: 20, windowMs: 60000 },      // 20 AI запросов в минуту
  api: { limit: 100, windowMs: 60000 },    // 100 обычных запросов в минуту
}
```

### lib/user-stats.ts

**Назначение:** Накопительная статистика пользователя (~437 строк)

```typescript
// Пересчёт всей статистики
export async function recalculateUserStats(): Promise<void>

// Получение статистики для AI промптов
export async function getUserStatsForAI(): Promise<string>

// Статистика включает:
// - Общее количество дней и задач
// - Средний % выполнения
// - Лучший/худший день недели
// - Часто выполняемые/проваливаемые задачи
// - Тренд (up/down/stable)
// - Streak (текущий и лучший)
```

### lib/prompts/

**Структура промптов:**

| Файл | Содержимое |
|------|------------|
| `core.ts` | Базовые константы |
| `types.ts` | Типы для промптов |
| `daily.ts` | `DAILY_EVALUATION_SYSTEM_PROMPT`, `buildUserDataPrompt()` |
| `check-plan.ts` | `CHECK_PLAN_SYSTEM_PROMPT`, `buildCheckPlanPrompt()` |
| `plan-chat.ts` | `PLAN_CHAT_SYSTEM_PROMPT`, `buildPlanChatContext()` |
| `forecast.ts` | `buildForecastPrompt()` |
| `period.ts` | `buildPeriodEvaluationPrompt()` |

---

## 7. КОМПОНЕНТЫ

### Список компонентов (11 основных + 5 для целей)

**Основные:**
- `AuthGuard`
- `BalanceFlags`
- `DatePickerWithIndicators`
- `DreamProgress`
- `Navigation`
- `ProgressIndicator`
- `Providers`
- `Speedometer`
- `ThemeProvider`
- `ThemeToggle`
- `UncompletedTasksModal`

**Компоненты целей (goals/):**
- `goals/DreamSection`
- `goals/HalfYearSection`
- `goals/MonthSection`
- `goals/QuarterSection`
- `goals/YearSection`

### Иерархия компонентов целей

```
app/goals/page.tsx
├── DreamSection.tsx         # Мечта
├── YearSection.tsx          # Годовые цели (для каждого года до мечты)
│   └── [копирование в Q/M/W]
├── HalfYearSection.tsx      # Полугодия (H1/H2)
├── QuarterSection.tsx       # Кварталы (Q1-Q4)
│   └── [копирование в M/W]
└── MonthSection.tsx         # Месяцы
    └── [копирование в W, показ недель]
```

### Компоненты страницы Daily

```
app/daily/page.tsx
├── DatePickerWithIndicators  # Календарь с индикаторами
├── [список задач]            # Чекбоксы, drag & drop
├── [чат с AI]                # Сообщения, input
└── [результат check-plan]    # Рекомендации AI
```

### Компоненты Dashboard

```
app/page.tsx
├── Speedometer              # Прогресс к мечте
├── DreamProgress            # Детали прогресса
├── BalanceFlags             # Здоровье, семья, энергия
└── [график оценок]          # Recharts LineChart
```

---

## 8. AI INTEGRATION

### Потоки взаимодействия с AI

```
1. Оценка дня (POST /api/evaluate)
   ├── Собираем: мечту, годовые цели, периодические цели, план, факт, контекст
   ├── Формируем промпт (buildUserDataPrompt)
   ├── Вызываем Claude Sonnet (evaluateDay)
   ├── Парсим JSON ответ
   ├── Валидируем структуру
   ├── Сохраняем в Evaluation
   └── Обновляем UserInsights (если есть)

2. Проверка плана (POST /api/daily/check-plan)
   ├── Собираем: цели периодов, текущий план, историю
   ├── Формируем промпт (buildCheckPlanPrompt)
   ├── Вызываем Claude Haiku
   ├── Парсим JSON ответ
   └── Возвращаем рекомендации

3. Чат о плане (POST /api/daily/chat)
   ├── Собираем: цели, план, insights, история сообщений
   ├── Формируем промпт (buildPlanChatContext)
   ├── Вызываем Claude Haiku
   └── Возвращаем ответ

4. Прогноз (GET /api/forecast)
   ├── Собираем: мечту, историю оценок, текущий темп
   ├── Формируем промпт (buildForecastPrompt)
   ├── Вызываем Claude Sonnet
   └── Возвращаем прогноз
```

### Структура ответа оценки дня

```typescript
interface DailyEvaluationResponse {
  dream_progress_score: number     // 1-10
  strategy_score: number           // 1-10
  operations_score: number         // 1-10
  team_score: number               // 1-10
  efficiency_score: number         // 1-10
  overall_score: number            // 1-10
  feedback: string
  plan_vs_fact: string
  alignment: {
    day_to_week: string
    week_to_month: string
    month_to_quarter: string
    quarter_to_half: string
    half_to_year: string
    year_to_dream: string
  }
  balance_flags: {
    health: 'норма' | 'внимание' | 'критично'
    family: 'норма' | 'внимание' | 'критично'
    energy: 'норма' | 'внимание' | 'критично'
  }
  horizontal_alignment: {
    work_health: number            // 1-10
    work_family: number            // 1-10
    work_values: number            // 1-10
  }
  recommendations: string
  suggested_tasks?: string[]
}
```

---

## 9. ПОТОКИ ДАННЫХ

### Загрузка страницы Daily

```
1. useDaily hook инициализируется
2. loadData() вызывается с selectedDate
3. Параллельно загружаются:
   ├── /api/daily?date=YYYY-MM-DD     → dailyEntry, tasks
   ├── /api/habits?date=YYYY-MM-DD    → habits
   └── /api/goals/period?type=week    → weekGoals
4. Если есть dailyEntry.selectedTasksJson → selectedTasks
5. Если нет tasks но есть привычки → автодобавление привычек
```

### Сохранение плана

```
1. Пользователь изменяет задачи
2. savePlanWithTasks() вызывается
3. POST /api/daily с:
   ├── date
   ├── planText (tasks.map(t => t.taskText).join('\n'))
   └── selectedTasksJson
4. Если есть evaluation → очищаем (план изменился)
```

### Оценка дня

```
1. Пользователь нажимает "Получить оценку"
2. POST /api/evaluate с dailyEntryId
3. API собирает все данные (мечта, цели, план, факт)
4. Вызов Claude API
5. Парсинг и валидация ответа
6. Сохранение в Evaluation
7. Обновление UserInsights (если включено)
8. Возврат результата
```

---

## 10. АЛГОРИТМЫ

### Определение похожих задач (task-match.ts)

```typescript
function areTasksSimilar(aText, bText): boolean {
  // 1. Нормализация
  const aNorm = normalize(aText)  // lowercase, удаление пунктуации
  const bNorm = normalize(bText)

  // 2. Точное совпадение
  if (aNorm === bNorm) return true

  // 3. Containment check (для коротких дополнений)
  if (shorter.length >= 12 && longer.includes(shorter)) return true

  // 4. Jaccard similarity
  const aTokens = tokens(aText)  // разбивка, фильтрация стоп-слов
  const bTokens = tokens(bText)
  const sim = jaccard(aTokens, bTokens)  // |A ∩ B| / |A ∪ B|

  return sim >= 0.6  // 60% порог
}
```

### Определение периода по дате (dates.ts)

```typescript
function getPeriodDates(date: Date, periodType: PeriodType) {
  switch (periodType) {
    case 'week':
      return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(...) }
    case 'month':
      return { start: startOfMonth(date), end: endOfMonth(date) }
    case 'quarter':
      return { start: startOfQuarter(date), end: endOfQuarter(date) }
    case 'half_year':
      const month = date.getMonth()
      if (month < 6) {
        return { start: new Date(year, 0, 1), end: new Date(year, 5, 30) }
      } else {
        return { start: new Date(year, 6, 1), end: new Date(year, 11, 31) }
      }
    case 'year':
      return { start: startOfYear(date), end: endOfYear(date) }
  }
}
```

### Period Key формат

```
year:      "2025"
half_year: "2025-H1", "2025-H2"
quarter:   "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"
month:     "2025-01", "2025-02", ..., "2025-12"
week:      "2025-01-W1", "2025-01-W2", ..., "2025-01-W5"
```

---

## 11. БЕЗОПАСНОСТЬ

### Аутентификация и защита роутов

```
middleware.ts                 # Server-side защита роутов
├── Проверяет auth_token cookie
├── Публичные пути: /login, /register, /forgot-password, /reset-password, /api/auth/*, /api/health
├── API: возвращает 401 без токена
└── Страницы: редирект на /login

components/AuthGuard.tsx      # Client-side защита
├── Проверяет /api/auth/me
├── Публичные пути пропускает
├── При 401: редирект на /login
└── При загрузке: показывает спиннер

components/Navigation.tsx     # Дополнительная защита
├── Запрос /api/auth/me для данных пользователя
├── При 401: window.location.href = '/login'
└── Показывает имя пользователя в header
```

**Поток аутентификации:**
1. `middleware.ts` — первая линия защиты (server)
2. `AuthGuard` — вторая линия (client, для SPA-навигации)
3. `Navigation` — третья линия (обработка истечения сессии)

### Защита от Prompt Injection

```typescript
// lib/api-utils.ts
export function sanitizeUserInput(text: string, maxLength = 50000): string {
  // 1. Удаление control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // 2. Фильтрация injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]')
  }

  // 3. Ограничение длины
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '\n...[truncated]'
  }

  return sanitized
}
```

### Безопасная замена в промптах

```typescript
// Использовать function replacement для предотвращения double replacement
const prompt = PROMPT_TEMPLATE
  .replace('{user_input}', () => sanitizeUserInput(userInput))
  .replace('{other}', () => otherValue)
```

### Безопасный парсинг JSON

```typescript
// Всегда использовать safeParseJson вместо JSON.parse
const data = safeParseJson<MyType>(jsonString, defaultValue)
```

### Валидация входных данных

```typescript
// Использовать Zod для всех POST/PUT endpoints
const Schema = z.object({
  field: z.string().min(1).max(1000),
  number: z.number().int().min(1).max(10),
})

const validation = Schema.safeParse(body)
if (!validation.success) {
  return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
}
```

---

## 12. БЫСТРЫЙ ПОИСК: ГДЕ ЧТО МЕНЯТЬ

### Хочу изменить...

| Что | Где искать |
|-----|------------|
| **Текст промпта для оценки дня** | `lib/prompts/daily.ts` |
| **Текст промпта для проверки плана** | `lib/prompts/check-plan.ts` |
| **Текст промпта для чата** | `lib/prompts/plan-chat.ts` |
| **Модель Claude** | `lib/anthropic.ts` (поиск `claude-`) |
| **Логику оценки дня** | `app/api/evaluate/route.ts` |
| **UI страницы целей** | `app/goals/page.tsx` + `components/goals/*.tsx` |
| **UI дневного планирования** | `app/daily/page.tsx` |
| **Логику задач/плана** | `hooks/useDaily.ts` |
| **Логику целей** | `hooks/useGoals.ts` |
| **Схему БД** | `prisma/schema.prisma` |
| **Типы данных** | `lib/types.ts`, `lib/prompts/types.ts` |
| **Работу с датами** | `lib/dates.ts` |
| **API утилиты** | `lib/api-utils.ts` |
| **Похожие задачи** | `lib/task-match.ts` |
| **Retry logic для AI** | `lib/anthropic.ts` (функция `withRetry`) |
| **Индексы БД** | `prisma/schema.prisma` (секции `@@index`) |

### Добавляю новый...

| Что | Где создавать |
|-----|---------------|
| **API endpoint** | `app/api/[name]/route.ts` |
| **Страницу** | `app/[name]/page.tsx` |
| **Компонент** | `components/[Name].tsx` |
| **Hook** | `hooks/use[Name].ts` |
| **Тип** | `lib/types.ts` |
| **Промпт** | `lib/prompts/[name].ts` |
| **Утилиту** | `lib/[name].ts` |
| **Модель БД** | `prisma/schema.prisma` + миграция |

### Отладка

| Проблема | Где смотреть |
|----------|--------------|
| **Ошибка API** | Console в браузере + терминал сервера |
| **Ошибка Claude** | `lib/anthropic.ts`, логи в консоли |
| **Ошибка БД** | `prisma/schema.prisma`, миграции |
| **Ошибка типов** | `npm run build` покажет все ошибки TypeScript |
| **Ошибка линтера** | `npm run lint` |

---

## CHANGELOG АРХИТЕКТУРЫ

### 6 января 2026
- **Удалён `factText`** — факт теперь определяется через `selectedTasksJson` (отмеченные чекбоксы)
- **Добавлен `hasUnsavedChanges`** — индикатор несохранённых изменений плана
- **Изменена логика сохранения**:
  - План (добавление/редактирование/удаление задач) → сохраняется по кнопке "Сохранить план"
  - Чекбоксы → автосохранение (сразу в БД)
- **Исправлен race condition** — `hasLoadedOnceRef` теперь ref вместо state для синхронного обновления при смене даты
- Убраны функции `saveFact()` и `transferCompletedTasks()`
- Обновлён UI кнопки "Сохранить план" с индикатором ⚠️

### Январь 2026
- Добавлен `lib/rate-limit.ts` — Rate limiting для AI endpoints
- Добавлен `lib/user-stats.ts` — накопительная статистика пользователя
- Добавлена модель `UserStats` — хранение статистики в БД
- Добавлена модель `WorldContext` — внешние события и контекст
- Добавлен `ProgressIndicator.tsx` — индикатор прогресса на Dashboard
- Добавлен `ThemeToggle.tsx` — переключатель темы
- `useDaily.ts` расширен до ~1100 строк
- Обновлена документация

### Декабрь 2025
- Добавлен `lib/api-utils.ts` — безопасность и утилиты
- Добавлен `lib/task-match.ts` — определение похожих задач
- Добавлен retry logic с exponential backoff в `lib/anthropic.ts`
- Добавлены индексы БД для производительности
- Исправлены unsafe `JSON.parse()` на `safeParseJson()`
- Исправлена уязвимость prompt injection

---

*Последнее обновление: 6 января 2026*
