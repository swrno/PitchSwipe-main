// Run: node --import ./scripts/register-ts.mjs --test scripts/db/sync-indexes.test.mjs
// No database: tests the argument/guard logic, the duplicate helpers, the real script's refusals,
// and the verdict logic of scripts/run-tests.mjs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { register } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { judge, parseSummary } from "../run-tests.mjs";
import { checkGuards, describeDuplicate, duplicatePipeline, isDuplicateKeyError, redact, uniqueIndexFields } from "./sync-indexes-lib.mjs";

register("../seed/mongoose-hooks.mjs", import.meta.url);
const models = await import("../../src/models/index.ts");

const SCRIPT = fileURLToPath(new URL("./sync-indexes.mjs", import.meta.url));
const URI = "mongodb://user:secret-pass@localhost:1/pitchswipe-test";

describe("checkGuards", () => {
  it("needs MONGODB_URI", () => {
    const result = checkGuards(["--yes"], {});
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /MONGODB_URI is not set/);
  });
  it("treats a blank MONGODB_URI as missing", () => {
    assert.equal(checkGuards(["--yes"], { MONGODB_URI: "   " }).ok, false);
  });
  it("needs --yes", () => {
    const result = checkGuards([], { MONGODB_URI: URI });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /--yes/);
  });
  it("reports both problems at once", () => {
    assert.equal(checkGuards([], {}).errors.length, 2);
  });
  it("passes with both and returns the uri", () => {
    assert.deepEqual(checkGuards(["--yes"], { MONGODB_URI: URI }), { ok: true, uri: URI });
  });
});

describe("helpers", () => {
  it("redact removes the uri", () => {
    assert.equal(redact(`connect failed for ${URI} (timeout)`, URI), "connect failed for <MONGODB_URI> (timeout)");
    assert.equal(redact("plain", undefined), "plain");
  });
  it("isDuplicateKeyError recognises code 11000 and E11000 text", () => {
    assert.equal(isDuplicateKeyError({ code: 11000 }), true);
    assert.equal(isDuplicateKeyError(new Error("E11000 duplicate key error collection: x")), true);
    assert.equal(isDuplicateKeyError({ errors: [{ code: 11000 }] }), true);
    assert.equal(isDuplicateKeyError(new Error("ECONNREFUSED")), false);
    assert.equal(isDuplicateKeyError(null), false);
  });
  it("finds the unique indexes on the real models", () => {
    const sets = (name) => uniqueIndexFields(models[name].schema).map((fields) => fields.join("+"));
    assert.ok(sets("Response").includes("deckId+swiperId"));
    assert.ok(sets("Claim").includes("deckId+email"));
  });
  it("builds a duplicate pipeline and describes a group", () => {
    const pipeline = duplicatePipeline(["deckId", "email"]);
    assert.deepEqual(pipeline[0].$group._id, { k0: "$deckId", k1: "$email" });
    assert.deepEqual(pipeline[1], { $match: { count: { $gt: 1 } } });
    const text = describeDuplicate(["deckId", "email"], { _id: { k0: "d1", k1: "a@b.invalid" }, ids: ["i1", "i2"], count: 2 });
    assert.equal(text, '2 documents share deckId="d1", email="a@b.invalid" (_id: i1, i2)');
  });
});

describe("sync-indexes.mjs refuses unsafe runs (no database is contacted)", () => {
  const run = (args, env) =>
    spawnSync(process.execPath, ["--import", "./scripts/register-ts.mjs", SCRIPT, ...args], {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: { ...process.env, MONGODB_URI: "", ...env },
      encoding: "utf8",
    });
  it("exits 1 without MONGODB_URI", () => {
    const r = run(["--yes"], {});
    assert.equal(r.status, 1);
    assert.match(r.stderr, /MONGODB_URI is not set/);
  });
  it("exits 1 without --yes and never prints the uri", () => {
    const r = run([], { MONGODB_URI: URI });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--yes/);
    assert.ok(!r.stdout.includes("secret-pass") && !r.stderr.includes("secret-pass"));
  });
});

describe("run-tests verdict logic", () => {
  const ok = "# tests 5\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 0\n";
  it("parses a node:test summary", () => {
    assert.deepEqual(parseSummary(ok), { tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0 });
  });
  it("passes a clean run", () => assert.equal(judge(0, ok).ok, true));
  it("fails on non-zero exit", () => assert.equal(judge(1, ok).ok, false));
  it("fails on failing tests", () => assert.equal(judge(0, "# tests 5\n# pass 4\n# fail 1\n").ok, false));
  it("fails on zero tests", () => assert.equal(judge(0, "# tests 0\n# pass 0\n# fail 0\n").ok, false));
  it("fails on empty or unknown output", () => {
    assert.equal(judge(0, "").ok, false);
    assert.equal(judge(0, "something else").ok, false);
  });
});
