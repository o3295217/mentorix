# АРХИТЕКТУРА ПРОЕКТА: AI Effectiveness Assistant

> Техническая документация для разработчиков. Актуальность: апрель 2026.

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
│   │   │   ├── schedule/     # Временное расписание задач дня
│   │   │   └── indicators/   # Индикаторы календаря
│   │   ├── evaluate/         # Оценка дня через AI
│   │   ├── evaluate-period/  # Оценка периодов
│   │   ├── forecast/         # AI прогноз достижения мечты
│   │   ├── goals/            # Управление целями
│   │   │   ├── dream/        # Мечта
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
│   ├── onboarding/           # Онбординг (5 слайдов, тёмная тема)
│   ├── layout.tsx            # Root layout
│   ├── opengraph-image.tsx   # OG preview image для шаринга
│   ├── twitter-image.tsx     # Twitter/X preview image
│   └── page.tsx              # Dashboard / Landing
├── components/               # React компоненты
│   ├── goals/                # Компоненты целей
│   │   │   ├── DreamBar.tsx        # Компактная мечта: текст (click to expand) + горизонт + edit
│   │   ├── HorizonsCard.tsx   # Rolling Wave визуализация (3 колонки: Детально/Укрупнённо/Направление)
│   │   ├── HalfYearView.tsx   # Полугодия H1/H2: цели с прогресс-барами, редактирование, collapse
│   │   ├── StrategyCards.tsx  # Горизонтальные карточки целей по годам с прогрессом
│   │   ├── QuarterView.tsx    # Квартальные цели (2x2 grid, Q1-Q4, прогресс-бары)
│   │   ├── MonthTimeline.tsx  # Горизонтальная шкала 12 месяцев (sticky) с pill-превью задач
│   │   ├── MonthSection.tsx   # Детализация месяца: цели с чекбоксами + WeekCard
│   │   ├── WeekStrip.tsx      # Компактные бейджи W1-W5 с мини-прогрессом
│   │   ├── WeekCard.tsx       # Раскрытая неделя: цели, checkbox, priority, drag
│   │   ├── GoalsChatTrigger.tsx # Вертикальная кнопка ИИ-помощника
│   │   └── GoalsChatPanel.tsx  # Выезжающая ИИ-панель декомпозиции
│   ├── landing/              # Модульные секции публичного лендинга
│   │   ├── HeroSection.tsx    # Hero + above-the-fold оффер
│   │   ├── PainSection.tsx    # Проблемы и триггеры
│   │   ├── DreamSection.tsx   # Образ результата и контекст мечты
│   │   ├── DayFlowSection.tsx # Ритм дня с авто-переключением шагов
│   │   ├── EvaluationSection.tsx # Демонстрация AI-оценки дня
│   │   ├── ToolsSection.tsx   # Витрина инструментов системы
│   │   ├── TrustSection.tsx   # Доверие, privacy, локальное хранение
│   │   ├── CtaSection.tsx     # Финальный CTA-блок
│   │   ├── FooterSection.tsx  # Футер лендинга
│   │   ├── ToolVisual.tsx     # Визуализация карточек инструментов
│   │   ├── data.tsx           # Константы и данные лендинга
│   │   └── useScrollReveal.ts # IntersectionObserver для reveal-анимаций
│   ├── DatePickerWithIndicators.tsx
│   ├── Speedometer.tsx       # Прогресс к мечте
│   ├── BalanceFlags.tsx      # Флаги баланса
│   ├── DreamProgress.tsx
│   ├── Landing.tsx           # Оркестратор публичного лендинга
│   ├── LayoutFooter.tsx      # Футер (скрывается на landing/auth/onboarding)
│   ├── ProgressIndicator.tsx # Индикатор прогресса на Dashboard
│   ├── Navigation.tsx        # Навигация, содержит <header>
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx       # Переключатель темы
│   └── Providers.tsx
├── hooks/                    # React Custom Hooks
│   ├── index.ts              # Реэкспорт хуков
│   ├── useDaily.ts           # Логика дневного планирования (~1100 строк)
│   ├── useGoals.ts           # Управление целями (~550 строк, parentId, автозавершение)
│   ├── useGoalsChat.ts       # ИИ-чат целей: guided flow, retry, extractGoals (с иерархической нумерацией)
│   ├── useGoalsCopy.ts       # Копирование целей между периодами
│   ├── useInlineEdit.ts      # Хук inline-редактирования целей
│   ├── useCopyDropdown.ts    # Хук dropdown копирования в период
│   └── useForecast.ts        # Логика прогнозов (~224 строки)
├── lib/                      # Утилиты и конфигурация
│   ├── prisma.ts             # Prisma Client singleton
│   ├── prisma-encryption.ts  # Prisma middleware: прозрачное шифрование полей (AES-256-GCM)
│   ├── prisma-audit.ts       # Prisma middleware: автоматический аудит-лог write-операций
│   ├── anthropic.ts          # Claude API integration (~725 строк), двухуровневая модель (smart/fast)
│   ├── api-utils.ts          # API утилиты, безопасность
│   ├── audit.ts              # Ручной аудит-лог (auth events и т.д.)
│   ├── auth.ts               # Аутентификация (bcrypt 12 rounds, transparent migration)
│   ├── auth-constants.ts     # Константы аутентификации (MIN_PASSWORD_LENGTH)
│   ├── ai-usage.ts           # Трекинг использования AI
│   ├── completed-work.ts     # Синхронизация CompletedWork из DailyEntry
│   ├── dates.ts              # Работа с датами
│   ├── daily-schedule.ts     # Схема/типы расписания задач дня
│   ├── encryption.ts         # AES-256-GCM шифрование/дешифрование текстовых полей
│   ├── email.ts              # Отправка email
│   ├── fact-utils.ts         # Утилиты для фактов
│   ├── get-user-id.ts        # Безопасное извлечение userId (поддержка single-user mode)
│   ├── goals-utils.ts        # Утилиты для целей (getPeriodKey — единый алгоритм ключей периодов)
│   ├── hmac.ts               # HMAC-SHA256 подпись/верификация токенов (Edge Runtime)
│   ├── rate-limit.ts         # Rate limiting для API (fixed window + account lockout)
│   ├── safe-json.ts          # Безопасный JSON.parse с fallback
│   ├── task-match.ts         # Определение похожих задач
│   ├── telegram.ts           # Уведомления в Telegram
│   ├── types.ts              # TypeScript типы
│   ├── user-stats.ts         # Накопительная статистика (~437 строк)
│   └── prompts/              # AI промпты
│       ├── core.ts           # Базовые константы
│       ├── daily.ts          # Промпт оценки дня
│       ├── check-plan.ts     # Промпт проверки плана
│       ├── plan-chat.ts      # Промпт чата о плане
│       ├── forecast.ts       # Промпт прогноза
│       ├── period.ts         # Промпт оценки периода
│       ├── goals-decompose.ts # Промпт ИИ-декомпозиции целей с ограничением контекста
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
| Чат о плане | `claude-sonnet-4-20250514` | Качество коучинга |
| Проверка плана | `claude-sonnet-4-20250514` | Качество анализа |
| Декомпозиция целей | `claude-sonnet-4-20250514` | Guided flow |
| Update Insights | `claude-sonnet-4-20250514` | Качество наблюдений |

---

## 3. БАЗА ДАННЫХ

PostgreSQL 16 (в Docker-контейнере). ORM — Prisma 5.22, миграции через `prisma migrate deploy`.

### Схема (prisma/schema.prisma)

```prisma
// ==================== АУТЕНТИФИКАЦИЯ ====================

enum ThemePreference { light, dark, system }

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  passwordHash    String
  role            String    @default("user")
  isActive        Boolean   @default(true)
  emailVerified   Boolean   @default(false)
  onboardingCompleted Boolean @default(false)
  themePreference ThemePreference @default(system)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?
  // ... связи со всеми моделями
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  userAgent String?
  ipAddress String?
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        Int       @id @default(autoincrement())
  userId    String
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

// ==================== ЦЕЛИ ====================

model DreamGoal {
  id        Int      @id @default(autoincrement())
  userId    String
  goalText  String
  months    Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model YearGoal {
  id        Int      @id @default(autoincrement())
  userId    String
  year      Int
  goalsJson String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, year])
}

model PeriodGoal {
  id          Int      @id @default(autoincrement())
  userId      String
  periodType  String   // 'week', 'month', 'quarter', 'half_year', 'year'
  periodStart DateTime
  periodEnd   DateTime
  goalsJson   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Goal {
  id            Int       @id @default(autoincrement())
  userId        String
  text          String
  periodType    String    // 'year', 'half_year', 'quarter', 'month', 'week'
  periodKey     String    // '2025', '2025-Q1', '2025-01', '2025-01-W1'
  completed     Boolean   @default(false)
  completedAt   DateTime?
  deadline      DateTime?
  priority      String    @default("medium")  // 'high', 'medium', 'low'
  tagsJson      String    @default("[]")
  blockedByJson String    @default("[]")
  historyJson   String    @default("[]")
  sortOrder     Int       @default(0)
  parentId      Int?      // Родительская цель (иерархия: Год → Полугодие → Квартал → Месяц → Неделя)
  parent        Goal?     @relation("GoalHierarchy", fields: [parentId], references: [id])
  children      Goal[]    @relation("GoalHierarchy")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@index([parentId])
}

model GoalTag {
  id        Int      @id @default(autoincrement())
  userId    String
  name      String
  color     String   @default("#6B7280")
  createdAt DateTime @default(now())
  @@unique([userId, name])
}

// ==================== ЕЖЕДНЕВНЫЕ ЗАПИСИ ====================

model DailyEntry {
  id                Int          @id @default(autoincrement())
  userId            String
  date              DateTime
  planText          String?
  factText          String?
  planSnapshotJson  String?      // Снимок плана на момент создания
  extraTasksJson    String       @default("[]")
  selectedTasksJson String?
  // Контекст дня
  emotionalState    String?
  physicalState     String?
  lifeEvents        String?      // Жизненные события
  externalFactors   String?      // Внешние факторы
  energyLevel       Int?         // 1-10
  sleepQuality      Int?         // 1-10
  familyTime        Int?         // Минуты
  exerciseTime      Int?         // Минуты
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  evaluation        Evaluation?
  schedule          DailySchedule?
  @@unique([userId, date])
}

model DailySchedule {
  id            Int        @id @default(autoincrement())
  dailyEntryId  Int        @unique
  dailyEntry    DailyEntry @relation(fields: [dailyEntryId], references: [id], onDelete: Cascade)
  scheduleJson  Json       // v1 task-only; v2 task + meal/rest/buffer; v3 planning window + category/isFixed blocks; шифруется
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

model Evaluation {
  id                    Int        @id @default(autoincrement())
  dailyEntryId          Int        @unique
  dailyEntry            DailyEntry @relation(...)
  // Основные метрики
  dreamProgressScore    Int        @default(5)  // 1-10
  strategyScore         Int        // 1-10
  operationsScore       Int        // 1-10
  teamScore             Int        // 1-10
  efficiencyScore       Int        // 1-10
  overallScore          Float      // Средневзвешенное
  // Текстовые поля
  feedbackText          String     // Обратная связь от AI
  planVsFactText        String     // Анализ план vs факт
  recommendationsText   String     // Рекомендации
  // Вертикальный alignment (день → мечта)
  alignmentDayWeek      String
  alignmentWeekMonth    String
  alignmentMonthQuarter String
  alignmentQuarterHalf  String
  alignmentHalfYear     String
  alignmentYearDream    String
  // Флаги баланса
  healthFlag            String?    // 'ok' | 'warning' | 'critical'
  familyFlag            String?
  energyFlag            String?
  // Горизонтальный alignment
  workHealthAlignment   String?
  workFamilyAlignment   String?
  workValuesAlignment   String?
  // AI suggestions
  suggestedTasksJson    String?
  createdAt             DateTime   @default(now())
}

// ==================== ПРИВЫЧКИ ====================

model Habit {
  id         Int      @id @default(autoincrement())
  userId     String
  taskText   String
  frequency  String   @default("daily")
  daysOfWeek String?  // JSON: [1,2,3,4,5]
  interval   Int?     // Каждые N дней
  isActive   Boolean  @default(true)
  streak     Int      @default(0)
  bestStreak Int      @default(0)
  totalDone  Int      @default(0)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ==================== ЗАДАЧИ ====================

model OpenTask {
  id         Int       @id @default(autoincrement())
  userId     String
  taskText   String
  taskType   String    // 'strategic', 'operational'
  originDate DateTime
  isClosed   Boolean   @default(false)
  closedAt   DateTime?
  createdAt  DateTime  @default(now())
}

// ==================== ПРОФИЛЬ ====================

model UserProfile {
  id              Int      @id @default(autoincrement())
  userId          String   @unique
  name            String?
  occupation      String?
  industry        String?
  maritalStatus   String?
  hobbies         String?
  sports          String?
  location        String?
  age             Int?
  customInterests String?
  education       String?
  teamSize        Int?
  workExperience  String?
  values          String?
  challenges      String?
  other           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ProfileBlock {
  id         Int               @id @default(autoincrement())
  userId     String
  title      String
  order      Int               @default(0)
  categories ProfileCategory[]
  items      ProfileItem[]
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt
}

model ProfileCategory {
  id        Int           @id @default(autoincrement())
  blockId   Int
  title     String
  order     Int           @default(0)
  items     ProfileItem[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

model ProfileItem {
  id         Int     @id @default(autoincrement())
  blockId    Int?
  categoryId Int?
  fieldName  String
  fieldValue String
  content    String?
  order      Int     @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// ==================== ОЦЕНКИ ПЕРИОДОВ ====================

model PeriodEvaluation {
  id                  Int      @id @default(autoincrement())
  userId              String
  periodType          String
  periodStart         DateTime
  periodEnd           DateTime
  dreamProgressScore  Float
  overallScore        Float
  professionalBlock   String
  personalBlock       String
  socialBlock         String
  balanceBlock        String
  patterns            String
  trends              String
  goalsCompletion     String
  alignment           String
  blockers            String?
  feedbackText        String
  recommendationsText String
  insights            String?
  createdAt           DateTime @default(now())
}

// ==================== АНАЛИТИКА ====================

model UserInsights {
  id              Int      @id @default(autoincrement())
  userId          String   @unique
  patterns        String?
  strengths       String?
  challenges      String?
  preferences     String?
  recommendations String?
  motivators      String?
  weeklySummary   String?
  evaluationCount Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// Накопительный кэш знаний — каждая оценка добавляет наблюдения
model InsightEntry {
  id        Int      @id @default(autoincrement())
  userId    String
  date      String   // дата дня (YYYY-MM-DD)
  category  String   // pattern | strength | challenge | preference | motivator | observation
  text      String   // конкретное наблюдение
  score     Float?   // оценка дня
  createdAt DateTime @default(now())
}

model UserStats {
  id                    Int      @id @default(autoincrement())
  userId                String   @unique
  totalDays             Int      @default(0)
  totalPlanned          Int      @default(0)
  totalCompleted        Int      @default(0)
  avgCompletionPct      Float    @default(0)
  avgDailyScore         Float    @default(0)
  completionByDayJson   String   @default("{}")
  completionByTypeJson  String   @default("{}")
  frequentCompletedJson String   @default("[]")
  frequentFailedJson    String   @default("[]")
  habitsAvgCompletion   Float    @default(0)
  trendDirection        String?
  trendPct              Float    @default(0)
  bestDayOfWeek         String?
  worstDayOfWeek        String?
  optimalTaskCount      Int      @default(5)
  currentStreak         Int      @default(0)
  bestStreak            Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

// ==================== КОНТЕКСТ ====================

model WorldContext {
  id             Int      @id @default(autoincrement())
  userId         String
  date           DateTime
  marketEvents   String?
  personalEvents String?
  constraints    String?
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([userId, date])
}

// ==================== ЧАТ ====================

model ChatMessage {
  id        Int      @id @default(autoincrement())
  userId    String
  date      String
  role      String   // 'user', 'assistant'
  content   String
  metadataJson Json?  // encrypted, typed cards (daily_schedule_proposal v1/v2/v3; daily_task_list_proposal v1: tasks/currentPlanTaskCount/currentPlanTasksHash/scheduleIssue/appliedAt)
  createdAt DateTime @default(now())
}

// ==================== ВЫПОЛНЕННАЯ РАБОТА ====================

model CompletedWork {
  id          Int      @id @default(autoincrement())
  userId      String
  date        DateTime
  type        String   // task | goal | habit | extra
  text        String
  category    String?  // стратегические | операционные | привычки | созвоны
  goalLink    String?  // periodKey цели (например week:2026-03-W3)
  sourceType  String?  // dailyEntry | goal | habit
  sourceId    Int?
  createdAt   DateTime @default(now())
}

model WorkSummary {
  id                Int      @id @default(autoincrement())
  userId            String
  periodType        String   // week | month | quarter
  periodKey         String   // 2026-03-W3, 2026-03, 2026-Q1
  summaryText       String
  keyAchievements   String   @default("[]")
  tasksCompleted    Int      @default(0)
  goalsCompleted    Int      @default(0)
  topCategoriesJson String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([userId, periodType, periodKey])
}

// ==================== ПРОФИЛЬ ПЛАНИРОВАНИЯ ====================

model PlanningProfile {
  id               Int      @id @default(autoincrement())
  userId           String   @unique
  hoursPerWeek     Int?
  experienceLevel  String?   // none | beginner | intermediate | expert
  hasBudget        String?   // none | limited | available
  currentWorkload  String?   // fulltime | parttime | freelance | free
  constraints      String?
  declined         Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

// ==================== АУДИТ-ЛОГ ====================

model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     String?
  action     String   // login | logout | register | create | update | delete | password_change | lockout
  resource   String?
  resourceId String?
  details    String?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
}
```

**Важно:** Все модели (кроме Session/PasswordResetToken/ChatMessage) содержат `userId` и relation к `User` с `onDelete: Cascade`. Данные каждого пользователя изолированы.

### Индексы для производительности

Добавлены индексы на часто запрашиваемые поля:
- `Goal`: userId + periodType + periodKey, userId + completed
- `DailyEntry`: userId + date
- `Evaluation`: dreamProgressScore, createdAt
- `OpenTask`: userId + isClosed, userId + taskType + isClosed
- `Habit`: userId + isActive
- `PeriodGoal`: userId + periodType + periodStart
- `PeriodEvaluation`: userId + periodType + periodStart
- `Session`: userId, token
- `ChatMessage`: userId + date
- `CompletedWork`: userId + date, userId + type, userId + goalLink
- `AuditLog`: userId, action, createdAt

---

## 4. API ROUTES

### Основные endpoints

| Endpoint | Методы | Файл | Описание |
|----------|--------|------|----------|
| `/api/daily` | GET, POST | `app/api/daily/route.ts` | CRUD дневных записей |
| `/api/daily/schedule` | GET, PUT | `app/api/daily/schedule/route.ts` | Временное расписание задач дня; `DailyScheduleSchema` поддерживает backward-compatible v1/v2 и v3 (`planningBasis`, `planningStartMinutes`, `workEndMinutes`, `activityEndMinutes`, `category`, `isFixed`); ответ содержит `hash` и server-computed `loadSummary` |
| `/api/daily/schedule/apply-proposal` | POST | `app/api/daily/schedule/apply-proposal/route.ts` | Подтверждает AI-proposal из `ChatMessage.metadataJson`, проверяет ownership/date/current hash и для proposal v3 `currentPlanTasksHash`; атомарно применяет v1→schedule v2, v2→schedule v3 или v3 с добавлением `newTasks` в конец `DailyEntry.planText`, отклоняет текстовые дубли новых задач и возвращает persisted schedule/hash/loadSummary плюс актуальный `planTasks` |
| `/api/daily/task-list/apply-proposal` | POST | `app/api/daily/task-list/apply-proposal/route.ts` | Подтверждает `daily_task_list_proposal` из `ChatMessage.metadataJson`, проверяет ownership/date/`expectedCurrentPlanTasksHash`, под `SELECT ... FOR UPDATE` дописывает `tasks` в конец `DailyEntry.planText`, отклоняет текстовые дубли и не мутирует `DailySchedule`; возвращает актуальные `planText`, `planTasks`, `hash` |
| `/api/daily/chat` | POST | `app/api/daily/chat/route.ts` | Чат с AI о плане; body включает обязательный browser `timezone` (IANA-like), SSE `text/proposal/done/error`, Anthropic tool `propose_daily_schedule` продвигает proposal v3 (`newTasks`, `taskSource: existing/new`, `planningBasis`, `planningStartMinutes`, `workEndMinutes`, `activityEndMinutes`, `category`, `isFixed`, минутная сетка валидации; `loadSummary` не принимается от AI и вычисляется сервером), а parser route нормализует дробные `startMinutes/durationMinutes` блоков к ближайшей минуте и backward-compatible принимает v2/v3; metadata v3 дополняется `currentPlanTaskCount=planTasks.length` и `currentPlanTasksHash=hashDailyPlanTasks(planTasks)` для корректного ремапа `newTasks` даже когда proposal содержит только новые задачи; при невалидном tool proposal route логирует конкретные diagnostics (bounds/overlap/field issues/zod codes без полных task text) и делает один corrective tool-use раунд через `tool_result`; если расписание повторно не прошло проверку, но `newTasks` структурно валидны, route сохраняет отдельную карточку `daily_task_list_proposal` с `tasks`, `currentPlanTaskCount`, `currentPlanTasksHash`, `scheduleIssue` (`status='schedule_rejected'`, человекочитаемый `reason`, safe diagnostics, `nextAction=null` под будущий выбор «размещаем с текущего/игнорируем/правим») и отправляет человеческий текст вместо fallback; скрытый kickoff marker `[SYSTEM_KICKOFF_PLAN_CHAT]` заменяется на серверную инструкцию режима A/B/C по данным request и не сохраняется как user-message; в system data block передаётся machine-readable контекст актуального persisted schedule (v1/v2/v3 blocks, range/planning, timezone, updatedAt/hash) и latest pending schedule proposal для обсуждения/коррекции; proposal обязан вернуть тот же timezone и хранится в зашифрованном `ChatMessage.metadataJson`; применение schedule proposal выполняется только явным `/api/daily/schedule/apply-proposal`, применение task-list proposal — `/api/daily/task-list/apply-proposal` с конкретным `messageId` |
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
| `/api/goals/decompose` | POST | `app/api/goals/decompose/route.ts` | ИИ-чат целей: sanitize + Claude stream |
| `/api/habits` | GET, POST, PUT, DELETE | `app/api/habits/route.ts` | Привычки |
| `/api/habits/suggestions` | GET | `app/api/habits/suggestions/route.ts` | AI suggestions |
| `/api/tasks/open` | GET | `app/api/tasks/open/route.ts` | Открытые задачи |
| `/api/tasks/[id]/close` | POST | `app/api/tasks/[id]/close/route.ts` | Закрыть задачу |
| `/api/tasks/[id]/reopen` | POST | `app/api/tasks/[id]/reopen/route.ts` | Переоткрыть задачу |
| `/api/tasks/[id]/delete` | DELETE | `app/api/tasks/[id]/delete/route.ts` | Удалить задачу |
| `/api/tasks/add-suggested` | POST | `app/api/tasks/add-suggested/route.ts` | Добавить предложенную ИИ задачу |
| `/api/tasks/process-uncompleted` | POST | `app/api/tasks/process-uncompleted/route.ts` | Обработка невыполненных задач |
| `/api/tasks/closed` | GET | `app/api/tasks/closed/route.ts` | Закрытые задачи |
| `/api/profile` | GET, POST | `app/api/profile/route.ts` | Профиль |
| `/api/profile/blocks` | GET, POST, DELETE, PATCH | `app/api/profile/blocks/route.ts` | Блоки профиля |
| `/api/profile/categories` | GET, POST, DELETE, PATCH | `app/api/profile/categories/route.ts` | Категории блоков |
| `/api/profile/items` | POST, DELETE, PATCH | `app/api/profile/items/route.ts` | Элементы профиля |
| `/api/profile/insights` | GET, PUT | `app/api/profile/insights/route.ts` | AI insights |
| `/api/profile/theme` | GET, POST | `app/api/profile/theme/route.ts` | Тема оформления |
| `/api/analytics/trend` | GET | `app/api/analytics/trend/route.ts` | Тренды |
| `/api/analytics/ai-usage` | GET | `app/api/analytics/ai-usage/route.ts` | Статистика использования ИИ |
| `/api/progress` | GET | `app/api/progress/route.ts` | Статистика прогресса |
| `/api/facts` | GET | `app/api/facts/route.ts` | Выполненная работа (CompletedWork) |
| `/api/facts/summary` | GET | `app/api/facts/summary/route.ts` | Сводка по периодам (WorkSummary) |
| `/api/goals/planning-profile` | GET, POST | `app/api/goals/planning-profile/route.ts` | Профиль планирования |
| `/api/periods` | GET | `app/api/periods/route.ts` | Список оценок периодов |
| `/api/periods/[id]` | GET | `app/api/periods/[id]/route.ts` | Детали оценки периода |
| `/api/evaluate/batch` | GET, POST | `app/api/evaluate/batch/route.ts` | Массовая оценка пропущенных дней |
| `/api/chat` | GET, POST, DELETE | `app/api/chat/route.ts` | Общий чат с ИИ |
| `/api/daily/chat/messages` | GET, POST, DELETE | `app/api/daily/chat/messages/route.ts` | CRUD сообщений чата дня |
| `/api/health` | GET | `app/api/health/route.ts` | Health check (без авторизации) |

Daily schedule/task-list concurrency: manual `PUT /api/daily/schedule`, schedule proposal apply and task-list proposal apply all run inside a DB transaction and acquire `SELECT ... FOR UPDATE` on the stable parent `DailyEntry` row before mutating schedule or plan text. This serializes mutations for one user/date even when the `DailySchedule` row does not exist yet; schedule proposal apply re-reads the schedule under the lock and keeps `expectedCurrentScheduleHash` conflict semantics, task-list proposal apply keeps `expectedCurrentPlanTasksHash`/`currentPlanTasksHash` conflict semantics and never writes `DailySchedule`.

DailySchedule v3 keeps legacy `dayStartMinutes/dayEndMinutes` aligned to the active planning interval (`dayStartMinutes === planningStartMinutes`, `dayEndMinutes === activityEndMinutes`). All planning and block times are minute-aligned (`lib/daily-schedule-time.ts`, `DAILY_SCHEDULE_TIME_STEP_MINUTES = 1`) and must satisfy `planningStartMinutes < workEndMinutes <= activityEndMinutes`; minimum block duration remains 15 minutes. Server code computes `loadSummary` from the persisted schedule only: active denominator is `planningStartMinutes..activityEndMinutes`, work denominator is `planningStartMinutes..workEndMinutes`, category minutes do not overlap because schedule validation rejects overlapping blocks. Proposal metadata schemaVersion 3 stores `currentPlanTaskCount` for deterministic conversion of `taskSource='new'` block indexes; old v3 metadata without the count falls back to inferring the minimum from existing task blocks. Proposal metadata schemaVersion 2 stores the server-computed summary; metadata v1 remains readable/applicable.

Daily schedule proposal normalization is intentionally stronger than prompt validation: for proposal v3 the server sets `dayStartMinutes=planningStartMinutes` and `dayEndMinutes=activityEndMinutes`, rewrites task block text from the source of truth (`planTasks` for existing tasks during current-plan validation, `newTasks` for new tasks), treats fixed blocks as preferred anchors but moves them if they overlap or leave the day window, then packs all remaining blocks into free intervals. Flexible blocks that do not fit and unrecognized block-array items are removed from `blocks` and exposed through normalization metadata; `/api/daily/chat` adds human SSE `text` notes for tasks left in «Не распределено» and fixed blocks that had to be moved. The normalizer has no silent fallback to model arithmetic: if the day window is missing/invalid it defaults to a valid full-day window, then runs a final repair pass so the produced schedule blocks are non-overlapping and inside `0..1440`/day range before `DailyScheduleSchema` is used as the last guard.

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

### useGoals.ts (~550 строк)

**Назначение:** Управление целями всех уровней

**State:**
```typescript
const [dreamGoal, setDreamGoal] = useState<DreamGoal | null>(null)
const [yearGoals, setYearGoals] = useState<Map<number, string[]>>(new Map())
const [periodGoals, setPeriodGoals] = useState<Map<string, string[]>>(new Map())
const [goals, setGoals] = useState<Goal[]>([])  // Tracked goals (с parentId для иерархии)
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
- `createTrackedGoal(periodKey, text, priority?, tags?, parentId?)` — создание tracked goal (экспортирован для использования в page.tsx)
- `setGoalCompleted()` — завершение цели + автозавершение родителя при 100% дочерних
- `updateGoal()` — обновление цели
- `deleteGoal()` — удаление цели
- `moveGoal()` — перемещение цели

**Автозавершение иерархии:**
При выполнении цели проверяются все siblings с тем же `parentId`. Если все выполнены — родитель автоматически отмечается как выполненный с toast-уведомлением.

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

### lib/anthropic.ts (~730 строк)

**Назначение:** Интеграция с Claude API

**Структура:**
```typescript
// Lazy initialization клиента
let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic { ... }

// Двухуровневая конфигурация модели (см. раздел "Двухуровневая конфигурация модели" ниже)
export type AiModelTier = 'smart' | 'fast'
export function getAiModel(tier: AiModelTier = 'smart'): string
export function getSmartModel(): string
export function getFastModel(): string

// Retry logic
async function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>

// Основные функции
export async function evaluateDay(request: DailyEvaluationRequest): Promise<DailyEvaluationResponse>
export async function evaluatePeriod(request: PeriodEvaluationRequest): Promise<PeriodEvaluationResponse>
export async function generateForecast(request: ForecastRequest): Promise<ForecastResponse>
export async function updateUserInsights(request: UpdateInsightsRequest): Promise<UpdateInsightsResponse>
// UpdateInsightsResponse = { profile: UserInsightsUpdate, entries: InsightEntryData[] }
// Промпт и построение текста запроса для updateUserInsights — в lib/prompts/insights.ts
```

### Двухуровневая конфигурация модели

Задачи разной сложности используют разные уровни модели Claude:

| Уровень | Env-переменная | Fallback-цепочка | Задачи |
|---|---|---|---|
| **SMART** (сложные) | `AI_MODEL_SMART` | `AI_MODEL_SMART` → `AI_MODEL` → `'claude-sonnet-4-6'` | декомпозиция целей (`POST /api/goals/decompose`, оба вызова: генерация + валидация плана), оценка периода (`evaluatePeriodWithUsage`), прогноз (`generateForecastWithUsage`) |
| **FAST** (простые/частые) | `AI_MODEL_FAST` | `AI_MODEL_FAST` → `AI_MODEL` → `'claude-haiku-4-5'` | оценка дня (`evaluateDayNewWithUsage`), чат о плане (`POST /api/daily/chat`), проверка плана (`POST /api/daily/check-plan`), обновление профиля понимания (`updateUserInsights`) |

Обратная совместимость: если задан только `AI_MODEL` (без `AI_MODEL_SMART`/`AI_MODEL_FAST`) — оба уровня используют это значение, поведение не меняется относительно предыдущей однодуровневой схемы.

```typescript
getAiModel('smart')  // AI_MODEL_SMART → AI_MODEL → 'claude-sonnet-4-6'
getAiModel('fast')   // AI_MODEL_FAST  → AI_MODEL → 'claude-haiku-4-5'
getAiModel()         // tier по умолчанию — 'smart'
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
// Fixed window algorithm
export function checkRateLimit(identifier: string, options: RateLimitOptions): RateLimitResult
export function getClientIdentifier(request: Request): string

// Предустановленные лимиты
export const rateLimiters = {
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },           // 5 попыток входа за 15 минут
  authRecovery: { limit: 3, windowMs: 15 * 60 * 1000 },   // 3 сброса пароля за 15 минут
  authRegistration: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 регистрации в час
  ai: { limit: 10, windowMs: 60 * 1000 },                  // 10 AI запросов в минуту
}

// Блокировка аккаунта
const MAX_FAILED_LOGINS = 10     // 10 неудачных попыток → блокировка
const LOCKOUT_DURATION_MS = 30 * 60 * 1000  // на 30 минут
```

### lib/hmac.ts

**Назначение:** HMAC-SHA256 подпись и верификация токенов (Edge Runtime compatible)

```typescript
export async function signToken(token: string, secret: string): Promise<string>
  // HMAC-SHA256 → hex строка подписи
export async function verifyToken(token: string, expectedSig: string, secret: string): Promise<boolean>
  // Constant-time comparison для защиты от timing attacks

// Используется в middleware.ts для проверки auth_token без обращения к БД
// Полная валидация сессии (экспирация) — в API routes через requireUserId
```

### lib/encryption.ts + lib/prisma-encryption.ts

**Назначение:** Шифрование данных at rest (SSE — Server-Side Encryption)

```typescript
// lib/encryption.ts
export function encrypt(plaintext: string): string       // AES-256-GCM → "enc_v1:iv:tag:data"
export function decrypt(ciphertext: string): string       // автоматически детектит enc_v1: префикс
export function isEncrypted(value: string): boolean

// lib/prisma-encryption.ts — Prisma middleware
// Автоматически шифрует write-операции и дешифрует read-операции
// ~100 текстовых полей в 19 моделях (DailyEntry, Evaluation, Goal, UserProfile, ...)
// Env: ENCRYPTION_KEY (64 hex chars, 32 bytes)
// Скрипт миграции: scripts/encrypt-existing-data.ts
```

### lib/audit.ts + lib/prisma-audit.ts

**Назначение:** Аудит-логирование всех операций

```typescript
// lib/audit.ts — ручной аудит-лог
export function audit(options: AuditOptions): void  // fire-and-forget, не блокирует основной flow
export function getAuditContext(request: Request): { ipAddress, userAgent }
// Вызывается для auth events (login, logout, register, lockout, password_change)

// lib/prisma-audit.ts — Prisma middleware
// Автоматически логирует все create/update/delete операции на 19 моделях
// Использует userId из AsyncLocalStorage контекста
```

### lib/completed-work.ts

**Назначение:** Синхронизация CompletedWork из DailyEntry

```typescript
export async function syncCompletedWork(userId: string, date: Date, entry: DailyEntry): Promise<void>
// Авто-создаёт записи CompletedWork из selectedTasksJson и extraTasksJson
// Категоризирует: стратегические / операционные / привычки
// Связывает с целями через goalLink
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
| `core.ts` | Базовые константы, fallback-ответы (NO_DREAM_RESPONSE, getNoGoalsResponse) с английскими значениями флагов |
| `types.ts` | Типы для промптов; BalanceFlags с значениями `'ok' \| 'warning' \| 'critical'` |
| `daily.ts` | `DAILY_EVALUATION_SYSTEM_PROMPT` (13 инструкций, КАЛИБРОВОЧНЫЕ ПРИМЕРЫ: 3 эталонных дня), `buildUserDataPrompt()`, `validateGoals()` |
| `check-plan.ts` | `CHECK_PLAN_SYSTEM_PROMPT`, `buildCheckPlanPrompt()` |
| `plan-chat.ts` | `PLAN_CHAT_SYSTEM_PROMPT`, `buildPlanChatContext()`, kickoff helpers для `[SYSTEM_KICKOFF_PLAN_CHAT]`, v2/v3 parser helper для tool result |
| `forecast.ts` | `buildForecastPrompt()`, `calculateExecutionQuality()` (расчёт на сервере), `mergeExecutionQuality()` (мерж результатов) |
| `period.ts` | `buildPeriodEvaluationPrompt()`, `calculatePeriodAverages()` (средние показатели рассчитываются на сервере) |
| `goals-decompose.ts` | `buildGoalsDecomposePrompt(context, planningProfile?, userProfile?, profileBlocks?)` — промпт декомпозиции целей с персонализацией по профилю и ограничением контекста |
| `insights.ts` | `buildUpdateInsightsPrompt(request)`, типы `UpdateInsightsRequest/UpdateInsightsResponse`, промпт и подстановка плейсхолдеров для обновления профиля понимания пользователя |

---

## 7. КОМПОНЕНТЫ

### Список компонентов (16 основных + 8 для целей)

**Основные:**
- `AppShell`
- `AuthGuard`
- `AuthProvider`
- `DatePickerWithIndicators`
- `DreamProgress`
- `ExpandableInput`
- `InstallAppButton`
- `Landing`
- `LayoutFooter`
- `Navigation`
- `ProgressIndicator`
- `Providers`
- `ServiceWorkerRegistration`
- `Speedometer`
- `ThemeProvider`
- `UncompletedTasksModal`

**Компоненты целей (goals/):**
- `goals/DreamBar`
- `goals/GoalsChatPanel`
- `goals/GoalsChatTrigger`
- `goals/MonthSection`
- `goals/MonthTimeline`
- `goals/PeriodView`
- `goals/StrategyCards`
- `goals/WeekCard`

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

### Прямой Anthropic SDK client

Production на Contabo вызывает официальный Anthropic API напрямую:

```
Contabo production → api.anthropic.com
```

- **Клиент:** `lib/anthropic.ts`, lazy singleton `getAnthropicClient()`.
- **SDK config:** `apiKey`, `maxRetries: 2`, `timeout: 5 минут`; `baseURL` и proxy headers не задаются.
- **Env-переменные:** `ANTHROPIC_API_KEY` обязателен; `AI_MODEL`, `AI_MODEL_SMART`, `AI_MODEL_FAST` управляют моделями.
- **Retries:** доменный wrapper сохраняет retry с exponential backoff на 429/5xx/network errors и Telegram-уведомление при финальном падении.

Cloudflare/Wrangler/Workers не являются частью текущей AI/deploy-архитектуры и не передаются в runtime-контейнер. `cloudflare-proxy/` и `cloudflare-tg-proxy/` сохранены как отключённый fallback: `WORKER_ENABLED = "false"`, ранний fail-closed 503 до обработки секретов, rate limit или upstream.

### Потоки взаимодействия с AI

Каждый вызов использует модель нужного уровня через `getAiModel('smart' | 'fast')`
(см. "Двухуровневая конфигурация модели" выше) — уровень указан в скобках у каждого шага.

```
1. Оценка дня (POST /api/evaluate) — модель: FAST
   ├── Собираем: мечту, годовые цели, периодические цели, план, факт, контекст
   ├── Формируем промпт (buildUserDataPrompt) с КАЛИБРОВОЧНЫМИ ПРИМЕРАМИ для стабильности
   ├── Вызываем Claude через getAnthropicClient(), getAiModel('fast')
   ├── Парсим JSON ответ
   ├── Валидируем структуру (значение overall_score от модели игнорируется)
   ├── Рассчитываем overall_score СЕРВЕРОМ (среднее 5 показателей, calculateOverallScore)
   ├── Сохраняем в Evaluation
   ├── Загружаем кэш знаний (InsightEntry, до 100 записей)
   ├── Обновляем UserInsights (профиль понимания) — модель: FAST
   │  └── Используется промпт из lib/prompts/insights.ts (buildUpdateInsightsPrompt)
   └── Сохраняем новые наблюдения в InsightEntry (2-5 фактов за день)

2. Проверка плана (POST /api/daily/check-plan) — модель: FAST
   ├── Собираем: цели периодов, текущий план, историю
   ├── Формируем промпт (buildCheckPlanPrompt)
   ├── Вызываем Claude через getAnthropicClient(), getAiModel('fast')
   ├── Парсим JSON ответ
   └── Возвращаем рекомендации

3. Чат о плане (POST /api/daily/chat) — модель: FAST
   ├── Собираем: цели, план, insights, кэш знаний (до 50 наблюдений), история сообщений
   ├── Формируем промпт (buildPlanChatContext)
   ├── Вызываем Claude через getAnthropicClient(), getAiModel('fast')
   └── Возвращаем ответ

4. Декомпозиция целей (POST /api/goals/decompose) — модель: SMART (генерация и валидация плана)
  ├── Собираем: мечту, goals map, историю чата, PlanningProfile, UserProfile, ProfileBlocks
  ├── Санитизируем длинные поля (dream/message/goals/history), чтобы не падать на уже сохранённом контексте
  ├── Формируем промпт (buildGoalsDecomposePrompt) с усечением длинных profile fields и списков целей
  ├── Вызываем Claude через getAnthropicClient(), getAiModel('smart') в streaming-режиме
  └── Возвращаем текстовый ответ; клиент сам извлекает цели, профиль и горизонт

5. Прогноз (GET /api/forecast) — модель: SMART
    ├── Собираем: мечту, историю оценок, текущий темп
    ├── Формируем промпт (buildForecastPrompt)
    ├── Вызываем Claude через getAnthropicClient(), getAiModel('smart')
    ├── Парсим JSON (от модели берём только массив patterns, executionQuality числовые поля рассчитываются сервером)
    ├── Рассчитываем executionQuality через calculateExecutionQuality и мержим через mergeExecutionQuality
    └── Возвращаем прогноз с финальными quality-метриками

6. Оценка периода (evaluatePeriodWithUsage, используется отчётами по неделе/месяцу/кварталу/году) — модель: SMART
    ├── Рассчитываем средние показатели по дневным оценкам (calculatePeriodAverages)
    ├── Формируем промпт (buildPeriodEvaluationPrompt) с готовыми средними значениями
    ├── Вызываем Claude через getAnthropicClient(), getAiModel('smart') (модель анализирует текст, не расчёты)
    └── dreamProgressScore/overallScore пересчитываются в коде как средние по дням периода
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
    health: 'ok' | 'warning' | 'critical'
    family: 'ok' | 'warning' | 'critical'
    energy: 'ok' | 'warning' | 'critical'
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
middleware.ts                 # Server-side защита роутов (Edge Runtime)
├── Проверяет auth_token + auth_token_sig cookies
├── Верифицирует HMAC-SHA256 подпись токена (без обращения к БД)
├── Публичные пути: /login, /register, /forgot-password, /reset-password, /verify-email, /api/auth/*, /api/health
├── API: возвращает 401 без токена или при невалидной подписи
├── Страницы: редирект на /login
└── Невалидные cookies удаляются автоматически

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
1. `middleware.ts` — первая линия защиты (server, HMAC verification)
2. `AuthGuard` — вторая линия (client, для SPA-навигации)
3. `Navigation` — третья линия (обработка истечения сессии)
4. API routes — полная валидация сессии в БД (экспирация, активность пользователя)

### HMAC-подпись токенов

При логине сервер генерирует сессионный токен и подписывает его HMAC-SHA256:
- Cookie `auth_token` — сам токен (cuid)
- Cookie `auth_token_sig` — HMAC подпись
- `middleware.ts` верифицирует подпись через `crypto.subtle` (Edge Runtime)
- Не требует обращения к БД → быстрая проверка на каждый запрос
- Полная валидация (экспирация, isActive) — в API routes

### Шифрование данных at rest (SSE)

Все чувствительные текстовые поля шифруются AES-256-GCM через Prisma middleware:

- **Алгоритм:** AES-256-GCM (12-byte IV, 16-byte auth tag)
- **Формат:** `enc_v1:base64(iv):base64(tag):base64(ciphertext)`
- **Покрытие:** ~100 полей в 19 моделях (planText, factText, feedbackText, goalText, ...)
- **Прозрачность:** шифрование/дешифрование автоматическое через Prisma middleware
- **Ключ:** `ENCRYPTION_KEY` (64 hex chars, env variable)
- **Миграция:** `scripts/encrypt-existing-data.ts` (шифрует существующие данные)

### Rate Limiting и блокировка аккаунтов

- **Auth:** 5 попыток за 15 минут (login), 3 за 1 час (register)
- **AI endpoints:** 10 запросов в минуту
- **Блокировка:** 10 неудачных входов → lockout на 30 минут
- **IP extraction:** X-Real-IP (от reverse proxy), fallback X-Forwarded-For (последний IP)

### Аудит-логирование

- **Автоматический аудит** (Prisma middleware): все create/update/delete на 19 моделях
- **Ручной аудит** (`lib/audit.ts`): auth events (login, logout, register, lockout, password_change)
- **Fire-and-forget:** ошибки логирования не блокируют основной flow
- **Данные:** userId, action, resource, resourceId, IP, userAgent, timestamp

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
| **Модель Claude (по умолчанию)** | `lib/anthropic.ts` (`DEFAULT_AI_MODEL_SMART`, `DEFAULT_AI_MODEL_FAST`) |
| **Модель Claude (без пересборки)** | env `AI_MODEL_SMART` / `AI_MODEL_FAST` (или общий `AI_MODEL`) |
| **Уровень модели для конкретной AI-задачи** | вызов `getAiModel('smart' \| 'fast')` в соответствующей функции/route |
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

### Апрель 2026
- **Лендинг разложен на `components/landing/*`** — `Landing.tsx` стал тонким orchestrator-компонентом, секции и локальные анимации вынесены в отдельные файлы без изменения пользовательского поведения
- **Добавлены `app/opengraph-image.tsx` и `app/twitter-image.tsx`** — серверный preview для шаринга проекта
- **Стабилизирован `/api/goals/decompose`** — длинный сохранённый контекст теперь санитизируется перед валидацией/промптом, чтобы чат не падал с `400` на длинной мечте или уже сохранённых целях
- **`lib/prompts/goals-decompose.ts`** — добавлено усечение profile fields и ограничение объёма goals map в промпте
- **`useGoalsChat.ts`** — клиент теперь показывает текст ошибки API, а не только голый статус

### 11 апреля 2026 — Иерархическая система целей
- **`prisma/schema.prisma`** — Модель `Goal` расширена: добавлены `parentId Int?`, self-relation `GoalHierarchy` (parent/children), индекс `@@index([parentId])`. Миграция: `20260411_add_goal_parent_hierarchy`
- **`lib/types.ts`** — интерфейс `Goal` расширен полями `parentId: number | null` и `children?: Goal[]`
- **`app/api/goals/items/route.ts`** — POST принимает `parentId`, валидирует принадлежность родительской цели пользователю
- **Новый компонент `components/goals/HalfYearView.tsx`** — отображение целей полугодий H1/H2 с прогресс-барами, inline-редактированием, collapse прошедших периодов, sky-blue/rose цветовая схема
- **`app/goals/page.tsx`** — интеграция `HalfYearView` между StrategyCards и QuarterView, загрузка half_year данных, `handleAcceptGoals` стал async и создаёт tracked goals с `parentId` при иерархической нумерации
- **`lib/prompts/goals-decompose.ts`** — промпт переработан: декомпозиция СВЕРХУ ВНИЗ (Год → Полугодие → Квартал → Месяц → Неделя), иерархическая нумерация (1. → 1.1. → 1.1.1.), примеры в top-down порядке, правило 15 про иерархическую нумерацию
- **`hooks/useGoalsChat.ts`** — `ParsedGoal` расширен полем `hierarchyNumber`, парсер `extractGoals` распознаёт вложенную нумерацию `(\d+(\.\d+)*)`
- **`hooks/useGoals.ts`** — `createTrackedGoal` принимает `parentId`, экспортирован в интерфейс `UseGoalsReturn`; `setGoalCompleted` проверяет автозавершение родителя при 100% выполнении дочерних
- **`components/goals/WeekCard.tsx`** и **`MonthSection.tsx`** — визуальные связи: под текстом дочерней цели отображается «↑ Родительская цель» (10px, slate-500, truncate 35 символов)
- **`components/goals/GoalsChatPanel.tsx`** — тип `onAcceptGoals` обновлён на `void | Promise<void>`

### Март 2026
- **Добавлен `Landing.tsx`** — публичный лендинг для неавторизованных пользователей (тёмная тема, scroll-reveal анимации через IntersectionObserver, 3 шага, features grid, journey line)
- **Позже лендинг декомпозирован** на отдельные секции (`HeroSection`, `PainSection`, `DreamSection`, `DayFlowSection`, `EvaluationSection`, `ToolsSection`, `TrustSection`, `CtaSection`, `FooterSection`) без изменения внешнего UX
- **Добавлен `LayoutFooter.tsx`** — футер приложения с условным рендерингом (скрывается на landing, auth, onboarding)
- **`Navigation.tsx`** — `<header>` перенесён внутрь компонента, скрывается на landing/auth/onboarding
- **`app/layout.tsx`** — реструктуризация: OG meta-теги, `overflow-x-hidden`, убраны обёртки header/footer
- **`app/onboarding/page.tsx`** — полный рерайт: 5 слайдов с тёмной темой, PyramidVisual, RhythmVisual, AiVisual, StartVisual
- **`app/globals.css`** — compound selector `.landing-visible.landing-reveal`, `prefers-reduced-motion`, shared `.onb-gradient-text`

### Январь 2026
- Добавлен `lib/rate-limit.ts` — Rate limiting для AI endpoints
- Добавлен `lib/user-stats.ts` — накопительная статистика пользователя
- Добавлена модель `UserStats` — хранение статистики в БД
- Добавлена модель `WorldContext` — внешние события и контекст
- Добавлен `ProgressIndicator.tsx` — индикатор прогресса на Dashboard
- Добавлен `ThemeToggle.tsx` — переключатель темы
- `useDaily.ts` расширен до ~1100 строк
- Обновлена документация

### 15 марта 2026 — Rolling Wave визуализация + исправление багов
- **Новые компоненты:** `HorizonsCard.tsx` (визуализация 3 горизонтов планирования), `QuarterView.tsx` (квартальные цели 2x2 grid)
- **Редизайн:** `StrategyCards.tsx` (увеличенные карточки с прогресс-барами), `MonthTimeline.tsx` (pill-превью задач), `DreamBar.tsx` (3 состояния: collapsed/expanded/editing)
- **Чекбоксы:** добавлены в `MonthSection.tsx` для целей месяца (как в WeekCard)
- **Fix: Period API upsert** — `POST /api/goals/period` теперь `findFirst+update || create` вместо `create` (предотвращает дубликаты)
- **Fix: Единый алгоритм недель** — `getPeriodKey` в `lib/goals-utils.ts` синхронизирован с `useGoals.ts` (добавлена поддержка `half_year`)
- **Fix: Стабильность годов** — расчёт лет привязан к `dreamGoal.createdAt` вместо `currentYear`
- **Дизайн:** тёмная тема для HorizonsCard, blue-400 точки, responsive grid, увеличенные шрифты

### Декабрь 2025
- Добавлен `lib/api-utils.ts` — безопасность и утилиты
- Добавлен `lib/task-match.ts` — определение похожих задач
- Добавлен retry logic с exponential backoff в `lib/anthropic.ts`
- Добавлены индексы БД для производительности
- Исправлены unsafe `JSON.parse()` на `safeParseJson()`
- Исправлена уязвимость prompt injection

---

*Последнее обновление: 11 апреля 2026*
