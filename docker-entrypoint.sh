#!/bin/sh
set -e

echo "🔄 Running Prisma db push..."
node ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || {
  echo "⚠️  DB push failed, but starting the app anyway..."
}

echo "✅ Starting the application..."
exec "$@"
