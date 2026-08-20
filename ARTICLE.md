# The Agent Asked for a Migration. Rigorix Asked for a Human.
*One command. A real Postgres. A real ALTER TABLE. Watch it stop, watch it resume, watch it fail, watch it roll back.*

Everyone is talking about what AI agents can *do*. Nobody is talking about what happens when an agent decides to do something **consequential** — a database migration, a dependency upgrade, a production config change.

An agent reasons probabilistically. It can be confident and wrong. So who holds the execution when an agent decides to change production data?

Not a firewall. Not an API gateway. Not a log aggregator. Those observe what already happened. The question is: who **stops** the destructive action *before* it runs, and who can **prove** it was gated?

## The scenario

A payments service runs on Postgres. A migration needs to land: `ALTER TABLE customers ADD COLUMN status TEXT`.

A coding agent — Claude Code, Cursor, any MCP-capable assistant — initiates the migration. Under Rigorix that is not a free action. It is a **governed handoff**: the agent's intent is compiled into a template-constrained runbook, and Rigorix takes over the execution.

## Watch it stop

The runbook is eight nodes. The sixth one is gated:

```
inspect-schema ──▶ validate-preconditions ──▶ backup ──▶ apply-migration ──▶ verify-schema ──▶ production-switch [REQUIRES APPROVAL] ──▶ verify-production ──▶ record-migration
```

The first five nodes run: inspect, validate, backup, apply-migration, verify-schema. The backup is a real `pg_dump`; the migration is a real `ALTER TABLE` — applied in a reversible prepare phase.

Then execution **stops** at `production-switch` — the step that back-fills `status` on the live rows and exposes the new schema to production. It is marked `requires_approval = true`. The switch does not run.

While it is paused, I query the live database: the `status` column exists — prepared but empty — and no row carries a value. Production is untouched; the destructive back-fill has not run. That is not a warning. That is a **stop** — a deterministic pause in execution, proven with live queries.

## Watch it resume

A human — an engineer, an on-call, a DBA — looks at the pending step and says yes.

Execution resumes. The switch back-fills `status = 'active'` on the live rows. Verify-production confirms them. Record writes the migration to the log. Every step, including the pause and the approval, is in a signed audit envelope: execution id, status, per-step durations, and an HMAC-SHA256 signature over the canonical fields.

That envelope is the artifact you hand to an auditor. Not a screenshot of a dashboard — a signed, timestamped, step-level record of what ran and who said yes.

## Watch it fail

Then the demo shows what happens when a migration *cannot* land: `ALTER TABLE ... ADD COLUMN status TEXT NOT NULL` on a table with three existing rows. Postgres refuses — a real, realistic failure.

The runbook fails. The evidence records **exactly** which step failed and why. The `switch` node refuses to run because the migration never landed. Nothing is half-applied.

## Watch it roll back

The rollback runbook restores the database from the backup taken *before* the run, and verifies the pre-migration state.

The rollback path is an executable node — not a prayer. The failure and the recovery are both in the audit trail.

## Why this matters

Three things CI, firewalls, and GitHub Agentic Workflows cannot show you:

1. **A mid-run approval pause on the risky step** — not a pre-flight review, not a post-hoc log. Execution literally stops until a human signs off.
2. **A signed evidence chain per step** — tamper-evident, step-level, verifiable.
3. **A rollback path as executable nodes** — the recovery is a runbook, the same machinery that ran the migration.

Because Rigorix holds the execution. It doesn't watch the agent — it takes over for the consequential part, deterministically, bounded, with a human gate and a signature.

*One command. Run it on your own machine:*
```bash
node .rigorix/run-migration-demo.mjs
```
