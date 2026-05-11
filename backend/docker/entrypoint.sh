#!/bin/sh
set -e

echo "[backend] Ensuring database schema..."
until npx prisma db push; do
  echo "[backend] Schema sync failed, retrying in 3s..."
  sleep 3
done

echo "[backend] Starting server..."
exec node dist/index.js
