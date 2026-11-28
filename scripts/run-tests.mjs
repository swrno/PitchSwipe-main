// Runs every test suite as its own `node --test` process and prints a pass/fail summary.
//
//   npm test                      all suites
//   npm test -- ratelimit seed    only the named suites
//
// Exits non-zero if any suite fails, reports no tests, or produces output that cannot be parsed.
//
// Discovery (no hard-coded file lists): every `tests/` folder under src/ is one suite named after its parent
// folder (src/features/swipe/tests -> "swipe", src/shared/lib/ai/tests -> "ai") and runs each `*.test.ts|mjs` in it.
// Script suites live beside their script: scripts/tests ("sw-routes"), scripts/seed ("seed"), scripts/db ("db-sync-indexes").
// src/shared/lib/ai/engine is a standalone JS package that runs its own `node --test` from its folder ("ai-engine").
// Special loader: a `tests/register.mjs` runs that suite's `.mjs` tests through its own module hook (decks) instead of the TS loader.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TS = ["--import", "./scripts/register-ts.mjs", "--test"];
const TEST_FILE = /\.test\.(ts|mjs)$/;
const SCRIPT_SUITES = { "scripts/tests": "sw-routes", "scripts/seed": "seed", "scripts/db": "db-sync-indexes" };

function testFiles(dir) {
  return readdirSync(path.join(root, dir)).filter((name) => TEST_FILE.test(name)).sort().map((name) => `${dir}/${name}`);
}

/** Every directory called `tests` under src/ (not inside the AI engine package), as repo-relative paths. */
function findTestDirs(dir = "src") {
  const found = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "engine") continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.name === "tests") found.push(rel);
    else found.push(...findTestDirs(rel));
  }
  return found.sort();
}

/** The standalone AI engine package (a folder called `engine` holding its own package.json). */
function findEngine(dir = "src") {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.name === "engine" && existsSync(path.join(root, rel, "package.json"))) return rel;
    const deeper = findEngine(rel);
    if (deeper) return deeper;
  }
  return null;
}

function buildSuites() {
  const suites = [];
  for (const dir of findTestDirs()) {
    const name = path.basename(path.dirname(dir));
    const files = testFiles(dir);
    const loader = existsSync(path.join(root, dir, "register.mjs")) ? `./${dir}/register.mjs` : null;
    if (!loader) { if (files.length) suites.push({ name, args: [...TS, ...files] }); continue; }
    const mjs = files.filter((f) => f.endsWith(".mjs")), ts = files.filter((f) => f.endsWith(".ts"));
    if (mjs.length) suites.push({ name, args: ["--import", loader, "--test", ...mjs] });
    if (ts.length) suites.push({ name: `${name}-ts`, args: [...TS, ...ts] });
  }
  for (const [dir, name] of Object.entries(SCRIPT_SUITES)) suites.push({ name, args: [...TS, ...testFiles(dir)] });
  const engine = findEngine();
  if (engine) suites.push({ name: "ai-engine", cwd: engine, args: ["--test"] });
  return suites;
}

export const SUITES = buildSuites();

/** Reads the node:test summary lines ("ℹ pass 12" in the spec reporter, "# pass 12" in TAP). Returns null if missing. */
export function parseSummary(output) {
  const grab = (key) => {
    const match = output.match(new RegExp(String.raw`^(?:#|ℹ) ${key} (\d+)\s*$`, "m"));
    return match ? Number(match[1]) : null;
  };
  const summary = { tests: grab("tests"), pass: grab("pass"), fail: grab("fail"), cancelled: grab("cancelled"), skipped: grab("skipped") };
  return [summary.tests, summary.pass, summary.fail].includes(null) ? null : summary;
}

/** A suite passes only if the process exited 0 AND the output proves at least one test passed and none failed. */
export function judge(code, output) {
  const summary = parseSummary(output);
  if (!summary) return { ok: false, reason: "no test summary in output", summary: null };
  if (code !== 0) return { ok: false, reason: `exit code ${code}`, summary };
  if (summary.tests === 0 || summary.pass === 0) return { ok: false, reason: "no tests ran", summary };
  if (summary.fail > 0 || (summary.cancelled ?? 0) > 0) return { ok: false, reason: "failed or cancelled tests", summary };
  return { ok: true, reason: "", summary };
}

function runSuite(suite) {
  return new Promise((resolve) => {
    // Force the spec reporter: the default differs between Node versions and between TTY and pipes.
    const child = spawn(process.execPath, ["--test-reporter=spec", ...suite.args], { cwd: path.join(root, suite.cwd ?? "."), env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => resolve({ code: 1, output: output + String(error) }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const unknown = wanted.filter((name) => !SUITES.some((suite) => suite.name === name));
  if (unknown.length) {
    console.error(`unknown suite(s): ${unknown.join(", ")}\navailable: ${SUITES.map((suite) => suite.name).join(", ")}`);
    process.exit(1);
  }
  const selected = wanted.length ? SUITES.filter((suite) => wanted.includes(suite.name)) : SUITES;

  const rows = [];
  for (const suite of selected) {
    const { code, output } = await runSuite(suite);
    const verdict = judge(code, output);
    rows.push({ name: suite.name, ...verdict });
    if (!verdict.ok) {
      console.log(`\n----- ${suite.name}: output -----\n${output.trimEnd()}\n----- end ${suite.name} -----\n`);
    }
    const counts = verdict.summary ? `  (${verdict.summary.pass}/${verdict.summary.tests} passed)` : "";
    console.log(`${verdict.ok ? "PASS" : "FAIL"}  ${suite.name}${counts}${verdict.reason ? `  ${verdict.reason}` : ""}`);
  }

  const failed = rows.filter((row) => !row.ok);
  const total = rows.reduce((sum, row) => sum + (row.summary?.tests ?? 0), 0);
  const passed = rows.reduce((sum, row) => sum + (row.summary?.pass ?? 0), 0);
  console.log(`\n${rows.length - failed.length}/${rows.length} suites passed, ${passed}/${total} tests passed`);
  if (failed.length) {
    console.log(`FAILED: ${failed.map((row) => row.name).join(", ")}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
