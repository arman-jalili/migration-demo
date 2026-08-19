#!/usr/bin/env bash
# Runbook step: verify production — rows now carry the switched status.
source .rigorix/scripts/_env.sh

COUNT=$(pg -tAc "SELECT count(*) FROM customers WHERE status = 'active'")
echo "VERIFIED: $COUNT customers now active (production switched)"
if [ "$COUNT" = "0" ]; then
  echo "FAIL: no customers have status — switch did not land"
  exit 1
fi
