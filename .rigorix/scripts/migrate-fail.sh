#!/usr/bin/env bash
# Runbook step (failure scene): a migration that CANNOT land.
# Adding a NOT NULL column to a table with existing rows (3 customers)
# without a default fails in Postgres — a real, realistic migration failure.
source .rigorix/scripts/_env.sh

echo "Attempting ALTER TABLE customers ADD COLUMN email TEXT NOT NULL ..."
if pg -v ON_ERROR_STOP=1 -c "ALTER TABLE customers ADD COLUMN email TEXT NOT NULL" 2>/tmp/migrate-fail.err; then
  echo "UNEXPECTED: migration succeeded"
  exit 0
else
  echo "FAILED: $(head -c 200 /tmp/migrate-fail.err | tr '\n' ' ')"
  exit 1
fi
