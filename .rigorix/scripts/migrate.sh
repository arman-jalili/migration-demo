#!/usr/bin/env bash
# Runbook step: apply the migration (non-destructive prepare phase — the
# column is added but not yet exposed to production; the PRODUCTION SWITCH
# step, gated behind human approval, flips it live).
source .rigorix/scripts/_env.sh

pg -v ON_ERROR_STOP=1 -c "ALTER TABLE customers ADD COLUMN status TEXT"
echo "APPLIED: ALTER TABLE customers ADD COLUMN status TEXT"
