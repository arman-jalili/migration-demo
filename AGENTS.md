# migration-demo — governed handoff (Codex)

This repo demonstrates Rigorix Governed Handoff: a coding agent does normal
development freely, but **consequential operations are executed by Rigorix as
bounded, approved, auditable runbooks** — not by the agent directly.

Read `CLAUDE.md` for the full demo narrative; the runbook and enforcement
boundary it describes apply unchanged to Codex.

## What the agent may do freely

- Edit TypeScript source (`src/`), add methods, write tests, run `npm test`,
  run `npx tsc --noEmit`, run `npm run db` (start docker compose).

## What the agent MUST hand off to Rigorix

Database schema changes (migrations) are critical. A PreToolUse hook in
`.codex/config.toml` (the same `deny-migration.mjs` script Claude Code uses)
blocks **direct DB-tool invocation, period** — psql / pg_dump / pg_restore /
mysql / sqlite3 / docker exec against the payments DB, whether the command
reads or writes. This is deliberate: parsing a `psql -c` string to tell a read
from a write is fragile (chained statements, `psql -f` files), so the boundary
is "no direct DB tools — use Rigorix", not "no direct DB writes".

Read-only inspection IS allowed, but via the sanctioned path: a Node/Python
script that opens a DB client (pg/psycopg/sqlalchemy) with **no write
intents** (no ALTER/CREATE/DROP/TRUNCATE/INSERT/UPDATE/DELETE) — the hook
scans the script and lets read-only inspection through. When a task requires
a migration, use the Rigorix MCP tools instead:

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

Run `codex` in this directory and say:

> "Add a `findByStatus` method to CustomerRepo in src/customers.ts that returns
> customers by status — then migrate the customers table to add the status
> column."

The agent writes the method and its test (allowed), then attempts the
migration — the hook denies direct DB access, and the agent hands the
migration to Rigorix. The runbook pauses at the production switch; the human
approves; the runbook finishes; the feature's tests go green because the
column now exists.

## Codex-specific setup notes

- MCP: `[mcp_servers.rigorix-mcp]` in `.codex/config.toml`, pointing at the
  cargo-installed `rigorix-mcp` binary with the repo root as `cwd`. The same
  server is also registered in `~/.codex/config.toml` so the desktop app's MCP
  server list shows it in every project; the repo copy keeps the setup
  self-contained for anyone who clones it.
- Hook: `[[hooks.PreToolUse]]` in `.codex/config.toml` runs the same
  `deny-migration.mjs` script Claude Code runs, so both agents share one
  enforcement boundary.
- Approval: `approval_policy = "never"` mirrors the Claude Code permission
  allowlist — Bash runs without prompts and the hook is the gatekeeper.
  Flip it in `.codex/config.toml` if you prefer approval prompts.
- Hook contract: the script emits the deny decision as stdout JSON (Claude
  Code) and as the stderr blocking reason with exit code 2 (Codex), so one
  file enforces the boundary in both agents.

## Enforcement boundary (say this plainly)

The hook governs **agent-mediated tool calls inside Codex**. It does not
govern arbitrary code execution with real credentials outside the session
(a human's shell, a CI runner, a background process) — that is a
sandbox/secrets boundary, not a hook boundary. The guarantee is: an agent
cannot silently mutate the payments schema from a Codex tool call; a
migration must hand off to Rigorix. This is a known arms race — the hook
scans the obvious surfaces (direct DB tools + script write intents), it is not
an airtight sandbox. Say exactly that to customers; do not imply more coverage
than exists.
