// Run: node --import ./scripts/register-ts.mjs --test src/lib/fixtures-imports.test.ts
//
// Guards real mode against demo numbers. A file under src/ may import `@/fixtures` (or reach src/fixtures by a
// relative path) only if it is
//   1. a test or the fixtures folder itself,
//   2. a demo-mode module, or a module that only reads spec RULES from the fixtures (the LIMITS thresholds: 95% chance,
//      50 identities, groups under 10, which are product rules and not displayed data), or
//   3. on the TODO(remove) list below: a file that still leaks demo values into real mode and is being fixed on
//      another branch. Shrink this list, never grow it. Adding a file here needs a reason in the PR.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Names that are product rules, not demo data; importing only these is always fine. */
const RULE_CONSTANTS = new Set(["LIMITS"]);

/** Demo-mode modules: the fixture values are only read behind store.demo / isDemoMode() (checked by hand in review). */
const DEMO_MODULES = new Set([
  "lib/results/demo.ts", // demo aggregates, only called behind store.demo
  "lib/insights/demo.ts", // demo decks and wording, only behind store.demo
  "lib/ask/data.ts", // PRODUCT_TOTALS only for decks whose payload.demo is true
  "lib/assistant/sources.ts", // decided-state fixtures only behind store.demo; FOUNDER name only when demo
  "lib/insights/load.ts", // distinct-swiper total only when useDemo
  "lib/results/payload.ts", // price pin only when input.demo
  "lib/decks/store-memory.ts", // the in-memory demo store
  "lib/claims/store-memory.ts", // the in-memory demo wallet store
  "lib/swipe/demo.ts", // swipe demo decks
  "components/profile/demo-profile.ts", // demo swiper on /profile, only called behind isDemoMode() in the page
]);

/** TODO(remove): real-mode leaks owned by other branches (shell / decks / swipe / claims areas). */
const TODO_REMOVE = new Set([
  "app/(shell)/decks/plans/page.tsx", // TODO(remove) billing allowance counters
  "app/(shell)/products/new/page.tsx", // TODO(remove) FOUNDER name
  "app/(shell)/products/[id]/page.tsx", // TODO(remove) FOUNDER name
  "app/api/claims/wallet/route.ts", // TODO(remove) WALLET quality score
  "components/decks/ai-preview-sheet.tsx", // TODO(remove) PERSONA_PREVIEW numbers
  "components/decks/deck-wizard.tsx", // TODO(remove) DECK_PLANS allowance
  "components/quality/result-view.tsx", // TODO(remove) QUALITY_RESULT numbers
  "components/shell/navigation.tsx", // TODO(remove) USER_CHIP / WALLET badge
  "components/swipe/answer-handoff.tsx", // TODO(remove) SWIPER profile
  "components/swipe/swipe-home.tsx", // TODO(remove) HOME_IDEA_SELECTION, used only when wallet.demo
  "lib/claims/server.ts", // TODO(remove) SWIPER profile
  "lib/decks/ai-stub.ts", // TODO(remove) Voice Khata AI copy for any founder
  "lib/decks/service.ts", // TODO(remove) DECK_PLANS allowance
  "lib/swipe/server.ts", // TODO(remove) SWIPER profile
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");
const isTest = (r: string) => /(^|\/)tests?\//.test(r) || /\.test\.(ts|tsx|mjs|js)$/.test(r);

/** Imported names per fixtures import in a file: the name list, or ["*"] for a namespace, side-effect or dynamic import. */
export function fixtureImports(source: string, file: string): string[][] {
  const hits: string[][] = [];
  const fixturesDir = path.join(SRC, "fixtures");
  const fromFixtures = (spec: string) => {
    if (spec === "@/fixtures" || spec.startsWith("@/fixtures/")) return true;
    if (!spec.startsWith(".")) return false;
    const target = path.resolve(path.dirname(file), spec);
    return target === fixturesDir || target.startsWith(fixturesDir + path.sep);
  };
  const stat = /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g;
  for (let m = stat.exec(source); m; m = stat.exec(source)) {
    if (!fromFixtures(m[3])) continue;
    if (m[1]) continue; // `import type` carries no value
    const braces = /\{([^}]*)\}/.exec(m[2]);
    if (!braces || m[2].replace(braces[0], "").replace(/[,\s]/g, "")) {
      hits.push(["*"]);
      continue;
    }
    const names = braces[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("type "))
      .map((s) => s.split(/\s+as\s+/)[0].trim());
    if (names.length > 0) hits.push(names);
  }
  const dyn = /(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;
  for (let m = dyn.exec(source); m; m = dyn.exec(source)) if (fromFixtures(m[1])) hits.push(["*"]);
  const bare = /import\s+["']([^"']+)["']/g;
  for (let m = bare.exec(source); m; m = bare.exec(source)) if (fromFixtures(m[1])) hits.push(["*"]);
  return hits;
}

const demoValues = (names: string[]) => !names.every((n) => RULE_CONSTANTS.has(n));

describe("fixtures are not imported by real-mode code", () => {
  const files = walk(SRC).filter((f) => !rel(f).startsWith("fixtures/"));

  it("only allowlisted files import demo values from @/fixtures", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const r = rel(file);
      if (isTest(r) || DEMO_MODULES.has(r) || TODO_REMOVE.has(r)) continue;
      for (const names of fixtureImports(readFileSync(file, "utf8"), file)) {
        if (demoValues(names)) offenders.push(`${r} imports ${names.join(", ")}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "a file outside the allowlist imports demo fixtures: compute the value from real data, or gate it behind demo mode and allowlist it with a reason",
    );
  });

  it("the allowlists do not rot: every listed file exists and still imports a demo value", () => {
    for (const list of [DEMO_MODULES, TODO_REMOVE]) {
      for (const r of list) {
        const file = path.join(SRC, r);
        const imports = fixtureImports(readFileSync(file, "utf8"), file);
        assert.ok(imports.some(demoValues), `${r} no longer imports demo fixtures: remove it from the allowlist`);
      }
    }
  });

  it("the scanner sees named, namespace, dynamic and relative imports", () => {
    const f = path.join(SRC, "lib/x.ts");
    assert.deepEqual(fixtureImports(`import { LIMITS, WALLET } from "@/fixtures";`, f), [["LIMITS", "WALLET"]]);
    assert.deepEqual(fixtureImports(`import * as fx from "@/fixtures";`, f), [["*"]]);
    assert.deepEqual(fixtureImports(`const m = await import("@/fixtures");`, f), [["*"]]);
    assert.deepEqual(fixtureImports(`import { WALLET } from "../fixtures";`, f), [["WALLET"]]);
    assert.deepEqual(fixtureImports(`import type { FixtureDeck } from "@/fixtures";`, f), []);
    assert.deepEqual(fixtureImports(`import { x } from "@/lib/fixtures-like";`, f), []);
  });
});
