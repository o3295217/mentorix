#!/bin/bash

# Safe macOS launcher: commit current work (if any) and delegate production deploy
# to deploy/deploy-contabo.sh. Production deploy logic stays in the deploy script.

set -Eeuo pipefail

ROOT_DIR=""
DEPLOY_SCRIPT=""
TMP_DIR=""
INDEX_SNAPSHOT=""
GIT_INDEX_PATH=""
ROLLBACK_INDEX=0
KEEP_RECOVERY_DIR=0
ERROR_REPORTED=0
DEFAULT_MACOS_EXTRA_PATHS="/opt/homebrew/bin:/usr/local/bin:/opt/local/bin"
DEFAULT_COMMIT_MESSAGE="chore: deploy current changes"

finish_before_exit() {
  local status=$?
  trap - EXIT
  set +e

  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ] && [ "$KEEP_RECOVERY_DIR" != "1" ]; then
    rm -rf "$TMP_DIR"
  fi

  echo ""
  if [ "$status" -eq 0 ]; then
    echo "Готово: commit/deploy launcher завершён успешно."
  else
    echo "Остановлено с ошибкой ($status). Подробности выше."
  fi

  exit "$status"
}

ensure_no_git_index_lock() {
  if [ -n "$GIT_INDEX_PATH" ] && [ -e "$GIT_INDEX_PATH.lock" ]; then
    echo "Ошибка: обнаружен активный lock-файл git index." >&2
    echo "Не удаляю lock-файл автоматически; проверьте, не запущен ли другой git процесс." >&2
    return 1
  fi
  return 0
}

restore_initial_index() {
  if [ "$ROLLBACK_INDEX" != "1" ]; then
    return 0
  fi

  set +e
  echo "Восстанавливаю исходный git index snapshot без удаления изменений в worktree..."

  if ! ensure_no_git_index_lock; then
    KEEP_RECOVERY_DIR=1
    echo "Snapshot git index сохранён во временной директории для ручного восстановления." >&2
    set -e
    return 1
  fi

  local index_dir=""
  local restore_tmp=""
  local restore_status=0
  index_dir="$(dirname "$GIT_INDEX_PATH")"
  restore_tmp="$index_dir/index.restore.$$"

  cp -p "$INDEX_SNAPSHOT" "$restore_tmp"
  restore_status=$?
  if [ "$restore_status" -eq 0 ]; then
    mv "$restore_tmp" "$GIT_INDEX_PATH"
    restore_status=$?
  fi
  if [ "$restore_status" -ne 0 ]; then
    rm -f "$restore_tmp" 2>/dev/null || true
    KEEP_RECOVERY_DIR=1
    echo "Предупреждение: не удалось восстановить git index; snapshot сохранён во временной директории." >&2
    set -e
    return "$restore_status"
  fi

  ROLLBACK_INDEX=0
  set -e
  return 0
}

fail() {
  local message="$1"
  ERROR_REPORTED=1
  echo "Ошибка: $message" >&2
  restore_initial_index || true
  exit 1
}

prepend_path_if_dir() {
  local path_entry="$1"
  if [ ! -d "$path_entry" ]; then
    return 0
  fi

  case ":${PATH:-}:" in
    *":$path_entry:"*) ;;
    *) PATH="$path_entry${PATH:+:$PATH}" ;;
  esac
}

bootstrap_local_path() {
  local extra_paths="${COMMIT_DEPLOY_EXTRA_PATHS:-}"
  local path_entry=""

  if [ -z "$extra_paths" ]; then
    if [ "$(uname -s 2>/dev/null || true)" != "Darwin" ]; then
      return 0
    fi
    extra_paths="$DEFAULT_MACOS_EXTRA_PATHS"
    if [ -n "${HOME:-}" ]; then
      extra_paths="$extra_paths:$HOME/.local/bin"
    fi
  fi

  while [ -n "$extra_paths" ]; do
    path_entry="${extra_paths%%:*}"
    if [ "$extra_paths" = "$path_entry" ]; then
      extra_paths=""
    else
      extra_paths="${extra_paths#*:}"
    fi

    if [ -n "$path_entry" ]; then
      prepend_path_if_dir "$path_entry"
    fi
  done

  export PATH
}

ensure_commit_toolchain() {
  local missing=""
  local cmd=""

  for cmd in node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing="$missing $cmd"
    fi
  done

  if [ -n "$missing" ]; then
    fail "Не найдены обязательные команды для проверок и Husky hooks:$missing. Проверьте установку Node.js или задайте COMMIT_DEPLOY_EXTRA_PATHS."
  fi
}

configure_noninteractive_git_output() {
  export GIT_PAGER=cat
  export PAGER=cat
}

get_commit_message() {
  local message="${COMMIT_DEPLOY_MESSAGE:-$DEFAULT_COMMIT_MESSAGE}"

  if [ -z "$(printf '%s' "$message" | tr -d '[:space:]')" ]; then
    fail "COMMIT_DEPLOY_MESSAGE не должен быть пустым."
  fi
  case "$message" in
    *$'\n'*|*$'\r'*)
      fail "COMMIT_DEPLOY_MESSAGE должен быть одной строкой."
      ;;
  esac

  printf '%s' "$message"
}

on_error() {
  local status=$?
  local line="$1"
  trap - ERR
  if [ "$ERROR_REPORTED" != "1" ]; then
    echo "Ошибка: непредвиденный сбой в launcher (код $status)." >&2
  fi
  restore_initial_index || true
  exit "$status"
}

on_signal() {
  local signal="$1"
  local status="$2"
  trap - INT TERM HUP
  ERROR_REPORTED=1
  echo "Ошибка: получен сигнал $signal; безопасно останавливаю выполнение." >&2
  restore_initial_index || true
  exit "$status"
}

trap finish_before_exit EXIT
trap 'on_error "$LINENO"' ERR
trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM
trap 'on_signal HUP 129' HUP

ROOT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
DEPLOY_SCRIPT="$ROOT_DIR/deploy/deploy-contabo.sh"
bootstrap_local_path
configure_noninteractive_git_output

is_clean_worktree() {
  local status_output=""

  if ! status_output="$(git --no-pager status --porcelain)"; then
    fail "Не удалось проверить состояние рабочей копии; commit/deploy заблокирован."
  fi

  [ -z "$status_output" ]
}

nul_count() {
  local count=0
  local item=""
  while IFS= read -r -d '' item; do
    count=$((count + 1))
  done
  printf '%s' "$count"
}

nul_count_file() {
  local file="$1"
  local count=0
  local item=""

  while IFS= read -r -d '' item; do
    count=$((count + 1))
  done < "$file"
  printf '%s' "$count"
}

make_temp_file() {
  local name="$1"
  if [ -n "$TMP_DIR" ]; then
    printf '%s/%s' "$TMP_DIR" "$name"
  else
    mktemp "${TMPDIR:-/tmp}/commit-deploy-contabo.${name}.XXXXXX"
  fi
}

only_staged_changelog() {
  local staged_count=0
  local unstaged_count=0
  local untracked_count=0
  local staged_path=""
  local staged_file=""
  local unstaged_file=""
  local untracked_file=""

  staged_file="$(make_temp_file staged-name-only.z)"
  unstaged_file="$(make_temp_file unstaged-name-only.z)"
  untracked_file="$(make_temp_file untracked-name-only.z)"

  if ! git diff --cached --name-only -z > "$staged_file"; then
    fail "Не удалось проверить staged CHANGELOG; deploy заблокирован."
  fi
  if ! git diff --name-only -z > "$unstaged_file"; then
    fail "Не удалось проверить unstaged изменения после commit; deploy заблокирован."
  fi
  if ! git ls-files --others --exclude-standard -z > "$untracked_file"; then
    fail "Не удалось проверить untracked изменения после commit; deploy заблокирован."
  fi

  staged_count="$(nul_count_file "$staged_file")"
  unstaged_count="$(nul_count_file "$unstaged_file")"
  untracked_count="$(nul_count_file "$untracked_file")"

  if [ "$staged_count" != "1" ] || [ "$unstaged_count" != "0" ] || [ "$untracked_count" != "0" ]; then
    return 1
  fi

  while IFS= read -r -d '' staged_path; do
    [ "$staged_path" = "CHANGELOG.md" ] || return 1
  done < "$staged_file"

  return 0
}

has_exact_numstat_for_self_changelog_entry() {
  local record=""
  local additions=""
  local rest=""
  local deletions=""
  local path=""
  local count=0
  local numstat_file=""

  numstat_file="$(make_temp_file changelog-numstat.z)"
  if ! git diff --cached --numstat -z -- CHANGELOG.md > "$numstat_file"; then
    fail "Не удалось проверить размер generated CHANGELOG entry; deploy заблокирован."
  fi

  while IFS= read -r -d '' record; do
    count=$((count + 1))
    additions="${record%%$'\t'*}"
    rest="${record#*$'\t'}"
    deletions="${rest%%$'\t'*}"
    path="${rest#*$'\t'}"
    [ "$additions" = "4" ] || return 1
    [ "$deletions" = "0" ] || return 1
    [ "$path" = "CHANGELOG.md" ] || return 1
  done < "$numstat_file"

  [ "$count" = "1" ] || return 1
  return 0
}

is_exact_generated_self_changelog_entry() {
  local expected_date=""
  local diff_line=""
  local added_count=0
  local hunk_count=0
  local added_1="__unset__"
  local added_2="__unset__"
  local added_3="__unset__"
  local added_4="__unset__"
  local expected_1=""
  local expected_3="- 📝 Документация: 1 файлов"
  local summary_file=""
  local patch_file=""

  only_staged_changelog || return 1

  summary_file="$(make_temp_file changelog-summary.txt)"
  if ! git diff --cached --summary -- CHANGELOG.md > "$summary_file"; then
    fail "Не удалось проверить metadata generated CHANGELOG entry; deploy заблокирован."
  fi
  [ ! -s "$summary_file" ] || return 1

  has_exact_numstat_for_self_changelog_entry || return 1

  expected_date="$(date -u +%F)"
  expected_1="### $expected_date — docs: update changelog"

  patch_file="$(make_temp_file changelog-patch.diff)"
  if ! git diff --cached --no-ext-diff --unified=0 -- CHANGELOG.md > "$patch_file"; then
    fail "Не удалось проверить patch generated CHANGELOG entry; deploy заблокирован."
  fi

  while IFS= read -r diff_line; do
    case "$diff_line" in
      @@*)
        hunk_count=$((hunk_count + 1))
        ;;
      '--- '*|'+++'*|'diff --git '*|'index '*)
        ;;
      -*)
        return 1
        ;;
      +*)
        added_count=$((added_count + 1))
        case "$added_count" in
          1) added_1="${diff_line#+}" ;;
          2) added_2="${diff_line#+}" ;;
          3) added_3="${diff_line#+}" ;;
          4) added_4="${diff_line#+}" ;;
          *) return 1 ;;
        esac
        ;;
    esac
  done < "$patch_file"

  [ "$hunk_count" = "1" ] || return 1
  [ "$added_count" = "4" ] || return 1
  [ "$added_1" = "$expected_1" ] || return 1
  [ "$added_2" = "$expected_3" ] || return 1
  [ "$added_3" = "" ] || return 1
  [ "$added_4" = "" ] || return 1

  return 0
}

is_allowed_env_example() {
  case "$1" in
    .env.example|.env.production.example|*/.env.example|*/.env.production.example) return 0 ;;
    *) return 1 ;;
  esac
}

is_sensitive_path() {
  local path="$1"
  local result=1
  local nocasematch_was_set=0

  if shopt -q nocasematch; then
    nocasematch_was_set=1
  fi
  shopt -s nocasematch

  case "$path" in
    .env*|*/.env*)
      if is_allowed_env_example "$path"; then
        result=1
      else
        result=0
      fi
      ;;
  esac

  if [ "$result" = "1" ]; then
    case "/$path/" in
      */keys/*|*/secrets/*|*/.secrets/*|*/backups/*|*/backup/*|*/data/*|*/logs/*|*/db/*|*/sql/*|*/dump/*|*/dumps/*)
        result=0
        ;;
    esac
  fi

  if [ "$result" = "1" ]; then
    case "$path" in
      *.pem|*.key|*.p12|*.pfx|*.db|*.sqlite|*.sqlite3|*.dump|*.bak|*.backup|*.sql|*.sql.gz|*.sql.gz.enc|*.sql.enc)
        case "$path" in
          prisma/migrations/*/migration.sql) result=1 ;;
          *) result=0 ;;
        esac
        ;;
    esac
  fi

  if [ "$result" = "1" ]; then
    case "$path" in
      .tg-bot-token|*/.tg-bot-token|.tg-bot-env|*/.tg-bot-env|*tg*token*|*tg*env*) result=0 ;;
    esac
  fi

  if [ "$nocasematch_was_set" = "0" ]; then
    shopt -u nocasematch
  fi

  return "$result"
}

append_bad_path() {
  BAD_PATH_COUNT=$((BAD_PATH_COUNT + 1))
}

check_one_staged_path() {
  local path="$1"
  if is_sensitive_path "$path"; then
    append_bad_path "$path"
  fi
}

check_sensitive_staged_paths() {
  local status=""
  local path=""
  local second_path=""
  local staged_paths_file=""
  BAD_PATH_COUNT=0

  if [ -n "$TMP_DIR" ]; then
    staged_paths_file="$TMP_DIR/staged-name-status.z"
  else
    staged_paths_file="$(mktemp "${TMPDIR:-/tmp}/commit-deploy-staged-name-status.XXXXXX")"
  fi

  if ! git diff --cached --name-status -z --find-renames > "$staged_paths_file"; then
    rm -f "$staged_paths_file" 2>/dev/null || true
    fail "Не удалось проверить staged paths на секреты и дампы; commit/deploy заблокирован."
  fi

  while IFS= read -r -d '' status; do
    case "$status" in
      R*|C*)
        IFS= read -r -d '' path || fail "Не удалось разобрать staged rename/copy source path."
        IFS= read -r -d '' second_path || fail "Не удалось разобрать staged rename/copy destination path."
        check_one_staged_path "$path"
        check_one_staged_path "$second_path"
        ;;
      *)
        IFS= read -r -d '' path || fail "Не удалось разобрать staged path."
        check_one_staged_path "$path"
        ;;
    esac
  done < "$staged_paths_file"

  if [ "$BAD_PATH_COUNT" -gt 0 ]; then
    echo "Обнаружены sensitive paths в staged: $BAD_PATH_COUNT. Имена и содержимое не выводятся." >&2
    fail "Commit/deploy заблокирован. Уберите секреты, дампы, ключи, логи или backup/data artefacts из staged."
  fi
}

snapshot_initial_index() {
  GIT_INDEX_PATH="$(git rev-parse --git-path index)"
  ensure_no_git_index_lock || fail "Git index заблокирован; commit/deploy остановлен."
  if [ ! -f "$GIT_INDEX_PATH" ]; then
    fail "Git index не найден; commit/deploy остановлен."
  fi

  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/commit-deploy-contabo.XXXXXX")"
  INDEX_SNAPSHOT="$TMP_DIR/index.snapshot"
  cp -p "$GIT_INDEX_PATH" "$INDEX_SNAPSHOT"
  ROLLBACK_INDEX=1
}

run_required_checks() {
  echo ""
  echo "Запускаю обязательные проверки перед commit..."
  npm run typecheck || fail "npm run typecheck failed"
  npm run lint || fail "npm run lint failed"
  npm run test || fail "npm run test failed"
}

handle_husky_generated_changelog() {
  if is_clean_worktree; then
    return 0
  fi

  if only_staged_changelog; then
    echo ""
    echo "Husky оставил staged CHANGELOG.md — создаю второй commit docs: update changelog..."
    git -c commit.gpgSign=false commit --quiet -m "docs: update changelog"
  else
    fail "После основного commit остались неожиданные pending changes. Deploy заблокирован."
  fi

  if is_clean_worktree; then
    return 0
  fi

  if is_exact_generated_self_changelog_entry; then
    echo ""
    echo "Убираю проверенную self-referential запись CHANGELOG от docs commit..."
    git restore --source=HEAD --staged --worktree -- CHANGELOG.md
    return 0
  fi

  fail "После docs commit CHANGELOG содержит не только ожидаемую generated self-entry. Deploy заблокирован; изменения сохранены."
}

echo "🚀 Commit and Deploy → Contabo"
echo "================================"
echo "Репозиторий найден."

cd "$ROOT_DIR"

if [ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]; then
  fail "Launcher запущен не внутри git repository."
fi

GIT_TOPLEVEL="$(git rev-parse --show-toplevel)"
if [ "$GIT_TOPLEVEL" != "$ROOT_DIR" ]; then
  fail "Launcher должен быть запущен из корня repository."
fi

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  fail "Deploy script не найден или не является executable."
fi

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [ -z "$BRANCH" ]; then
  fail "Detached HEAD не поддерживается для production deploy."
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [ -z "$UPSTREAM" ]; then
  fail "Текущая ветка не имеет upstream. Настройте upstream перед deploy."
fi

echo "Ветка: $BRANCH → $UPSTREAM"
echo ""
echo "Проверяю состояние рабочей копии..."
if is_clean_worktree; then
  echo "Изменений нет: будет задеплоен текущий HEAD."
else
  echo "Изменения найдены: подготовлю commit автоматически."
fi

if is_clean_worktree; then
  :
else
  echo ""
  COMMIT_MESSAGE="$(get_commit_message)"
  ensure_commit_toolchain
  snapshot_initial_index
  echo "Подготавливаю все текущие изменения..."
  git add -A

  STAGED_NAME_CHECK_FILE="$(make_temp_file staged-name-check.txt)"
  if ! git diff --cached --name-only > "$STAGED_NAME_CHECK_FILE"; then
    fail "Не удалось проверить наличие staged changes после git add; commit/deploy заблокирован."
  fi
  if [ ! -s "$STAGED_NAME_CHECK_FILE" ]; then
    fail "После git add -A нет staged changes для commit."
  fi

  echo "Проверяю staged paths на секреты и дампы..."
  check_sensitive_staged_paths

  run_required_checks

  echo ""
  echo "Создаю commit: $COMMIT_MESSAGE"
  git -c commit.gpgSign=false commit --quiet -m "$COMMIT_MESSAGE" || fail "git commit завершился ошибкой"
  ROLLBACK_INDEX=0

  handle_husky_generated_changelog
fi

if ! is_clean_worktree; then
  fail "Финальная рабочая копия не чистая; deploy заблокирован."
fi

echo ""
echo "Рабочая копия чистая. Передаю управление deploy/deploy-contabo.sh..."
"$DEPLOY_SCRIPT" </dev/null
