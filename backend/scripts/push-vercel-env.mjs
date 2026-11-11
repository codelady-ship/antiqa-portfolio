// Copies the variables from backend/.env to the linked Vercel project (Production) WITHOUT printing values.
// Run from backend/:  node scripts/push-vercel-env.mjs        (add --dry-run to only list the names)
// Needs: `npx vercel login` done and backend/.vercel/project.json present (`npx vercel link`).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SKIP = new Set(["PORT"]); // Vercel sets its own port
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(".env")) fail("backend/.env not found — run this from the backend folder.");
if (!existsSync(".vercel/project.json")) fail("Not linked to Vercel — run `npx vercel link` in backend/ first.");

const vars = [];
for (const raw of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let [, name, value] = m;
  if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1); // KEY="value" or KEY='value'
  else value = value.replace(/\s+#.*$/, ""); // inline comment after an unquoted value
  if (!value || SKIP.has(name)) continue;
  vars.push({ name, value });
}
if (!vars.length) fail("No non-empty variables in .env.");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args, input) =>
  // names are validated above ([A-Za-z0-9_]); values only go through stdin, never argv or output
  spawnSync(npx, ["vercel", ...args], { input, encoding: "utf8", shell: process.platform === "win32" });

let failed = 0;
for (const { name, value } of vars) {
  if (dryRun) {
    console.log(`would set ${name}`);
    continue;
  }
  run(["env", "rm", name, "production", "--yes"]); // ignore "not found"; makes the script re-runnable
  const r = run(["env", "add", name, "production"], value);
  if (r.status === 0) console.log(`✓ ${name}`);
  else {
    failed++;
    // print only Vercel's own error lines (they never contain the value, which went through stdin)
    console.error(`✗ ${name}: ${(r.stderr || "").split(/\r?\n/).filter((l) => /error/i.test(l)).join(" ") || `exit ${r.status}`}`);
  }
}
if (!dryRun) {
  console.log(failed ? `${failed} variable(s) failed.` : "Done. Redeploy so the API picks them up:  npx vercel --prod");
}
process.exit(failed ? 1 : 0);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
