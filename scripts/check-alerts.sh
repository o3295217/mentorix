#!/bin/bash
# Быстрая проверка алертов мониторинга на VK Cloud
# Использование: ./scripts/check-alerts.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔍 Проверка мониторинга VK Cloud${NC}"
echo "================================"

# Алерты за сегодня
echo -e "\n${YELLOW}⚠️  Алерты за сегодня:${NC}"
TODAY_ALERTS=$(ssh vk "grep \"\[$(date -u +%Y-%m-%d)\" /home/ubuntu/ai-assistant-spec/logs/monitor/alerts.log 2>/dev/null" || true)

if [ -z "$TODAY_ALERTS" ]; then
  echo -e "${GREEN}Нет алертов ✅${NC}"
else
  echo -e "${RED}$TODAY_ALERTS${NC}"
fi

# Последний запуск
echo -e "\n${YELLOW}📊 Последний запуск мониторинга:${NC}"
ssh vk "tail -15 /home/ubuntu/ai-assistant-spec/logs/monitor/\$(ls -t /home/ubuntu/ai-assistant-spec/logs/monitor/*.log 2>/dev/null | grep -v alerts | grep -v cron | grep -v known | head -1 | xargs basename) 2>/dev/null" || echo "Логов нет"

# Известные IP
echo -e "\n${YELLOW}🌐 Зафиксированные IP:${NC}"
ssh vk 'cat /home/ubuntu/ai-assistant-spec/logs/monitor/known_ips.txt 2>/dev/null' || echo "Файл не найден"

echo -e "\n${GREEN}Готово${NC}"
