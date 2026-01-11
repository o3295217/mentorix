#!/bin/bash
# Скрипт миграции на многопользовательскую схему
# ВНИМАНИЕ: Перед запуском создайте бэкап базы данных!

set -e

echo "=== AI Assistant: Миграция на многопользовательскую схему ==="
echo ""

# Проверяем, есть ли бэкап
if [ ! -f "backups/pre-multiuser-backup.db" ]; then
    echo "⚠️  Создайте бэкап базы данных перед миграцией!"
    echo "   Для локальной версии: cp prisma/dev.db backups/pre-multiuser-backup.db"
    echo ""
    read -p "Бэкап создан? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Миграция отменена. Создайте бэкап и повторите."
        exit 1
    fi
fi

echo ""
echo "Шаг 1: Проверка схемы..."
npx prisma validate
echo "✅ Схема валидна"

echo ""
echo "Шаг 2: Создание миграции..."
# Используем --create-only чтобы сначала проверить SQL
npx prisma migrate dev --name multiuser_support --create-only

echo ""
echo "⚠️  ВАЖНО: Проверьте сгенерированную миграцию в prisma/migrations/"
echo "   Убедитесь, что она не удаляет ваши данные!"
echo ""
read -p "Применить миграцию? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Миграция создана, но не применена."
    echo "Примените вручную: npx prisma migrate deploy"
    exit 0
fi

echo ""
echo "Шаг 3: Применение миграции..."
npx prisma migrate dev

echo ""
echo "Шаг 4: Регенерация Prisma клиента..."
npx prisma generate

echo ""
echo "=== Миграция завершена! ==="
echo ""
echo "Следующие шаги:"
echo "1. Добавьте в .env: AUTH_ENABLED=true"
echo "2. Задайте секрет: AUTH_SECRET=ваш-секретный-ключ"
echo "3. Перезапустите приложение"
echo ""
echo "Для регистрации первого пользователя:"
echo "1. Установите: REGISTRATION_MODE=open"
echo "2. Зайдите на /register"
echo "3. После регистрации установите: REGISTRATION_MODE=closed или invite"
