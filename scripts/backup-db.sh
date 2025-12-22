#!/bin/bash

# Ежедневный бэкап базы данных AI Assistant
# Хранит последние 30 бэкапов

DB_PATH="/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec/prisma/dev.db"
BACKUP_DIR="/Users/oleggluskov/Documents/GooglDisk/ai-assistant-spec/backups"
MAX_BACKUPS=30

# Создать папку для бэкапов
mkdir -p "$BACKUP_DIR"

# Проверить существование базы
if [ ! -f "$DB_PATH" ]; then
    echo "$(date): Database not found at $DB_PATH" >> "$BACKUP_DIR/backup.log"
    exit 1
fi

# Имя файла с датой и временем
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/dev_${TIMESTAMP}.db"

# Копировать базу (используем sqlite3 для безопасного бэкапа)
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    cp "$DB_PATH" "$BACKUP_FILE"
fi

# Проверить успешность
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "$(date): Backup created: $BACKUP_FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"
else
    echo "$(date): Backup FAILED" >> "$BACKUP_DIR/backup.log"
    exit 1
fi

# Удалить старые бэкапы (оставить последние MAX_BACKUPS)
cd "$BACKUP_DIR"
ls -t dev_*.db 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -I {} rm -- {}

echo "$(date): Cleanup done. Keeping last $MAX_BACKUPS backups." >> "$BACKUP_DIR/backup.log"
