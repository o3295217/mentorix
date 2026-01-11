#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVER="oleg_d_b@192.168.2.74"
REMOTE_PATH="/home/oleg_d_b/ai-assistant"
LOCAL_PATH="/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec"

echo -e "${YELLOW}🚀 Деплой AI Assistant${NC}"
echo "================================"

# 1. Git commit и push
echo -e "\n${GREEN}1. Коммит изменений...${NC}"
cd "$LOCAL_PATH"

if [[ -z $(git status --porcelain) ]]; then
    echo "Нет изменений для коммита"
else
    git add -A
    read -p "Сообщение коммита (или Enter для 'update'): " COMMIT_MSG
    COMMIT_MSG=${COMMIT_MSG:-"update"}
    git commit -m "$COMMIT_MSG"
fi

echo -e "\n${GREEN}2. Push в GitHub...${NC}"
git push origin main

# 2. Синхронизация файлов на сервер
echo -e "\n${GREEN}3. Синхронизация на сервер...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude 'data/*.db' \
    --exclude '.env' \
    --exclude '.env.local' \
    --exclude '.env.production' \
    --exclude 'backups/*' \
    "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

# 3. Пересборка на сервере
echo -e "\n${GREEN}4. Пересборка Docker на сервере...${NC}"
ssh "$SERVER" "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml build --no-cache"

# 4. Перезапуск контейнера
echo -e "\n${GREEN}5. Перезапуск контейнера...${NC}"
ssh "$SERVER" "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml up -d"

# 5. Проверка статуса
echo -e "\n${GREEN}6. Проверка статуса...${NC}"
sleep 3
ssh "$SERVER" "docker ps | grep ai-assistant"

echo -e "\n${GREEN}✅ Деплой завершён!${NC}"
echo "Приложение доступно: http://192.168.2.74:3010"
