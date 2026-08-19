#!/usr/bin/env bash
# Runbook step: PRODUCTION SWITCH — the gated destructive step.
# Back-fills the new column on live rows, making the migration production-visible.
source .rigorix/scripts/_env.sh

if ! pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='status'" | grep -q status; then
  echo "FAIL: cannot switch — migration never landed"
  exit 1
fi
pg -v ON_ERROR_STOP=1 -c "UPDATE customers SET status = 'active' WHERE status IS NULL"
echo "SWITCHED: customers.status back-filled to 'active' — production now uses the migrated schema"
