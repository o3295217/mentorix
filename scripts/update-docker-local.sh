#!/usr/bin/env bash

set -euo pipefail

MODE="dev"        # dev -> docker-compose.yml, prod -> docker-compose.production.yml
DO_GIT_PULL=0
NO_CACHE=0
PROJECT_NAME=""
STOP_EXISTING=1
ASSUME_YES=0

usage() {
  cat <<'USAGE'
Update AI Assistant Docker container locally.

Usage:
  scripts/update-docker-local.sh [--git-pull] [--no-cache] [--prod] [--project NAME] [--no-stop-existing] [--yes]

Options:
  --git-pull   Pull latest code (git pull --ff-only) before rebuild
  --no-cache   Build without cache
  --prod       Use docker-compose.production.yml (includes postgres service)
  --project    Override Docker Compose project name (avoids orphan warnings)
  --no-stop-existing  Do not stop existing app container if it occupies port 3000
  --yes        Assume "yes" for prompts
USAGE
}

info() { echo "==> $*"; }
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

confirm() {
  local prompt="$1"
  if [[ "$ASSUME_YES" == "1" ]]; then
    return 0
  fi
  read -r -p "$prompt [y/N]: " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod)
      MODE="prod"
      shift
      ;;
    --git-pull)
      DO_GIT_PULL=1
      shift
      ;;
    --no-cache)
      NO_CACHE=1
      shift
      ;;
    --project)
      PROJECT_NAME="${2:-}"
      if [[ -z "$PROJECT_NAME" ]]; then
        echo "--project requires a name" >&2
        exit 2
      fi
      shift 2
      ;;
    --no-stop-existing)
      STOP_EXISTING=0
      shift
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker Desktop and try again."
docker info >/dev/null 2>&1 || die "Docker engine is not running. Start Docker Desktop and try again."
docker compose version >/dev/null 2>&1 || die "docker compose not available. Update Docker Desktop (Compose v2 required)."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info "Project: $(basename "$ROOT_DIR")"

if [[ -z "$PROJECT_NAME" ]]; then
  # Important: use a distinct project name in dev mode so that containers
  # created by other compose files (e.g. postgres from production stack)
  # are not treated as orphans.
  if [[ "$MODE" == "prod" ]]; then
    PROJECT_NAME="$(basename "$ROOT_DIR")"
  else
    PROJECT_NAME="$(basename "$ROOT_DIR")-dev"
  fi
fi

info "Compose project: $PROJECT_NAME"

if [[ "$DO_GIT_PULL" == "1" ]]; then
  info "git pull --ff-only"
  git pull --ff-only
fi

COMPOSE_FILE="docker-compose.yml"
if [[ "$MODE" == "prod" ]]; then
  COMPOSE_FILE="docker-compose.production.yml"
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  die "Compose file not found: $COMPOSE_FILE"
fi

COMPOSE_ARGS=("-p" "$PROJECT_NAME" "-f" "$COMPOSE_FILE")

# In prod mode, use .env.production if present (Compose does not load it automatically).
if [[ "$MODE" == "prod" ]]; then
  if [[ -f ".env.production" ]]; then
    COMPOSE_ARGS+=("--env-file" ".env.production")
  else
    die "Missing .env.production for --prod mode. Create it from .env.production.example"
  fi
fi

# If port 3000 is already occupied by an existing app container, handle it.
if docker ps --format '{{.Names}} {{.Ports}}' | grep -qE '(^| )ai-assistant-(app|production) ' && docker ps --format '{{.Names}} {{.Ports}}' | grep -qE '0\.0\.0\.0:3000->|\[::\]:3000->'; then
  if [[ "$STOP_EXISTING" == "1" ]]; then
    warn "Port 3000 looks occupied by an existing AI Assistant container."
    if confirm "Stop conflicting container(s) ai-assistant-app/ai-assistant-production?"; then
      docker stop ai-assistant-app ai-assistant-production >/dev/null 2>&1 || true
      docker rm ai-assistant-app ai-assistant-production >/dev/null 2>&1 || true
    else
      die "Port 3000 conflict not resolved. Stop the container using port 3000 and retry."
    fi
  else
    die "Port 3000 is occupied and --no-stop-existing was set. Stop the container using port 3000 and retry."
  fi
fi

info "Rebuild app (compose: $COMPOSE_FILE)"
BUILD_ARGS=("--pull")
if [[ "$NO_CACHE" == "1" ]]; then
  BUILD_ARGS+=("--no-cache")
fi

docker compose "${COMPOSE_ARGS[@]}" build "${BUILD_ARGS[@]}" app

info "Recreate app container"
docker compose "${COMPOSE_ARGS[@]}" up -d --force-recreate app

info "Status"
docker compose "${COMPOSE_ARGS[@]}" ps
