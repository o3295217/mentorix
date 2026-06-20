#!/bin/bash

# Деплой AI Assistant на Contabo VM (основной прод)
# Использование: ./deploy/deploy-contabo.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVER="contabo"  # SSH alias из ~/.ssh/config
REMOTE_PATH="/home/oleg/ai-assistant-spec"
LOCAL_PATH="/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec"

echo -e "${YELLOW}🚀 Деплой AI Assistant → Contabo${NC}"
echo "================================"

# 1. Git commit и push
echo -e "\n${GREEN}1. Коммит изменений...${NC}"
cd "$LOCAL_PATH"

if [[ -z $(git status --porcelain) ]]; then
    echo "Нет изменений для коммита"
else
    git add --update
    git add app components hooks lib prisma cloudflare-proxy docs public scripts middleware.ts next.config.js package.json eslint.config.mjs postcss.config.js tailwind.config.js tsconfig.json docker-entrypoint.sh docker-compose.production.yml Dockerfile README.md CHANGELOG.md CONTRIBUTING.md deploy 2>/dev/null || true
    read -p "Сообщение коммита (или Enter для 'update'): " COMMIT_MSG
    COMMIT_MSG=${COMMIT_MSG:-"update"}
    git commit -m "$COMMIT_MSG"
fi

echo -e "\n${GREEN}2. Push в GitHub...${NC}"
git push origin main

# 2. Синхронизация файлов на Contabo
echo -e "\n${GREEN}3. Синхронизация на Contabo...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'data/*.db' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.env.production' \
    --exclude 'backups/*' \
    --exclude 'vkcloud-key/*.pem' \
    --exclude 'logs/' \
    "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

# 3. Пересборка на сервере
echo -e "\n${GREEN}4. Пересборка Docker на Contabo...${NC}"
ssh "$SERVER" "cd $REMOTE_PATH && docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache"

# 4. Перезапуск контейнера
echo -e "\n${GREEN}5. Перезапуск контейнера...${NC}"
ssh "$SERVER" "cd $REMOTE_PATH && docker compose --env-file .env.production -f docker-compose.production.yml up -d"

# 5. Проверка статуса
echo -e "\n${GREEN}5. Проверка статуса...${NC}"
sleep 5
ssh "$SERVER" "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep ai-assistant"

echo -e "\n${GREEN}✅ Деплой на Contabo завершён!${NC}"
