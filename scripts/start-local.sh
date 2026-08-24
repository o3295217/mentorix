#!/bin/bash

# AI Effectiveness Assistant - Local Development Startup
# Поднимает postgres в Docker, синхронизирует схему БД и запускает dev-сервер.
# Вызывается напрямую или через "Start AI Assistant.command" (двойной клик).

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

# Генерация Prisma клиента и синхронизация схемы.
# Локальная БД управляется через db push (в _prisma_migrations пусто),
# поэтому migrate deploy здесь не используется — он упал бы на существующих таблицах.
echo -e "${YELLOW}Генерация Prisma клиента...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma клиент сгенерирован${NC}"

echo -e "${YELLOW}Синхронизация схемы базы данных...${NC}"
npx prisma db push
echo -e "${GREEN}✓ База данных готова${NC}"

# Удаление файла блокировки dev-сервера от прошлых запусков
rm -f ".next/dev/lock"

# Проверка порта: не подбираем соседний, а честно разбираемся с занятым.
# Смотрим только на слушающий процесс — клиентские соединения (браузер) не трогаем.
port_listener_pids() {
    lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null || true
}

echo ""
echo -e "${YELLOW}Проверка порта ${PORT}...${NC}"
PORT_PIDS="$(port_listener_pids)"
if [ -n "$PORT_PIDS" ]; then
    echo -e "${YELLOW}Порт ${PORT} занят следующим процессом:${NC}"
    lsof -nP -iTCP:${PORT} -sTCP:LISTEN || true
    echo ""
    if [ ! -t 0 ]; then
        echo -e "${RED}Порт занят, а запуск неинтерактивный — отменяю. Освободите порт ${PORT} и повторите.${NC}"
        exit 1
    fi
    echo "Скорее всего это уже запущенный dev-сервер этого же проекта."
    read -r -p "Остановить его и продолжить запуск? [y/N]: " REPLY
    if [[ "$REPLY" == "y" || "$REPLY" == "Y" ]]; then
        kill $PORT_PIDS 2>/dev/null || true
        # Даём процессу до 15 секунд на штатное завершение
        for _ in $(seq 1 15); do
            if [ -z "$(port_listener_pids)" ]; then
                break
            fi
            sleep 1
        done
        if [ -n "$(port_listener_pids)" ]; then
            echo -e "${RED}Не удалось освободить порт ${PORT}. Остановите процесс вручную и повторите.${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ Порт ${PORT} освобождён${NC}"
    else
        echo -e "${RED}Порт занят — запуск отменён (приложение привязано к ${PORT} через NEXT_PUBLIC_APP_URL).${NC}"
        exit 1
    fi
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
