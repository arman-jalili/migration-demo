#!/usr/bin/env bash
# Runbook step: rollback — restore from the latest backup (a real node,
# not a prayer). Drops the schema and reloads the backup file.
source .rigorix/scripts/_env.sh

LATEST=$(docker exec "$PG_CONTAINER" sh -c "ls -t /backups/payments_*.sql 2>/dev/null | head -1" || true)
if [ -z "$LATEST" ]; then
  echo "FAIL: no backup found to restore"
  exit 1
fi
echo "RESTORE: reloading $LATEST"
docker exec "$PG_CONTAINER" sh -c "psql -U $PG_USER -d $PG_DB -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public' >/dev/null && psql -U $PG_USER -d $PG_DB -f '$LATEST' >/dev/null"
echo "RESTORED: schema reloaded from $LATEST"
