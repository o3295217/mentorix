#!/bin/bash
# Быстрая проверка алертов мониторинга
# Использование: ./scripts/check-alerts.sh [vk|contabo]

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVER="${1:-vk}"
case "$SERVER" in
  vk)      REMOTE_PATH="/home/ubuntu/ai-assistant-spec" ;;
  contabo) REMOTE_PATH="/home/oleg/ai-assistant-spec" ;;
  *) echo "Неизвестный сервер: $SERVER (ожидается vk или contabo)" >&2; exit 1 ;;
esac

echo -e "${CYAN}🔍 Проверка мониторинга ($SERVER)${NC}"
echo "================================"

# Алерты за сегодня
echo -e "\n${YELLOW}⚠️  Алерты за сегодня:${NC}"
TODAY_ALERTS=$(ssh "$SERVER" "grep \"\[$(date -u +%Y-%m-%d)\" $REMOTE_PATH/logs/monitor/alerts.log 2>/dev/null" || true)

if [ -z "$TODAY_ALERTS" ]; then
  echo -e "${GREEN}Нет алертов ✅${NC}"
else
  echo -e "${RED}$TODAY_ALERTS${NC}"
fi

# Последний запуск
echo -e "\n${YELLOW}📊 Последний запуск мониторинга:${NC}"
ssh "$SERVER" "tail -15 $REMOTE_PATH/logs/monitor/\$(ls -t $REMOTE_PATH/logs/monitor/*.log 2>/dev/null | grep -v alerts | grep -v cron | grep -v known | head -1 | xargs basename) 2>/dev/null" || echo "Логов нет"

# Известные IP
echo -e "\n${YELLOW}🌐 Зафиксированные IP:${NC}"
ssh "$SERVER" "cat $REMOTE_PATH/logs/monitor/known_ips.txt 2>/dev/null" || echo "Файл не найден"

echo -e "\n${GREEN}Готово${NC}"
