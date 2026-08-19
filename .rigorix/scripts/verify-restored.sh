#!/usr/bin/env bash
# Runbook step: verify the rollback restored the pre-migration state.
# Must succeed when the email column is ABSENT (back to baseline).
source .rigorix/scripts/_env.sh

if pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='email'" | grep -q email; then
  echo "FAIL: email column still present — rollback did not land"
  exit 1
fi
echo "VERIFIED: customers.email is absent — pre-migration state restored"
