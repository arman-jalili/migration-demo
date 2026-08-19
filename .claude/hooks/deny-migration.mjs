// Claude Code PreToolUse hook — the "stick".
// Denies only commands that actually MUTATE the database schema directly
// (psql/docker against the payments DB, ALTER/CREATE/DROP TABLE, pg_dump/
// pg_restore). Benign commands mentioning "migration" in a path (ls, grep,
// cat, node) pass through.
//
// stdin:  { tool_name, tool_input, ... }
// stdout: { hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason } }
// exit code 2 = block the tool call.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name ?? "";
const cmd = String(input.tool_input?.command ?? input.tool_input?.description ?? "");

// Only Bash commands can mutate the DB.
if (tool !== "Bash") {
  process.exit(0);
}

// A command is a DB mutation if it invokes a schema-mutating statement or
// a DB admin tool against our database. Path mentions of "migration" in a
// read/explore command must NOT trip this.
const MUTATION_PATTERNS = [
  /\bALTER TABLE\b/i,
  /\bCREATE TABLE\b/i,
  /\bDROP TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bADD COLUMN\b/i,
  /psql\b/i,
  /pg_dump\b/i,
  /pg_restore\b/i,
  /docker exec.*(psql|pg_dump|pg_restore)/i,
];

const isMutation = MUTATION_PATTERNS.some((re) => re.test(cmd));

if (!isMutation) {
  // Not a DB-mutation command — allow through (exploration, tests, edits).
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
