#!/usr/bin/env bash
# Сценарий agent2.0_balanced: GPT остаётся на исполнителях/reviewers/приёмке,
# free-модели используются только для read-only подготовки.
set -euo pipefail
cd "$(dirname "$0")/.."
export OPENCODE_CONFIG_CONTENT="$(cat .opencode/scenarios/agent2.0_balanced.json)"
exec opencode "$@"
