# migration-demo — governed handoff

This repo demonstrates Rigorix Governed Handoff: a coding agent does normal
development freely, but **consequential operations are executed by Rigorix as
bounded, approved, auditable runbooks** — not by the agent directly.

## What the agent may do freely

- Edit TypeScript source (`src/`), add methods, write tests, run `npm test`,
  run `npx tsc --noEmit`, run `npm run db` (start docker compose).

## What the agent MUST hand off to Rigorix

Database schema changes (migrations) are critical. A PreToolUse hook denies
direct `psql` / `docker exec` / `ALTER TABLE` commands. When a task requires a
migration, use the Rigorix MCP tools instead:

1. `rigorix_run` with `template_name: "db-migration"` — executes the governed
   runbook: inspect → validate → backup → **production switch (APPROVAL
   REQUIRED)** → verify → record. It pauses at the destructive step.
2. When it reports `PendingApproval`, tell the user Rigorix wants approval for
   the production switch. The user (or the agent, on explicit instruction)
   calls `rigorix_approve_execution` with `execution_id` and the pending step
   name (`production-switch`).
3. After resume, confirm the run completed and the schema changed.
4. If a migration fails, hand off to `db-rollback` to restore from backup.

## Demo script for a human

Run `claude` in this directory and say:

> "Add a `findByStatus` method to CustomerRepo in src/customers.ts that returns
> customers by status — then migrate the customers table to add the status
> column."

The agent writes the method and its test (allowed), then attempts the migration
— the hook denies direct DB access, and the agent hands the migration to
Rigorix. The runbook pauses at the production switch; the human approves; the
runbook finishes; the feature's tests go green because the column now exists.
