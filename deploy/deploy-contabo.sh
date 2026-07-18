#!/usr/bin/env bash

# Деплой AI Assistant на Contabo VM (единственный production).
# Использование: ./deploy/deploy-contabo.sh

set -Eeuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVER="contabo" # SSH alias из ~/.ssh/config
REMOTE_PATH="/home/oleg/ai-assistant-spec"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://assist.labaiion.ru/api/health}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo -e "${RED}ERROR: $*${NC}" >&2
  exit 1
}

echo -e "${YELLOW}🚀 Деплой AI Assistant → Contabo${NC}"
echo "================================"
echo "Local:  $LOCAL_PATH"
echo "Remote: $SERVER:$REMOTE_PATH"

echo -e "\n${GREEN}1. Git safety check${NC}"
cd "$LOCAL_PATH"

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  fail "Worktree is dirty. Commit/stash changes before deploy; deploy script never commits interactively."
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
  fail "Detached HEAD is not supported for production deploy."
fi

if [ "${DEPLOY_SKIP_PUSH:-0}" = "1" ]; then
  echo "Push skipped because DEPLOY_SKIP_PUSH=1"
else
  UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [ -z "$UPSTREAM" ]; then
    fail "Current branch '$BRANCH' has no upstream. Set upstream or run with DEPLOY_SKIP_PUSH=1."
  fi
  echo -e "\n${GREEN}2. Push current branch ($BRANCH → $UPSTREAM)${NC}"
  git push
fi

echo -e "\n${GREEN}3. Prepare remote directory${NC}"
ssh "$SERVER" "mkdir -p '$REMOTE_PATH'"

echo -e "\n${GREEN}4. Sync project to Contabo${NC}"
rsync -az --delete --delete-delay \
  -e "ssh -o ServerAliveInterval=10 -o ServerAliveCountMax=3" \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude '.env*' \
  --exclude 'backups/' \
  --exclude 'logs/' \
  --exclude 'data/' \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  --exclude '*.pem' \
  --exclude '*.key' \
  --exclude '.tg-bot-token' \
  --exclude '.tg-bot-env' \
  --exclude 'secrets/' \
  --exclude '.opencode/' \
  --exclude 'coverage/' \
  "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/"

echo -e "\n${GREEN}5. Build production Docker image on Contabo${NC}"
ssh "$SERVER" "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache"

echo -e "\n${GREEN}6. Start/update production containers${NC}"
ssh "$SERVER" "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml up -d"

echo -e "\n${GREEN}7. Best-effort Telegram bot restart${NC}"
ssh "$SERVER" "sudo systemctl restart tg-bot 2>/dev/null && echo 'tg-bot restarted' || echo 'tg-bot service not found or restart failed, skipping'"

echo -e "\n${GREEN}8. Container status and health${NC}"
ssh "$SERVER" "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml ps"

APP_HEALTH=""
for attempt in {1..18}; do
  APP_HEALTH="$(ssh "$SERVER" "docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ai-assistant-production" 2>/dev/null || true)"
  if [ "$APP_HEALTH" = "healthy" ] || [ "$APP_HEALTH" = "running" ]; then
    echo "ai-assistant-production status: $APP_HEALTH"
    break
  fi
  echo "Waiting for app health ($attempt/18): ${APP_HEALTH:-unknown}"
  sleep 10
done

if [ "$APP_HEALTH" != "healthy" ] && [ "$APP_HEALTH" != "running" ]; then
  ssh "$SERVER" "docker logs --tail=120 ai-assistant-production" || true
  fail "App container did not become healthy/running."
fi

echo -e "\n${GREEN}9. Public health check${NC}"
curl -fsS --retry 5 --retry-delay 5 "$PUBLIC_HEALTH_URL" >/dev/null
echo "Public health OK: $PUBLIC_HEALTH_URL"

echo -e "\n${GREEN}✅ Деплой на Contabo завершён!${NC}"
echo "Приложение: https://assist.labaiion.ru"
