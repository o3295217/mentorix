#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy 2>&1 || {
  echo "⚠️  Migration failed, but starting the app anyway..."
}

echo "✅ Starting the application..."
exec "$@"
