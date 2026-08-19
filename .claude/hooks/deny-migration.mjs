// The task the agent must NOT do directly: touching the database schema.
// Claude Code PreToolUse hook — the "stick". If the agent tries to run a
// migration against the DB itself, this hook DENIES it and points at Rigorix.
//
// stdin:  { tool_name, tool_input, ... }
// stdout: { hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason } }
// exit code 2 = block the tool call.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name ?? "";
const cmd = String(input.tool_input?.command ?? input.tool_input?.description ?? "");

// Any command that mutates the payments schema outside Rigorix is denied.
const MIGRATION_PATTERNS = [
  /ALTER TABLE/i,
  /CREATE TABLE/i,
  /DROP TABLE/i,
  /ADD COLUMN/i,
  /psql/i,
  /pg_dump/i,
  /pg_restore/i,
  /docker exec/i,
  /migration/i,
];

const blocked = MIGRATION_PATTERNS.some((re) => re.test(cmd));

if (!blocked || tool !== "Bash") {
  // Not a DB-mutation command — allow through.
  process.exit(0);
}

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Database migrations are critical operations governed by Rigorix. " +
        "Do not run psql/docker migration commands directly. " +
        "Hand off to Rigorix: call rigorix_run with template_name 'db-migration' " +
        "(or 'db-rollback' to restore), then rigorix_approve_execution when it pauses.",
    },
  }),
);
process.exit(2);
