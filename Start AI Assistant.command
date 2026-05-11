#!/bin/bash

# AI Effectiveness Assistant - Local Development Startup
# Двойной клик для запуска на macOS

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Определить директорию проекта (где лежит этот файл)
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

clear
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI Effectiveness Assistant${NC}"
echo -e "${BLUE}  Local Development Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Проверка Node.js
echo -e "${YELLOW}Проверка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Ошибка: Node.js не установлен${NC}"
    echo ""
    echo "Установите Node.js одним из способов:"
    echo "  1. Скачайте с https://nodejs.org/"
    echo "  2. Через Homebrew: brew install node"
    echo ""
    echo "Нажмите любую клавишу для выхода..."
    read -n 1
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Ошибка: npm не установлен${NC}"
    read -n 1
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"

# Проверка .env файла
echo -e "${YELLOW}Проверка конфигурации...${NC}"
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo -e "${YELLOW}Создание .env.local из .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${RED}⚠ ВАЖНО: Отредактируйте .env.local и добавьте ANTHROPIC_API_KEY${NC}"
        echo ""
        echo "Откройте файл .env.local и замените:"
        echo '  ANTHROPIC_API_KEY="sk-ant-your-api-key-here"'
        echo "на ваш реальный API ключ от Anthropic"
        echo ""
        echo "Нажмите любую клавишу для продолжения..."
        read -n 1
    fi
else
    echo -e "${GREEN}✓ Файл окружения существует${NC}"
fi

# Проверка API ключа
ENV_FILE=""
if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ -n "$ENV_FILE" ] && grep -q "sk-ant-your-api-key-here" "$ENV_FILE" 2>/dev/null; then
    echo ""
    echo -e "${RED}⚠ ANTHROPIC_API_KEY не настроен в ${ENV_FILE}${NC}"
    echo -e "${YELLOW}  AI функции не будут работать без API ключа${NC}"
    echo ""
fi

# Установка зависимостей
echo ""
echo -e "${YELLOW}Установка зависимостей...${NC}"
npm install --silent
echo -e "${GREEN}✓ Зависимости установлены${NC}"

# Генерация Prisma клиента
echo -e "${YELLOW}Генерация Prisma клиента...${NC}"
npx prisma generate --schema=./prisma/schema.prisma 2>/dev/null
echo -e "${GREEN}✓ Prisma клиент сгенерирован${NC}"

# Создание базы данных
echo -e "${YELLOW}Настройка базы данных...${NC}"
npx prisma db push --schema=./prisma/schema.prisma 2>/dev/null
echo -e "${GREEN}✓ База данных готова${NC}"

# Удаление файла блокировки для предотвращения конфликтов
echo ""
echo -e "${YELLOW}Удаление файла блокировки (.next/dev/lock)...${NC}"
rm -f ".next/dev/lock"
echo -e "${GREEN}✓ Файл блокировки удален${NC}"

# Очистка Turbopack cache: macOS/Google Drive могут добавить служебный файл Icon\r,
# из-за которого Next.js падает с "Unexpected file in persistence directory".
echo -e "${YELLOW}Очистка кэша Turbopack...${NC}"
if [ -d ".next/dev/cache/turbopack" ]; then
    rm -rf ".next/dev/cache/turbopack"
fi
echo -e "${GREEN}✓ Кэш Turbopack очищен${NC}"

# Функция для поиска свободного порта
find_free_port() {
    local port=$1
    while lsof -ti:$port &> /dev/null; do
        port=$((port + 1))
    done
    echo $port
}

# Остановка существующих процессов и поиск свободного порта
BASE_PORT=3003
echo ""
echo -e "${YELLOW}Проверка порта ${BASE_PORT}...${NC}"
PORT=$(find_free_port ${BASE_PORT})

if [ "$PORT" != "$BASE_PORT" ]; then
    echo -e "${YELLOW}Порт ${BASE_PORT} занят. Используется следующий свободный порт: ${PORT}${NC}"
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
echo -e "${YELLOW}Браузер откроется автоматически через 3 секунды${NC}"
echo -e "${YELLOW}Нажмите Ctrl+C для остановки сервера${NC}"
echo ""

# Открыть браузер через 3 секунды
(sleep 3 && open "http://localhost:${PORT}") &

# Запустить сервер
npm run dev -- -p ${PORT}
