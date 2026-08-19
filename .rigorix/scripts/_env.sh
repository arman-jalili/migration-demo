#!/usr/bin/env bash
# Shared connection helper for the migration-demo runbook.
# Container: rgx-migration-db  ·  DB: payments  ·  port 5433 (host)
set -e
export PG_CONTAINER="${PG_CONTAINER:-rgx-migration-db}"
export PG_DB="${PG_DB:-payments}"
export PG_USER="${PG_USER:-postgres}"

pg() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" "$@"; }
