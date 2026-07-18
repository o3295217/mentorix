#!/bin/bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/deploy/deploy-contabo.sh"

cd "$ROOT_DIR" || exit 1

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  chmod +x "$DEPLOY_SCRIPT" 2>/dev/null || true
fi

"$DEPLOY_SCRIPT"
STATUS=$?

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "Деплой завершён. Нажмите Enter для закрытия..."
else
  echo "Деплой завершился с ошибкой ($STATUS). Нажмите Enter для закрытия..."
fi
read -r
exit "$STATUS"
