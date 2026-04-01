#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy 2>&1

echo "✅ Starting the application..."
exec "$@"
