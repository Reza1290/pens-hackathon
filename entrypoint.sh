#!/bin/sh
set -e

echo "Starting application initialization..."

# Wait for PostgreSQL to be ready
until pg_isready -h db -U kasirnusa -d kasirnusa 2>/dev/null || node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => { client.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Waiting for database to be ready..."
  sleep 2
done

echo "Database is ready. Running migrations..."
npm run db:migrate

echo "Seeding default auth accounts..."
npm run auth:seed || true

DATASET_ID="93bb692a-2168-5ef3-a37d-8e929f9b6340"
AS_OF="2026-10-01"

if [ -f "data/manifests/kasirnusa-2026-10-01.json" ] && [ -d "data/raw" ]; then
  echo "Preparing dataset..."
  npm run data:prepare -- --manifest data/manifests/kasirnusa-2026-10-01.json || true
  echo "Importing dataset..."
  npm run data:import -- --manifest data/manifests/kasirnusa-2026-10-01.json || true
  echo "Analyzing dataset..."
  npm run data:analyze -- --dataset "$DATASET_ID" --as-of "$AS_OF" || true
  echo "Diagnosing stakeholders..."
  npm run data:diagnose -- --dataset "$DATASET_ID" || true
fi

echo "Starting KasirNusa server on port ${API_PORT:-3001}..."
exec node apps/api/dist/server.js