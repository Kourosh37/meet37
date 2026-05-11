#!/bin/sh
set -e

echo "[backend] Applying database migrations..."
until npx prisma migrate deploy; do
  echo "[backend] Migration failed, retrying in 3s..."
  sleep 3
done

echo "[backend] Starting server..."
exec node dist/index.js
