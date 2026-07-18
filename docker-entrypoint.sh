#!/bin/sh
set -e

echo "🔒 Validating public app URL..."
node /app/scripts/validate-public-app-url.mjs "${NEXT_PUBLIC_APP_URL:-}" --equals "${BUILT_NEXT_PUBLIC_APP_URL:-}"

echo "🔄 Running Prisma migrations..."
if ! node ./node_modules/prisma/build/index.js migrate deploy 2>&1; then
	echo "❌ Prisma migration failed — refusing to start" >&2
	exit 1
fi

echo "✅ Starting the application..."
exec "$@"
