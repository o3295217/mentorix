# Руководство для разработчиков

## Стиль кода

### TypeScript
- Строгая типизация, избегать `any`
- Интерфейсы для props и API responses
- Async/await вместо .then()

### React
- Функциональные компоненты + hooks
- `'use client'` только где нужен клиентский JS
- Компоненты в `components/`, страницы в `app/`

### Именование
- Компоненты: `PascalCase.tsx`
- Утилиты: `kebab-case.ts`
- API routes: `route.ts` в папке с именем endpoint
- Переменные/функции: `camelCase`
- Константы: `UPPER_SNAKE_CASE`

### CSS
- Tailwind CSS классы
- Темная тема через `dark:` префикс
- Кастомные классы в `app/globals.css`

---

## Git Workflow

### Ветки
```
main        — продакшен, всегда рабочий
develop     — текущая разработка
feature/*   — новые фичи (feature/add-calendar)
fix/*       — баг-фиксы (fix/login-error)
```

### Коммиты
Формат: `тип: краткое описание`

```
feat: добавлена страница истории с календарём
fix: исправлена ошибка 401 при сохранении плана
refactor: переход с SQLite на PostgreSQL
docs: обновлена документация API
style: форматирование кода
```

### Перед коммитом
```bash
# Проверить что работает
npm run dev

# Проверить типы
npx tsc --noEmit

# Обновить CHANGELOG.md
```

---

## Структура проекта

```
app/
├── api/          # Backend API (Next.js Route Handlers)
├── (auth)/       # Страницы авторизации
├── onboarding/   # Онбординг (5 слайдов, тёмная тема)
├── daily/        # Ежедневное планирование
├── goals/        # Цели
├── history/      # История
└── ...

components/       # React компоненты
hooks/            # Custom React hooks
lib/              # Утилиты, типы, Prisma client
prisma/           # Схема БД и миграции
docs/             # Документация
scripts/          # Служебные скрипты
```

### Ключевые компоненты

| Компонент | Назначение |
|-----------|------------|
| `Landing.tsx` | Публичный лендинг для неавторизованных пользователей (тёмная тема, scroll-анимации, 3 шага) |
| `LayoutFooter.tsx` | Футер приложения, скрывается на лендинге, auth-страницах и онбординге |
| `Navigation.tsx` | Навигация приложения, содержит `<header>`, скрывается на лендинге, auth-страницах и онбординге |
| `AuthGuard.tsx` | Клиентская защита роутов, редирект на /login |
| `AuthProvider.tsx` | Контекст аутентификации |

### Паттерн условного рендеринга

Navigation и LayoutFooter скрываются на определённых маршрутах:

```typescript
// Navigation.tsx — возвращает null для этих путей:
const HIDDEN_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding']
// + лендинг: pathname === '/' && !user

// LayoutFooter.tsx — аналогичная логика
```

### Layout-структура (app/layout.tsx)

```
<body>
  <Providers>
    <AuthGuard>
      <Navigation />       ← содержит <header>, скрывается на landing/auth/onboarding
      <main>{children}</main>
      <LayoutFooter />     ← скрывается на landing/auth/onboarding
    </AuthGuard>
  </Providers>
</body>
```

---

## База данных

### PostgreSQL (основная)
```bash
# Применить изменения схемы
npx prisma db push

# Сгенерировать Prisma Client
npx prisma generate

# Посмотреть данные
npx prisma studio
```

### Важно!
- Не использовать `prisma db push --accept-data-loss` без понимания последствий
- После миграции данных — сбросить sequences:
```sql
SELECT setval('table_id_seq', (SELECT MAX(id) FROM table) + 1, false);
```

---

## API Routes

### Паттерн
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/get-user-id'

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    
    // Всегда фильтровать по userId!
    const data = await prisma.someTable.findMany({
      where: { userId }
    })
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

### Безопасность
- **Всегда** использовать `requireUserId(request)` в начале
- **Всегда** фильтровать данные по `userId`
- Модель `Evaluation` связана через `dailyEntry`, не имеет прямого `userId`

---

## AI Integration

### Модели Claude
| Задача | Модель | Причина |
|--------|--------|---------|
| Оценка дня | claude-sonnet-4-5-20250929 | Качество анализа |
| Чат, проверка | claude-3-5-haiku-20241022 | Скорость, цена |

### Промпты
Все промпты в `lib/prompts/`:
- `core.ts` — базовый контекст
- `daily.ts` — оценка дня
- `forecast.ts` — прогнозы
- `period.ts` — периодические оценки

---

## Частые ошибки

### "Unknown argument userId" в Evaluation
Evaluation не имеет userId, используй:
```typescript
where: { dailyEntry: { userId } }
```

### "Unique constraint failed on id"
После миграции данных сбрось sequence:
```sql
SELECT setval('table_id_seq', (SELECT MAX(id) FROM table) + 1, false);
```

### Два проекта используют одну БД
Разные проекты должны использовать разные базы:
- `ai_assistant` — этот проект
- `ai_assistant_business` — другой проект

---

## Онбординг

Онбординг (`app/onboarding/page.tsx`) — 5 полноэкранных слайдов с тёмной темой и анимациями:

1. **Приветствие** — краткое описание ION
2. **Структура** — пирамида целей (от мечты до дня)
3. **Ежедневный ритм** — карточки: план → действие → разбор → рост
4. **ИИ-ассистент** — чат-бабблы с примером диалога
5. **Старт** — CTA для начала работы

Компоненты визуалов: `PyramidVisual`, `RhythmVisual`, `AiVisual`, `StartVisual` — все внутри файла.

## Лендинг

Лендинг (`components/Landing.tsx`) — публичная страница для неавторизованных пользователей:

- Тёмная тема (bg-gray-950), scroll-reveal анимации через IntersectionObserver
- Секции: Hero → Шаг первый (пирамида целей) → Шаг второй (ежедневный ритм) → Шаг третий (AI-анализ с mock-карточкой) → Features grid → Journey line → CTA
- CSS: `globals.css` — `.landing-visible.landing-reveal` (compound selector), `prefers-reduced-motion`
- OG meta-теги заданы в `app/layout.tsx`

---

## Контакты

При возникновении вопросов — смотри документацию в `docs/` или историю в `CHANGELOG.md`.
