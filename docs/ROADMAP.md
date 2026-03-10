# ROADMAP: Задачи на будущее

> Актуальность: 16 февраля 2026

---

## 📌 Приоритеты

| Уровень | Описание |
|---------|----------|
| 🔴 Критично | Нужно для production |
| 🟡 Важно | Улучшит UX/DX значительно |
| 🟢 Желательно | Nice to have |
| 🔵 Идея | На обсуждение |

---

## 🔴 КРИТИЧНО (для production)

### База данных
- [x] **Миграция на PostgreSQL** ✅ Выполнено 28.01.2026
  - Файлы: `prisma/schema.prisma`, `docker-compose.local.yml`
  - PostgreSQL в Docker контейнере `ai-assistant-db`
  - Все данные успешно мигрированы из SQLite

### Безопасность
- [ ] **Rate limiting на AI endpoints** — защита от abuse
  - Файлы: `middleware.ts`, `lib/rate-limit.ts`
  - Есть базовый, нужно усилить

- [ ] **CSRF protection** — для form submissions
  
- [ ] **Input sanitization** — проверка всех входных данных

### Инфраструктура
- [x] **Health check endpoint** — для мониторинга (`/api/health`) ✅
- [x] **SSL сертификаты** — Let's Encrypt + nginx ✅
- [x] **VK Cloud деплой** — Production на assist.labaiion.ru ✅
- [x] **Systemd автозапуск** ✅
- [ ] **Proper logging** — структурированные логи (winston/pino)
- [ ] **Error tracking** — Sentry или аналог
- [ ] **CI/CD** — GitHub Actions для автодеплоя
- [ ] **Backup strategy** — автоматические бэкапы БД по cron

---

## 🟡 ВАЖНО

### Архитектура
- [ ] **Разбить `useDaily.ts` (1100+ строк)** на:
  - `useDailyPlan.ts` — план и задачи
  - `useDailyChat.ts` — чат с AI
  - `useDailyEvaluation.ts` — оценка
  - `useDailyHabits.ts` — привычки
  
- [ ] **Service layer** — вынести бизнес-логику из API routes
  - `lib/services/goals.service.ts`
  - `lib/services/daily.service.ts`
  - и т.д.

### Приватность данных
- [ ] **Экспорт данных пользователя** — JSON/ZIP с полным дампом
  - Страница: `/profile` → кнопка "Скачать мои данные"
  - API: `GET /api/profile/export`

- [ ] **Удаление аккаунта** — с cascade delete всех данных
  - API: `DELETE /api/auth/account`

- [ ] **E2E шифрование чатов** (будущее)
  - Шифровать контент сообщений ключом пользователя
  - Ключ = производная от пароля (PBKDF2)

### UX
- [ ] **Offline mode** — базовая работа без интернета
  - Service Worker для кэширования
  - IndexedDB для локальных данных

- [ ] **PWA** — установка на домашний экран
  - `manifest.json` уже есть?
  
- [ ] **Уведомления** — напоминания о планировании/оценке
  - Push notifications
  - Telegram bot?

---

## 🟢 ЖЕЛАТЕЛЬНО

### Фичи
- [ ] **Админ-панель** `/admin`
  - Список пользователей
  - Статистика использования AI
  - Управление доступом

- [ ] **Темы оформления** — помимо light/dark
  - Sepia, high contrast

- [ ] **Keyboard shortcuts** — для power users
  - `Cmd+Enter` — сохранить
  - `Cmd+K` — открыть чат
  
- [x] **Drag & drop для целей** — сортировка в Goals ✅ Реализовано. Перемещение задач между неделями

- [ ] **Markdown в заметках** — поддержка форматирования

### Интеграции
- [ ] **Google Calendar** — sync задач
- [ ] **Telegram** — отправка напоминаний
- [ ] **Notion** — экспорт/импорт

### Тестирование
- [ ] **Unit tests** — Jest для utils и services
- [ ] **Integration tests** — API routes
- [ ] **E2E tests** — Playwright для критичных flows

---

## 🔵 ИДЕИ

### AI
- [ ] **Голосовой ввод** — диктовка плана на день
- [ ] **AI на клиенте** — WebLLM для приватности
- [ ] **Персонализация AI** — обучение на истории пользователя

### Gamification
- [ ] **Achievements** — достижения за streaks
- [ ] **Leaderboard** — сравнение с друзьями (opt-in)

### Монетизация
- [ ] **Premium tier** — больше AI запросов
- [ ] **Self-hosted license** — для enterprise

---

## ✅ ВЫПОЛНЕНО

### Март 2026
- [x] **Редизайн страницы Цели (Goals UX)** — полная переработка UX
  - Аккордеоны заменены на tab-навигацию (TimelineNav: чипы годов + табы кварталов)
  - Недели компактифицированы в WeekStrip (бейджи W1-W5 с мини-прогрессом)
  - Мечта: line-clamp-2, прогресс-бар
  - Все компоненты плоские (без вложенности), вся функциональность сохранена
  - Файлы: TimelineNav.tsx (новый), DreamSection, YearSection, QuarterSection, MonthSection, page.tsx

### Февраль 2026
- [x] **Миграция на VK Cloud** — production-деплой на 212.233.76.195
- [x] **Домен + SSL** — assist.labaiion.ru, Let's Encrypt, nginx reverse proxy
- [x] **Email-верификация** — SMTP через Gmail, сброс пароля
- [x] **Открытая регистрация** — REGISTRATION_MODE=open с подтверждением email
- [x] **Исправление багов** — g.trim() в useGoals, SMTP переменные в Docker
- [x] **Systemd автозапуск** — контейнеры стартуют при загрузке сервера

### Январь 2026
- [x] Чаты перенесены в БД (было localStorage)
- [x] Dark mode на всех страницах
- [x] Чат персистится по датам
- [x] Имя пользователя в чате (вместо "Вы")
- [x] VS Code-like scrollbar для чата
- [x] UncompletedTasksModal — обработка невыполненных задач
- [x] Quick action buttons в пустом чате
- [x] Ребрендинг "ИИ" → "ION"
- [x] **Миграция на PostgreSQL** — полный перенос из SQLite (28.01.2026)
- [x] **AuthGuard компонент** — клиентская защита авторизации
- [x] **Middleware восстановлен** — серверная защита роутов
- [x] **ThemeToggle исправлен** — корректные иконки для режимов темы
- [x] **Docker локальный деплой** — контейнер на порту 3000

---

## 📝 ЗАМЕТКИ

### Технический долг
1. **Prisma migrations** — есть проблема с shadow DB, используем `db push`
2. **TypeScript strict** — не везде strict mode
3. **ESLint warnings** — накопились, нужен cleanup

### Зависимости для обновления
- Next.js 16.0.1 → проверить стабильность
- Prisma 5.22.0 → 7.3.0 (major update, осторожно)
- baseline-browser-mapping — outdated warning

### Для деплоя
- [x] Настроить production сервер (VK Cloud) ✅
- [x] SSL сертификаты (Let's Encrypt) ✅
- [ ] Настроить CI/CD (GitHub Actions)
- [ ] Docker image optimization
- [ ] Cron-бэкапы БД
