# migration-demo — governed handoff

This repo demonstrates Rigorix Governed Handoff: a coding agent does normal
development freely, but **consequential operations are executed by Rigorix as
bounded, approved, auditable runbooks** — not by the agent directly.

## What the agent may do freely

- Edit TypeScript source (`src/`), add methods, write tests, run `npm test`,
  run `npx tsc --noEmit`, run `npm run db` (start docker compose).

## What the agent MUST hand off to Rigorix

Database schema changes (migrations) are critical. A PreToolUse hook denies
**direct DB-mutation tool calls**: psql / pg_dump / pg_restore / docker exec
against the payments DB, and Node/Python scripts that open a DB client with
write intents (ALTER/CREATE/DROP/TRUNCATE/INSERT/UPDATE/DELETE). Read-only
inspection (queries, column listing) is allowed. When a task requires a
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

## Enforcement boundary (say this plainly)

The hook governs **agent-mediated tool calls inside Claude Code**. It does not
govern arbitrary code execution with real credentials outside the session
(a human's shell, a CI runner, a background process) — that is a
sandbox/secrets boundary, not a hook boundary. The guarantee is: an agent
cannot silently mutate the payments schema from a Claude Code tool call; a
migration must hand off to Rigorix. This is a known arms race — the hook
scans the obvious surfaces (DB tools + script write intents), it is not an
airtight sandbox. Say exactly that to customers; do not imply more coverage
than exists.
