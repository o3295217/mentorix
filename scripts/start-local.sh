#!/bin/bash

# AI Effectiveness Assistant - Local Development Startup
# Поднимает postgres в Docker и запускает dev-сервер на первом свободном
# порту начиная с 3003. Схему БД НЕ трогает — миграции применяются отдельно,
# в процессе разработки. Вызывается напрямую или через
# "Start AI Assistant.command" (двойной клик).

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Определить директорию проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

COMPOSE_FILE="docker-compose.local.yml"
# Явное имя compose-проекта — то же, что использует scripts/update-docker-local.sh
COMPOSE_PROJECT="$(basename "$PROJECT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI Effectiveness Assistant${NC}"
echo -e "${BLUE}  Local Development Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка Node.js и npm
echo -e "${YELLOW}Проверка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Ошибка: Node.js не установлен${NC}"
    echo "Установите с https://nodejs.org/ или: brew install node"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Ошибка: npm не установлен${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v), npm $(npm -v)${NC}"

# Проверка .env файла
echo -e "${YELLOW}Проверка конфигурации...${NC}"
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${RED}⚠ Создан .env.local из .env.example — заполните ANTHROPIC_API_KEY и прочие секреты${NC}"
    else
        echo -e "${RED}Ошибка: нет ни .env.local, ни .env, ни .env.example${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Файл окружения существует${NC}"
fi

ENV_FILE=""
if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ -n "$ENV_FILE" ] && grep -q "sk-ant-your-api-key-here" "$ENV_FILE" 2>/dev/null; then
    echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY не настроен в ${ENV_FILE} — AI-функции работать не будут${NC}"
fi

# Порт берём из NEXT_PUBLIC_APP_URL — единственного источника правды;
# 3003 остаётся запасным значением, если порт в URL не указан.
PORT="$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" 2>/dev/null | grep -oE 'localhost:[0-9]+' | head -1 | cut -d: -f2 || true)"
PORT="${PORT:-3003}"

# Запуск postgres в Docker
echo ""
echo -e "${YELLOW}Запуск базы данных...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Ошибка: docker не найден. Установите Docker Desktop.${NC}"
    exit 1
fi
if ! docker info &> /dev/null; then
    echo -e "${RED}Ошибка: Docker engine не запущен. Откройте Docker Desktop и повторите.${NC}"
    exit 1
fi

# Compose подставляет POSTGRES_PASSWORD только из .env; если пароль лежит
# в .env.local (свежая установка из .env.example) — передаём этот файл явно.
COMPOSE_ENV_FILE=".env"
if ! grep -q '^POSTGRES_PASSWORD=' .env 2>/dev/null; then
    if [ -n "$ENV_FILE" ] && grep -q '^POSTGRES_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
        COMPOSE_ENV_FILE="$ENV_FILE"
    else
        echo -e "${RED}Ошибка: POSTGRES_PASSWORD не задан ни в .env, ни в ${ENV_FILE:-.env.local}${NC}"
        echo "Добавьте строку POSTGRES_PASSWORD=... (см. .env.example) и повторите запуск."
        exit 1
    fi
fi

if ! docker compose -p "$COMPOSE_PROJECT" --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" \
        up -d --wait --wait-timeout 60 postgres; then
    echo -e "${RED}Ошибка: postgres не поднялся за 60 секунд${NC}"
    echo "Диагностика: docker compose -f ${COMPOSE_FILE} logs postgres"
    exit 1
fi
echo -e "${GREEN}✓ Postgres запущен и готов${NC}"

# Установка зависимостей
echo ""
echo -e "${YELLOW}Установка зависимостей...${NC}"
npm install
echo -e "${GREEN}✓ Зависимости установлены${NC}"

# Генерация Prisma клиента. Схему БД скрипт НЕ трогает: db push/миграции
# применяются в процессе разработки, лаунчер только запускает приложение.
echo -e "${YELLOW}Генерация Prisma клиента...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma клиент сгенерирован${NC}"

# Удаление файла блокировки dev-сервера от прошлых запусков
rm -f ".next/dev/lock"

# Подбор порта: начинаем с базового (из NEXT_PUBLIC_APP_URL, по умолчанию 3003)
# и идём вверх до первого свободного. Никаких вопросов и убийства процессов.
port_is_busy() {
    lsof -ti "tcp:${1}" -sTCP:LISTEN &>/dev/null
}

BASE_PORT="$PORT"
echo ""
echo -e "${YELLOW}Поиск свободного порта (с ${BASE_PORT})...${NC}"
FOUND=""
for OFFSET in $(seq 0 20); do
    CANDIDATE=$((BASE_PORT + OFFSET))
    if ! port_is_busy "$CANDIDATE"; then
        PORT="$CANDIDATE"
        FOUND=1
        break
    fi
done
if [ -z "$FOUND" ]; then
    echo -e "${RED}Не нашлось свободного порта в диапазоне ${BASE_PORT}–$((BASE_PORT + 20)).${NC}"
    exit 1
fi
if [ "$PORT" != "$BASE_PORT" ]; then
    echo -e "${YELLOW}⚠ Порт ${BASE_PORT} занят — запускаю на ${PORT}${NC}"
else
    echo -e "${GREEN}✓ Порт ${PORT} свободен${NC}"
fi

# Запуск сервера
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Запуск сервера разработки...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Приложение будет доступно по адресу:${NC}"
echo -e "${GREEN}  → http://localhost:${PORT}${NC}"
echo ""
echo -e "${YELLOW}Браузер откроется, когда сервер начнёт отвечать${NC}"
echo -e "${YELLOW}Нажмите Ctrl+C для остановки сервера${NC}"
echo ""

# Открыть браузер, когда сервер реально готов (а не по таймеру)
(
    for _ in $(seq 1 120); do
        if curl -s -o /dev/null "http://localhost:${PORT}"; then
            open "http://localhost:${PORT}"
            exit 0
        fi
        sleep 1
    done
) &

npm run dev -- -p ${PORT}
