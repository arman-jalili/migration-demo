# The migration, the stop, and the signature

A three-minute, fully local demo. A coding agent initiates a production database migration. Rigorix takes over and executes it as a bounded, approved, auditable runbook — pausing for a human before the destructive step (the production switch), proving production is untouched while paused, and producing a signed, timestamped record of every step. Then a migration that *cannot* land fails loudly, and the rollback runbook restores the pre-migration state from the backup taken before the run.

One command. Docker only. No API keys. No network.

```bash
git clone <this repo>
cd migration-demo
node .rigorix/run-migration-demo.mjs
```

---

## The one-minute story

A payments service runs on Postgres. A migration needs to land: `ALTER TABLE customers ADD COLUMN status TEXT`.

An agent — Claude Code, Cursor, any MCP speaker — initiates the migration. Under Rigorix, that is not a free action. It is a **governed handoff**: the agent's intent is compiled into a template-constrained runbook, and Rigorix holds the execution.

The runbook is eight nodes, and the sixth one — the production switch — is gated:

```
inspect-schema ──▶ validate-preconditions ──▶ backup ──▶ apply-migration ──▶ verify-schema ──▶ production-switch [REQUIRES APPROVAL] ──▶ verify-production ──▶ record-migration
```

The first five nodes run: inspect, validate, backup, apply-migration, verify-schema. The backup is real. Then execution **stops** at `production-switch` — the step that back-fills `status` on the live rows — because it is marked `requires_approval = true`.

While it is paused, production is provably untouched: the `status` column exists in the prepare phase, but no row carries a value and no switch has run. That is not a warning. It is a stop.

A human looks at the pending step and says yes. Execution resumes. The switch back-fills `status` on the live rows. Verify-production confirms them. Record writes the migration to the log. Every step — including the pause and the approval — is in a signed audit envelope.

## The rollback scene

Then the demo shows what happens when a migration *cannot* land: `ALTER TABLE ... ADD COLUMN status TEXT NOT NULL` on a table with three existing rows. Postgres refuses — a real, realistic failure.

The runbook fails. The evidence records exactly which step failed and why, and the `switch` node refuses to run because the migration never landed. Nothing is half-applied.

The rollback runbook restores the database from the backup taken *before* the run, and verifies the pre-migration state. The rollback path is an executable node — not a prayer. The failure and the recovery are both in the audit trail.

---

## What the demo proves

1. **The stop is real.** `requires_approval` pauses the runbook at the destructive step — the production switch. Production is untouched while paused: the column exists in the prepare phase, but no row carries a value (verified with live queries, not claims).
2. **Execution is deterministic and sequential.** Steps run in order — validate before backup, backup before apply-migration, apply-migration before the switch. The migration cannot race ahead of its own backup.
3. **Rollback is an executable path.** The restore-from-backup runbook is a real template with its own verify node.
4. **Evidence is per-step.** Every node's result — success or failure — is recorded; a failed step's error is in the record, and a failed migration cannot "switch".

## What the demo is *not*

- Not a simulation. The `ALTER TABLE` is real; the backup is a real `pg_dump`; the failure is Postgres refusing a real statement.
- Not a video. One command, run on a real machine, in the open — same principle as the payments-demo boundary demo.
- Not a dashboard. The human approval surface is the `rigorix_approve_execution` tool — the same tool an agent or a human would call.

---

## How it works

- **Templates** (`.rigorix/templates/*.toml`) — plain TOML runbooks. `db-migration` is the gated happy path; `db-migration-fail` is the failure scene; `db-rollback` is the recovery path.
- **Scripts** (`.rigorix/scripts/*.sh`) — each runbook step is a real shell step against a dockerized Postgres.
- **Driver** (`.rigorix/run-migration-demo.mjs`) — a minimal stdio MCP client that talks to `rigorix-mcp` and prints a clean, reproducible transcript.
- **Config** (`rigorix.toml`) — local-only: `permission_mode = "workspace_write"`, `audit_hmac_key` set so envelopes are signed locally.

Requires `rigorix-mcp >= 1.2.0` (installed via `cargo install rigorix-mcp`; budget enforcement on template runs + approval propagation), Docker, and nothing else.
