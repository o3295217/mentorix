#!/usr/bin/env bash
# Сценарий agent2.0_anthropic_primary: Anthropic остаётся основой (lead, junior,
# reviewers, creative/motion/visual-QA кластер), часть доменных исполнителей
# (architecture/backend/logic/frontend/design/scenario/specialist) — на GPT-5.5,
# read-only explore — на бесплатной модели.
set -euo pipefail
cd "$(dirname "$0")/.."
export OPENCODE_CONFIG_CONTENT="$(cat .opencode/scenarios/agent2.0_anthropic_primary.json)"
exec opencode "$@"
