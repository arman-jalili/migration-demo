#!/usr/bin/env bash
# Runbook step: inspect the current customers schema (read-only).
source .rigorix/scripts/_env.sh

echo "Schema of customers:"
pg -tAc "SELECT column_name || ' ' || data_type FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position"
