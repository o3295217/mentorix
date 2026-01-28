# Changelog

Все заметные изменения в проекте документируются здесь.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/).

## [Unreleased]

### Added
- Страница истории `/history` с календарной сеткой (3/6/12 месяцев)
- Поиск по задачам в истории
- Модель `PasswordResetToken` для сброса пароля
- Модель `ChatMessage` для сохранения чата с ИИ
- Скрипт миграции SQLite → PostgreSQL (`scripts/migrate-sqlite-to-pg.js`)
- **Документация для разработчиков:**
  - `CONTRIBUTING.md` — код-стайл, git workflow
  - `docs/DEVELOPMENT.md` — локальный setup, команды, отладка
  - Обновлён `.env.example` с PostgreSQL и всеми переменными
- **Git hooks (husky):**
  - Pre-commit проверка обновления CHANGELOG.md
  - Напоминания об обновлении документации при изменении кода

### Changed
- Переход с SQLite на PostgreSQL как основную БД
- API `/api/daily` теперь возвращает все записи если нет параметров from/to
- Схема `Evaluation` — связь через `dailyEntry` вместо прямого `userId`

### Fixed
- Обработка 401 в `useDaily.ts` с редиректом на login
- Запрос оценок в `/api/progress` через `dailyEntry.userId`
- Убран несуществующий `userId` из `Evaluation.create` в evaluate routes
- Сброс PostgreSQL sequences после миграции данных

### Security
- Проверена изоляция данных пользователей (все запросы фильтруются по userId из сессии)

---

## [0.1.0] - 2025-11-21

### Added
- Первоначальная версия AI Assistant
- Ежедневное планирование с оценкой ИИ
- Система целей (мечта → год → полугодие → квартал → месяц → неделя)
- Аутентификация с сессиями
- Темная тема
