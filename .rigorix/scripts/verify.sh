#!/usr/bin/env bash
# Runbook step: verify the migration landed.
source .rigorix/scripts/_env.sh

if pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='status'" | grep -q status; then
  echo "VERIFIED: customers.status exists"
else
  echo "FAIL: customers.status does not exist"
  exit 1
fi
