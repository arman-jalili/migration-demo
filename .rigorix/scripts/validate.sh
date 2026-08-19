#!/usr/bin/env bash
# Runbook step: validate preconditions.
# Fails unless: (1) customers table exists, (2) status column is ABSENT.
source .rigorix/scripts/_env.sh

if ! pg -tAc "SELECT to_regclass('public.customers')" | grep -q customers; then
  echo "FAIL: customers table does not exist"
  exit 1
fi
if pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='status'" | grep -q status; then
  echo "FAIL: status column already exists — nothing to migrate"
  exit 1
fi
echo "OK: customers table present, status column absent (preconditions hold)"
