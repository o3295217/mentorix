#!/bin/sh
set -eu
set -o pipefail

# Бэкап PostgreSQL для продакшена (запускается из Docker-контейнера)
# Вызывается crond ежедневно в 03:00 и один раз при старте контейнера

# Загрузить PG env (crond не наследует Docker env)
[ -f /run/pg.env ] && { set -a; . /run/pg.env; set +a; }

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-/run/secrets/backup-key}"
MAX_BACKUPS="${MAX_BACKUPS:-30}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILE="$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz.enc"

mkdir -p "$BACKUP_DIR"

if [ ! -s "$BACKUP_KEY_FILE" ]; then
  echo "$(date): FAIL backup encryption key is missing or empty: $BACKUP_KEY_FILE" >> "$BACKUP_DIR/backup.log"
  exit 1
fi

pg_dump --no-owner --no-acl \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 -pass "file:$BACKUP_KEY_FILE" \
  > "$FILE"

if [ -s "$FILE" ]; then
  SIZE=$(du -h "$FILE" | cut -f1)
  echo "$(date): OK $FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"
else
  rm -f "$FILE"
  echo "$(date): FAIL" >> "$BACKUP_DIR/backup.log"
  exit 1
fi

# Оставить последние N зашифрованных бэкапов
ls -t "$BACKUP_DIR"/pg_*.sql.gz.enc 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null

exit 0
