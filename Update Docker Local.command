#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

# Запуск обновления docker-контейнера локально (dev compose)
# Можно переключить на прод-стек добавив --prod
bash "./scripts/update-docker-local.sh" "$@"

echo ""
echo "Done. Press Enter to close."
read
