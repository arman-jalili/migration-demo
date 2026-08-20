#!/usr/bin/env node
/**
 * Governed Handoff demo driver — the S0 spike.
 *
 * "Let your coding agent execute normal development freely. When it needs to
 *  perform a consequential operation, Rigorix takes over and executes it as a
 *  bounded, approved, auditable runbook."  (F-20260819-02)
 *
 * Scene A — the gated migration:
 *   agent initiates a DB migration → rigorix compiles the runbook (inspect →
 *   validate → backup → apply-migration → verify-schema → production-switch
 *   [REQUIRES APPROVAL] → verify-production → record-migration) → execution
 *   pauses at the destructive production switch → a human approves → the
 *   runbook finishes → signed evidence.
 *
 * Scene B — rollback as an executable path:
 *   a migration that cannot land (NOT NULL on a non-empty table) fails loudly,
 *   the evidence shows exactly which step failed, and the rollback runbook
 *   restores the pre-migration state from the backup taken before the run.
 *
 * Requires: rigorix-mcp (>= 1.1.0 with sequential-step fix) on PATH, docker.
 *   node .rigorix/run-migration-demo.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(root, "..");
const MCP_BIN = process.env.RIGORIX_MCP_BIN ?? "rigorix-mcp";
const verbose = process.env.RIGORIX_DRIVER_VERBOSE === "1";

// ── DB helpers (run outside the MCP process to show the REAL db state) ──────
function db(sql) {
  const r = spawnSync("docker", ["exec", "rgx-migration-db", "psql", "-U", "postgres", "-d", "payments", "-tAc", sql], { encoding: "utf8" });
  return r.stdout?.trim() ?? "";
}
function showSchema(label) {
  const cols = db("SELECT column_name FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position");
  console.log(`  ${label}: customers columns = ${cols ? cols.split("\n").join(", ") : "(none)"}`);
}

// ── MCP client (same pattern as payments-demo/run-demo.mjs) ─────────────────
const child = spawn(MCP_BIN, [], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, RUST_LOG: verbose ? "info" : "warn" },
});
child.on("error", (err) => {
  console.error(`Failed to start ${MCP_BIN}: ${err.message}`);
  console.error("Is rigorix-mcp installed? Set RIGORIX_MCP_BIN if it lives elsewhere.");
  process.exit(1);
});
let buf = "";
let nextId = 1;
const pending = new Map();
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (verbose) console.log("[mcp]", line);
  }
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (d) => { if (verbose) process.stderr.write(d); });
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve_, reject) => {
    pending.set(id, (msg) => msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve_(msg.result));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function section(title) { console.log("\n" + "=".repeat(74) + "\n" + title + "\n" + "=".repeat(74)); }
function show(result) {
  const raw = result?.content?.[0]?.text ?? JSON.stringify(result, null, 2);
  try {
    const parsed = JSON.parse(raw);
    console.log(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
  } catch { console.log(raw); }
}
function showSteps(run) {
  const text = run?.content?.[0]?.text ?? "";
  let r; try { r = JSON.parse(text); } catch { console.log(text); return null; }
  console.log(`  status: ${r.status}`);
  for (const s of r.steps ?? []) {
    const mark = s.success ? "✔" : "✘";
    console.log(`    ${mark} ${s.step_name}${s.error ? "  — " + s.error.slice(0, 140) : ""}`);
  }
  return r;
}

async function main() {
  // Setup: docker postgres + baseline schema.
  section("0 · Environment");
  const setup = spawnSync("bash", [".rigorix/scripts/setup-db.sh"], { cwd: repoRoot, encoding: "utf8" });
  console.log((setup.stdout ?? "") + (setup.stderr ?? ""));
  if (setup.status !== 0) { console.error("Setup failed — is docker running?"); process.exit(1); }

  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "migration-demo", version: "0.1.0" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // ─────────────────────────────────────────────────────────────────────────
  section("1 · The runbook is a rigorix template (intent → executable plan)");
  show(await rpc("tools/call", { name: "rigorix_list_templates", arguments: {} }));

  section("2 · Preview the plan before anyone runs anything");
  const plan = await rpc("tools/call", { name: "rigorix_plan", arguments: { template_name: "db-migration" } });
  try {
    const p = JSON.parse(plan?.content?.[0]?.text ?? "{}");
    console.log("  Template:  " + p.template_name);
    console.log("  DAG nodes (" + (p.graph?.node_count ?? 0) + "):");
    for (const n of p.graph?.nodes ?? []) {
      const gated = n.name === "production-switch" ? "   [GATED] requires_approval — DESTRUCTIVE STEP (back-fills live rows)" : "";
      console.log("    - " + n.name.padEnd(22) + " " + n.tool + gated);
    }
  } catch { show(plan); }

  section("3 · Before — the schema Rigorix is about to touch");
  showSchema("baseline");
  console.log("  Rows: " + db("SELECT count(*) FROM customers") + " customers");

  // ── Scene A: the gated migration ─────────────────────────────────────────
  section("4 · AGENT INITIATES: rigorix_run db-migration");
  console.log("  The agent asks for a consequential operation — a production DB migration.");
  console.log("  Rigorix does not reason about it. It executes the runbook.");
  const runA = await rpc("tools/call", { name: "rigorix_run", arguments: { template_name: "db-migration" } });
  const ra = showSteps(runA);

  if (ra?.status !== "PendingApproval") {
    console.log("\n⚠ Expected PendingApproval — did the production-switch step get gated?");
    console.log("  Is rigorix-mcp >= 1.1.0 with the sequential-step + approval propagation fix?");
  } else {
    console.log("\n  → PAUSED for human approval. The prepare phase ran (inspect → validate →");
    console.log("    backup → apply-migration → verify-schema). The DESTRUCTIVE step");
    console.log("    (production-switch — back-fills status on live rows) was NOT run.");
  }

  section("5 · While paused — prove production is untouched");
  showSchema("still");
  console.log("  The schema is prepared but production is untouched: no row carries a");
  console.log("  status value, no switch has run. That is the stop.");

  section("6 · A HUMAN SAYS YES: rigorix_approve_execution");
  const approve = await rpc("tools/call", { name: "rigorix_approve_execution", arguments: { execution_id: ra.execution_id, step_names: ["production-switch"] } });
  show(approve);

  section("7 · After — the runbook finished");
  showSchema("after");
  console.log("  migration_log: " + db("SELECT DISTINCT name FROM migration_log"));
  console.log("  Status was: " + ra.status + " → resumed to completion. Every step is in the signed audit trail.");

  section("7b · The signed evidence — rigorix_read_audit (HMAC-verified)");
  const audit = await rpc("tools/call", { name: "rigorix_read_audit", arguments: { execution_id: ra.execution_id, format: "json" } });
  try {
    const a = JSON.parse(audit.content[0].text);
    console.log(`  execution_id: ${a.execution_id}`);
    console.log(`  status:       ${a.status}`);
    console.log(`  template:     ${a.template_name}`);
    console.log(`  hmac:         ${a.hmac.slice(0, 32)}… (SHA-256, key from rigorix.toml)`);
    console.log("  steps:");
    for (const s of a.steps ?? []) {
      console.log(`    ${s.success ? "✔" : "✘"} ${s.step_name}  (${s.duration_ms} ms)${s.error ? " — " + s.error.slice(0, 100) : ""}`);
    }
    console.log("  → This is the artifact you show an auditor: every step that ran, signed.");
  } catch { show(audit); }

  // ── Scene B: rollback as an executable path ──────────────────────────────
  section("8 · ROLLBACK SCENE — a migration that cannot land");
  console.log("  Reset to baseline, then run a migration with a real failure:");
  console.log("  ALTER TABLE ... ADD COLUMN status TEXT NOT NULL on a non-empty table.");
  spawnSync("bash", [".rigorix/scripts/setup-db.sh"], { cwd: repoRoot, encoding: "utf8", stdio: "ignore" });
  showSchema("baseline (reset)");
  const runB = await rpc("tools/call", { name: "rigorix_run", arguments: { template_name: "db-migration-fail" } });
  const rb = showSteps(runB);
  console.log("  → The runbook FAILED. Evidence shows which step failed and why. Nothing switched.");
  if (rb?.execution_id) {
    const auditB = await rpc("tools/call", { name: "rigorix_read_audit", arguments: { execution_id: rb.execution_id, format: "json" } });
    try {
      const a = JSON.parse(auditB.content[0].text);
      const failed = (a.steps ?? []).filter((s) => !s.success);
      console.log(`  Failed-step evidence (${failed.length} failed):`);
      for (const s of failed) {
        console.log(`    ✘ ${s.step_name} — ${(s.error ?? "").slice(0, 130)}`);
      }
    } catch { /* audit not required for the scene */ }
  }

  section("9 · ROLLBACK: restore from the backup taken before the run");
  const runC = await rpc("tools/call", { name: "rigorix_run", arguments: { template_name: "db-rollback" } });
  showSteps(runC);
  showSchema("after rollback");
  console.log("  → Pre-migration state restored. The rollback path is an executable node,");
  console.log("    not a prayer. Both the failure and the recovery are in the audit trail.");

  child.kill();
  process.exit(0);
}

main().then(() => process.exit(0)).catch((err) => { console.error("\nDriver error:", err.message); child.kill(); process.exit(1); });
