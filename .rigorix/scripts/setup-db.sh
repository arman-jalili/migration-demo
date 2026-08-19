#!/usr/bin/env bash
# Driver helper: bring up postgres + baseline schema, idempotent.
set -e
source .rigorix/scripts/_env.sh

if ! docker ps -a --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
  echo "Starting postgres container ${PG_CONTAINER} ..."
  docker run -d --name "$PG_CONTAINER" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$PG_DB" -p 5433:5432 postgres:16-alpine >/dev/null
else
  echo "Container ${PG_CONTAINER} already exists (starting if stopped) ..."
  docker start "$PG_CONTAINER" >/dev/null 2>&1 || true
fi

for i in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then break; fi
  sleep 1
done

# Baseline schema (only if customers table is absent — keeps re-runs clean).
if ! docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT to_regclass('public.customers')" | grep -q customers; then
  docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 < schema/001_init.sql >/dev/null
fi
# Baseline state: email column must be ABSENT for the migration story, and the
# migration log must be clean for re-runs.
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c "ALTER TABLE customers DROP COLUMN IF EXISTS email" >/dev/null
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c "TRUNCATE migration_log" >/dev/null 2>&1 || true
echo "postgres ready: localhost:5433/$PG_DB (${PG_CONTAINER}), baseline = no email column"
