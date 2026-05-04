#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
if ! node ./node_modules/prisma/build/index.js migrate deploy 2>&1; then
	echo "❌ Prisma migration failed — refusing to start" >&2
	exit 1
fi

echo "✅ Starting the application..."
exec "$@"
