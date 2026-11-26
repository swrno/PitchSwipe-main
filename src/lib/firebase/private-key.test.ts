// Run: node --import ./scripts/register-ts.mjs --test src/lib/firebase/private-key.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizePrivateKey } from "./private-key";

const PEM = "-----BEGIN PRIVATE KEY-----\nABC\nDEF\n-----END PRIVATE KEY-----";
/** The key as a hosted env var stores it: backslash + n instead of newlines. */
const ESCAPED = PEM.split("\n").join("\\n");

test("escaped newlines (hosted env vars) become real newlines", () => {
  assert.ok(ESCAPED.includes("\\n") && !ESCAPED.includes("\n"));
  assert.equal(normalizePrivateKey(ESCAPED), PEM);
});

test("a key that already has real newlines (dotenv, double quotes) is unchanged", () => {
  assert.equal(normalizePrivateKey(PEM + "\n"), PEM);
});

test("surrounding quotes pasted into a hosted env var are removed", () => {
  assert.equal(normalizePrivateKey(`"${ESCAPED}\\n"`), PEM);
});

test("Windows line endings, escaped or real, become plain newlines", () => {
  assert.equal(normalizePrivateKey(PEM.split("\n").join("\\r\\n")), PEM);
  assert.equal(normalizePrivateKey(PEM.split("\n").join("\r\n")), PEM);
});

test("missing or blank is undefined", () => {
  assert.equal(normalizePrivateKey(undefined), undefined);
  assert.equal(normalizePrivateKey("   "), undefined);
});
