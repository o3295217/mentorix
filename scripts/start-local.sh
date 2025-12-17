#!/bin/bash

# AI Effectiveness Assistant - Local Development Startup Script
# Скрипт для запуска проекта на macOS

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Определить директорию проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI Effectiveness Assistant${NC}"
echo -e "${BLUE}  Local Development Startup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

cd "$PROJECT_DIR"

# Проверка Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Install Node.js from https://nodejs.org/ or use:"
    echo "  brew install node"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

# Проверка npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"

# Проверка .env файла
echo -e "${YELLOW}Checking environment configuration...${NC}"
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env.local from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${YELLOW}⚠ Please edit .env.local and add your ANTHROPIC_API_KEY${NC}"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Environment file exists${NC}"
fi

# Проверка ANTHROPIC_API_KEY
if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if grep -q "sk-ant-your-api-key-here" "$ENV_FILE" 2>/dev/null; then
    echo -e "${RED}⚠ Warning: ANTHROPIC_API_KEY not configured in ${ENV_FILE}${NC}"
    echo -e "${YELLOW}  AI features will not work without a valid API key${NC}"
fi

# Установка зависимостей
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Генерация Prisma клиента
echo ""
echo -e "${YELLOW}Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

# Создание/миграция базы данных
echo ""
echo -e "${YELLOW}Setting up database...${NC}"
npx prisma db push
echo -e "${GREEN}✓ Database ready${NC}"

# Остановка существующих процессов на порту 3000
echo ""
echo -e "${YELLOW}Checking for existing processes on port 3000...${NC}"
if lsof -ti:3000 &> /dev/null; then
    echo -e "${YELLOW}Stopping existing process on port 3000...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Запуск сервера разработки
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Starting development server...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Application will be available at:${NC}"
echo -e "${GREEN}  → http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

npm run dev
