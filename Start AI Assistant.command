#!/bin/bash

# AI Effectiveness Assistant - запуск двойным кликом на macOS.
# Вся логика запуска — в scripts/start-local.sh, здесь только обёртка,
# которая не даёт окну Terminal закрыться до того, как вы увидите ошибку.

cd "$(dirname "$0")"
clear

./scripts/start-local.sh
STATUS=$?

# 130 = остановка dev-сервера по Ctrl+C, это штатное завершение, не ошибка.
if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 130 ]; then
    echo ""
    echo "Запуск завершился с ошибкой — причина выше."
    echo "Нажмите любую клавишу, чтобы закрыть окно..."
    read -n 1
    exit "$STATUS"
fi
