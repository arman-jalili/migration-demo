#!/usr/bin/env bash
# Driver helper: bring up postgres via docker compose + baseline schema, idempotent.
set -e
source .rigorix/scripts/_env.sh

echo "Starting postgres (docker compose) ..."
docker compose up -d postgres

for i in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then break; fi
  sleep 1
done

# Baseline schema (only if customers table is absent — keeps re-runs clean).
if ! docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT to_regclass('public.customers')" | grep -q customers; then
  docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 < schema/001_init.sql >/dev/null
fi
# Baseline state: status column must be ABSENT and the migration log clean.
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c "ALTER TABLE customers DROP COLUMN IF EXISTS status" >/dev/null
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c "TRUNCATE migration_log" >/dev/null 2>&1 || true
echo "postgres ready: localhost:5433/$PG_DB (${PG_CONTAINER}), baseline = no status column"
