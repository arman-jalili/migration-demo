#!/usr/bin/env bash
# Runbook step: switch — record the migration as applied.
# Only succeeds if the email column actually exists (honest switch).
source .rigorix/scripts/_env.sh

if ! pg -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='email'" | grep -q email; then
  echo "FAIL: cannot switch — migration never landed"
  exit 1
fi
pg -c "INSERT INTO migration_log (name) VALUES ('add-email-column')"
echo "SWITCHED: migration logged in migration_log"
