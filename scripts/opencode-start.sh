#!/usr/bin/env bash
# Единая точка входа: выбор сценария моделей перед началом работы.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Выбери сценарий opencode:"
echo "  1) base           — Anthropic (fable-5 + sonnet-5)   [расходует лимиты Anthropic]"
echo "  2) agent2.0_gpt56 — OpenAI (gpt-5.6-sol + gpt-5.5) + GLM-5.2"
printf "Сценарий [1/2]: "
read -r choice

case "$choice" in
  2)
    export OPENCODE_CONFIG_CONTENT="$(cat .opencode/scenarios/agent2.0_gpt56.json)"
    echo "Запуск: agent2.0_gpt56"
    ;;
  *)
    echo "Запуск: base"
    ;;
esac

exec opencode "$@"
