#!/usr/bin/env bash
# Runbook step: backup the database before the destructive step.
source .rigorix/scripts/_env.sh

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="/backups/payments_${STAMP}.sql"
docker exec "$PG_CONTAINER" sh -c "mkdir -p /backups && pg_dump -U $PG_USER -d $PG_DB -f '$FILE'"
echo "BACKUP: $FILE"
