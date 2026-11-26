// Run: node --import ./scripts/register-ts.mjs --test src/lib/swipe/tests/store-mode.test.mjs
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isClaimsDemoMode, getClaimsStore } from "../../claims/store.ts";
import { isSwipeDemoMode, isSwipeMisconfigured, getSwipeStore } from "../store.ts";
import { PRACTICE_CARD_LABEL, NORMAL_CARDS, CHECK_CARDS } from "../../quality/cards.ts";

const KEYS = ["MONGODB_URI", "NODE_ENV", "PITCHSWIPE_DEMO"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
function env(vars) {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("swipe/claims demo-mode guard (same rule as decks isDemoMode)", () => {
  it("no MONGODB_URI outside production is demo", () => {
    env({ NODE_ENV: "development" });
    assert.equal(isSwipeDemoMode(), true);
    assert.equal(isClaimsDemoMode(), true);
    assert.equal(isSwipeMisconfigured(), false);
  });
  it("MONGODB_URI set is real mode, even with NODE_ENV=development", () => {
    env({ NODE_ENV: "development", MONGODB_URI: "mongodb://x" });
    assert.equal(isSwipeDemoMode(), false);
    assert.equal(isSwipeMisconfigured(), false);
  });
  it("production without MONGODB_URI is NOT demo and refuses to serve (503)", async () => {
    env({ NODE_ENV: "production" });
    assert.equal(isSwipeDemoMode(), false);
    assert.equal(isClaimsDemoMode(), false);
    assert.equal(isSwipeMisconfigured(), true);
    await assert.rejects(getSwipeStore(), (e) => e.status === 503);
    await assert.rejects(getClaimsStore(), (e) => e.status === 503);
  });
  it("production with PITCHSWIPE_DEMO=1 is demo", () => {
    env({ NODE_ENV: "production", PITCHSWIPE_DEMO: "1" });
    assert.equal(isSwipeDemoMode(), true);
    assert.equal(isSwipeMisconfigured(), false);
  });
  it("PITCHSWIPE_DEMO=1 wins even when MONGODB_URI is set (same as decks)", () => {
    env({ NODE_ENV: "production", MONGODB_URI: "mongodb://x", PITCHSWIPE_DEMO: "1" });
    assert.equal(isSwipeDemoMode(), true);
  });
});

describe("practice cards", () => {
  it("carry a visible practice/sample label constant that says they are not a real pitch", () => {
    assert.match(PRACTICE_CARD_LABEL, /practice/i);
    assert.match(PRACTICE_CARD_LABEL, /not a real pitch/i);
    assert.equal(NORMAL_CARDS.length + CHECK_CARDS.length, 36);
  });
});
