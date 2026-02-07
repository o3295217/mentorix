#!/bin/bash

# Ежедневный бэкап базы данных AI Assistant (PostgreSQL)
# Хранит последние 30 бэкапов
#
# Использование:
#   ./scripts/backup-db.sh
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
MAX_BACKUPS=30

# Берём DATABASE_URL из .env.local если не задан
if [ -z "$DATABASE_URL" ] && [ -f "$PROJECT_DIR/.env.local" ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "$PROJECT_DIR/.env.local" | head -1 | cut -d'=' -f2- | tr -d '"')
fi

if [ -z "$DATABASE_URL" ]; then
    echo "$(date): ERROR — DATABASE_URL not set" | tee -a "$BACKUP_DIR/backup.log"
    exit 1
fi

# Создать папку для бэкапов
mkdir -p "$BACKUP_DIR"

# Имя файла с датой и временем
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz"

echo "$(date): Starting backup..."

# pg_dump с gzip-сжатием
pg_dump "$DATABASE_URL" --no-owner --no-acl 2>/dev/null | gzip > "$BACKUP_FILE"

# Проверить успешность
if [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "$(date): Backup created: $BACKUP_FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"
else
    rm -f "$BACKUP_FILE"
    echo "$(date): Backup FAILED — pg_dump returned empty result. Check DATABASE_URL." | tee -a "$BACKUP_DIR/backup.log"
    exit 1
fi

# Удалить старые бэкапы (оставить последние MAX_BACKUPS)
cd "$BACKUP_DIR"
ls -t pg_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -I {} rm -- {}

echo "$(date): Cleanup done. Keeping last $MAX_BACKUPS backups." >> "$BACKUP_DIR/backup.log"
