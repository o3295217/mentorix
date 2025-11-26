#!/bin/bash

echo "🔄 Проверка обновлений из GitHub..."

cd ~/ai-assistant-spec

git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    echo "✅ Локальная версия актуальна. Обновление не требуется."
else
    echo "📥 Найдены новые изменения. Загружаю..."
    git pull --no-rebase origin main
    echo "✅ Проект обновлён!"
fi
