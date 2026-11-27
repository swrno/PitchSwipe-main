// Runs every test suite as its own `node --test` process and prints a pass/fail summary.
//
//   npm test                      all suites
//   npm test -- ratelimit seed    only the named suites
//
// Exits non-zero if any suite fails, reports no tests, or produces output that cannot be parsed.
// Suites are listed explicitly so a forgotten test file shows up in review.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TS = ["--import", "./scripts/register-ts.mjs", "--test"];

function filesIn(dir, pattern) {
  return readdirSync(path.join(root, dir))
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => `${dir}/${name}`);
}

export const SUITES = [
  { name: "flagsmith", args: [...TS, "scripts/tests/flagsmith.test.mjs"] },
  { name: "quality", args: [...TS, "src/lib/quality/tests/quality.test.mjs", "src/lib/quality/tests/switch.test.mjs", "src/lib/quality/tests/submission.test.mjs"] },
  { name: "demand-curve", args: [...TS, "src/lib/demand-curve/demand-curve.test.ts"] },
  { name: "swipe", args: [...TS, ...filesIn("src/lib/swipe/tests", /\.test\.mjs$/)] },
  { name: "claims", args: [...TS, "src/lib/claims/tests/claims.test.mjs", "src/lib/claims/tests/voice-text.test.ts", "src/lib/claims/tests/native-dictation.test.ts"] },
  { name: "results", args: [...TS, "src/lib/results/results.test.ts", "src/lib/results/demo-consistency.test.ts", "src/lib/fixtures-imports.test.ts"] },
  { name: "assistant", args: [...TS, "src/lib/assistant/tests/assistant.test.ts"] },
  { name: "export", args: [...TS, "src/lib/export/export.test.ts"] },
  { name: "share", args: [...TS, "src/lib/share/tests/share.test.mjs"] },
  { name: "ai", args: [...TS, "src/lib/ai/ai.test.ts", "src/lib/ai/groq.test.ts", "src/lib/decks/ai-live.test.ts"] },
  { name: "ask", args: [...TS, "src/lib/ask/ask.test.ts"] },
  { name: "insights", args: [...TS, "src/lib/insights/insights.test.ts"] },
  { name: "sites", args: [...TS, "src/lib/sites/tests/sites.test.ts"] },
  { name: "auth", args: [...TS, "src/lib/auth/tests/next.test.ts"] },
  { name: "ratelimit", args: [...TS, "src/lib/ratelimit/ratelimit.test.ts", "src/lib/ratelimit/body.test.ts"] },
  { name: "feel", args: [...TS, "src/lib/feel/haptics.test.ts"] },
  { name: "firebase", args: [...TS, "src/lib/firebase/private-key.test.ts"] },
  { name: "sw-routes", args: [...TS, "scripts/tests/sw-routes.test.mjs"] },
  { name: "seed", args: [...TS, "scripts/seed/seed.test.mjs", "scripts/seed/feed-decks.test.mjs"] },
  { name: "db-sync-indexes", args: [...TS, "scripts/db/sync-indexes.test.mjs"] },
  {
    name: "decks",
    args: ["--import", "./src/lib/decks/tests/register.mjs", "--test", ...filesIn("src/lib/decks/tests", /\.test\.mjs$/)],
  },
  { name: "ai-engine", cwd: "src/lib/ai/engine", args: ["--test"] },
];

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
