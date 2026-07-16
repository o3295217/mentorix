#!/usr/bin/env bash
# Сценарий agent2.0_gpt56: lead gpt-5.6-sol, профильные роли gpt-5.5,
# junior gpt-5.4-mini, local — Ollama.
set -euo pipefail
cd "$(dirname "$0")/.."
export OPENCODE_CONFIG_CONTENT="$(cat .opencode/scenarios/agent2.0_gpt56.json)"
exec opencode "$@"
