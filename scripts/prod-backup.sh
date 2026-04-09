#!/bin/sh
set -e

# Бэкап PostgreSQL для продакшена (запускается из Docker-контейнера)
# Вызывается crond ежедневно в 03:00 и один раз при старте контейнера

# Загрузить PG env (crond не наследует Docker env)
[ -f /run/pg.env ] && { set -a; . /run/pg.env; set +a; }

BACKUP_DIR="/backups"
MAX_BACKUPS=30
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILE="$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz"

pg_dump --no-owner --no-acl | gzip > "$FILE"

if [ -s "$FILE" ]; then
  SIZE=$(du -h "$FILE" | cut -f1)
  echo "$(date): OK $FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"
else
  rm -f "$FILE"
  echo "$(date): FAIL" >> "$BACKUP_DIR/backup.log"
  exit 1
fi

# Оставить последние N бэкапов
ls -t "$BACKUP_DIR"/pg_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null

exit 0
