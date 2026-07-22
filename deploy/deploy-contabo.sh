#!/usr/bin/env bash

# Деплой AI Assistant на Contabo VM (единственный production).
# Cloudflare/Wrangler/Workers не участвуют: production ходит напрямую к Anthropic и Telegram.
# Использование: ./deploy/deploy-contabo.sh

set -Eeuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SERVER="contabo" # SSH alias из ~/.ssh/config
REMOTE_PATH="/home/oleg/ai-assistant-spec"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://mentorix.aionlab.ru/api/health}"
ANTHROPIC_CONNECTIVITY_URL="https://api.anthropic.com/v1/messages"
SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o NumberOfPasswordPrompts=0 -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"

export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=/bin/false
export SSH_ASKPASS=/bin/false
export GIT_SSH_COMMAND="$SSH_COMMAND"

fail() {
  echo -e "${RED}Ошибка: $*${NC}" >&2
  exit 1
}

ssh_batch() {
  ssh -n \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=yes \
    -o NumberOfPasswordPrompts=0 \
    -o PasswordAuthentication=no \
    -o KbdInteractiveAuthentication=no \
    -o ServerAliveInterval=10 \
    -o ServerAliveCountMax=3 \
    "$SERVER" "$@"
}

ensure_clean_worktree() {
  local status_output=""

  if ! status_output="$(git --no-pager status --porcelain)"; then
    fail "Не удалось проверить состояние рабочей копии. Деплой заблокирован."
  fi
  if [ -n "$status_output" ]; then
    fail "Рабочая копия содержит незакоммиченные изменения. Запустите commit+deploy launcher или закоммитьте изменения вручную."
  fi
}

echo -e "${YELLOW}🚀 Деплой AI Assistant → Contabo${NC}"
echo "================================"
echo "Сервер: $SERVER"

echo -e "\n${GREEN}1. Проверка git перед деплоем${NC}"
cd "$LOCAL_PATH"

ensure_clean_worktree

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "HEAD" ]; then
  fail "Detached HEAD не поддерживается для production deploy."
fi

if [ "${DEPLOY_SKIP_PUSH:-0}" = "1" ]; then
  echo "Отправка ветки пропущена: DEPLOY_SKIP_PUSH=1"
else
  UPSTREAM_REMOTE="$(git config --get "branch.$BRANCH.remote" 2>/dev/null || true)"
  UPSTREAM_MERGE="$(git config --get "branch.$BRANCH.merge" 2>/dev/null || true)"
  if [ -z "$UPSTREAM_REMOTE" ] || [ -z "$UPSTREAM_MERGE" ]; then
    fail "Текущая ветка не имеет upstream. Настройте upstream или используйте DEPLOY_SKIP_PUSH=1."
  fi
  if [ "$UPSTREAM_REMOTE" = "." ]; then
    fail "Локальный upstream remote '.' запрещён для production deploy."
  fi
  case "$UPSTREAM_MERGE" in
    refs/heads/*) ;;
    *) fail "Upstream merge ref должен быть refs/heads/... для production deploy." ;;
  esac
  if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
    fail "Upstream remote не найден в git config."
  fi
  UPSTREAM_DISPLAY="$UPSTREAM_REMOTE/${UPSTREAM_MERGE#refs/heads/}"
  echo -e "\n${GREEN}2. Отправка текущей ветки ($BRANCH → $UPSTREAM_DISPLAY)${NC}"
  git -c core.askPass=/bin/false -c push.gpgSign=false push -- "$UPSTREAM_REMOTE" "HEAD:$UPSTREAM_MERGE" </dev/null || fail "Не удалось выполнить git push без интерактивного ввода. Проверьте SSH key auth, passphrase agent и права upstream."
fi

echo -e "\n${GREEN}3. Подготовка директории на сервере${NC}"
ssh_batch "mkdir -p '$REMOTE_PATH'" || fail "Не удалось подключиться к серверу без интерактивного ввода. Проверьте SSH alias, known_hosts и key auth."

echo -e "\n${GREEN}4. Production preflight на сервере: прямой Anthropic, без Cloudflare/Wrangler${NC}"
ssh_batch "test -f '$REMOTE_PATH/.env.production'" || fail ".env.production не найден на сервере."
ANTHROPIC_STATUS="$(ssh_batch "curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 20 '$ANTHROPIC_CONNECTIVITY_URL'" 2>/dev/null || true)"
if [ -z "$ANTHROPIC_STATUS" ] || [ "$ANTHROPIC_STATUS" = "000" ]; then
  fail "Contabo не может напрямую подключиться к api.anthropic.com. Сеть обязательна; deploy не использует Cloudflare/Wrangler."
fi
echo "Прямая доступность Anthropic подтверждена (HTTP $ANTHROPIC_STATUS, запрос без API-ключа)"

echo -e "\n${GREEN}5. Синхронизация проекта на Contabo${NC}"
rsync -az --delete --delete-delay \
  -e "$SSH_COMMAND" \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude '.env*' \
  --include '/prisma/migrations/**/migration.sql' \
  --exclude 'backups/' \
  --exclude 'backup/' \
  --exclude 'logs/' \
  --exclude 'data/' \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  --exclude '*.pem' \
  --exclude '*.key' \
  --exclude '*.p12' \
  --exclude '*.pfx' \
  --exclude '*.bak' \
  --exclude '*.backup' \
  --exclude '*.dump' \
  --exclude '*.sql' \
  --exclude '*.sql.gz' \
  --exclude '*.sql.gz.enc' \
  --exclude '.tg-bot-token' \
  --exclude '.tg-bot-env' \
  --exclude 'keys/' \
  --exclude 'secrets/' \
  --exclude '.secrets/' \
  --exclude '.opencode/' \
  --exclude 'coverage/' \
  "$LOCAL_PATH/" "$SERVER:$REMOTE_PATH/" || fail "rsync не смог синхронизировать проект без интерактивного SSH. Проверьте known_hosts и key auth."

echo -e "\n${GREEN}6. Сборка production Docker image на Contabo${NC}"
ssh_batch "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml build --no-cache"

echo -e "\n${GREEN}7. Запуск/обновление production containers${NC}"
ssh_batch "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml up -d"

echo -e "\n${GREEN}8. Best-effort перезапуск Telegram-бота${NC}"
ssh_batch "sudo -n systemctl restart tg-bot 2>/dev/null && echo 'tg-bot restarted' || echo 'tg-bot service not found or restart failed, skipping'"

echo -e "\n${GREEN}9. Статус контейнеров и health${NC}"
ssh_batch "cd '$REMOTE_PATH' && docker compose --env-file .env.production -f docker-compose.production.yml ps"

APP_HEALTH=""
for attempt in {1..18}; do
  APP_HEALTH="$(ssh_batch "docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ai-assistant-production" 2>/dev/null || true)"
  if [ "$APP_HEALTH" = "healthy" ] || [ "$APP_HEALTH" = "running" ]; then
    echo "Статус ai-assistant-production: $APP_HEALTH"
    break
  fi
  echo "Ожидаю health приложения ($attempt/18): ${APP_HEALTH:-unknown}"
  sleep 10
done

if [ "$APP_HEALTH" != "healthy" ] && [ "$APP_HEALTH" != "running" ]; then
  ssh_batch "docker logs --tail=120 ai-assistant-production" || true
  fail "Контейнер приложения не перешёл в healthy/running."
fi

echo -e "\n${GREEN}10. Публичная health-проверка${NC}"
curl -fsS --retry 5 --retry-delay 5 "$PUBLIC_HEALTH_URL" >/dev/null
echo "Публичная health-проверка пройдена: $PUBLIC_HEALTH_URL"

echo -e "\n${GREEN}✅ Деплой на Contabo завершён!${NC}"
echo "Приложение: https://mentorix.aionlab.ru"
