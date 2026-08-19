#!/usr/bin/env bash
# Runbook step: THE DESTRUCTIVE STEP — gated behind human approval.
# Adds the email column to customers.
source .rigorix/scripts/_env.sh

pg -v ON_ERROR_STOP=1 -c "ALTER TABLE customers ADD COLUMN email TEXT"
echo "MIGRATED: ALTER TABLE customers ADD COLUMN email TEXT"
