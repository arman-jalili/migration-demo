#!/usr/bin/env bash
# Runbook step: record the migration as applied (final evidence).
source .rigorix/scripts/_env.sh

pg -c "INSERT INTO migration_log (name) VALUES ('add-status-column')"
echo "RECORDED: migration_log row for add-status-column"
