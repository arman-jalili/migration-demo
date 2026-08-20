#!/usr/bin/env bash
# Runbook step: verify the rollback restored the pre-migration state.
# Must succeed when the status column is ABSENT (back to baseline).
source .rigorix/scripts/_env.sh

if pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='status'" | grep -q status; then
  echo "FAIL: status column still present — rollback did not land"
  exit 1
fi
echo "VERIFIED: customers.status is absent — pre-migration state restored"
