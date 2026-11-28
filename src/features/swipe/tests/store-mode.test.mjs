// Run: npm test -- swipe
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getClaimsStore, setClaimsStoreForTests } from "../../claims/server/store.ts";
import { getSwipeStore, setSwipeStoreForTests } from "../server/store.ts";
import { isServerConfigured, NOT_CONFIGURED_MESSAGE } from "../../../shared/lib/config.ts";
import { PRACTICE_CARD_LABEL, NORMAL_CARDS, CHECK_CARDS } from "../../quality/cards.ts";

const KEYS = ["MONGODB_URI", "NODE_ENV", "FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"];
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
  setSwipeStoreForTests(undefined);
  setClaimsStoreForTests(undefined);
});

describe("storage is always MongoDB: without it the stores refuse (503), never fake data", () => {
  it("no MONGODB_URI: the swipe and claims stores throw a 503 with the not-configured message", async () => {
    for (const NODE_ENV of ["development", "production"]) {
      env({ NODE_ENV });
      await assert.rejects(getSwipeStore(), (e) => e.status === 503 && e.message === NOT_CONFIGURED_MESSAGE);
      await assert.rejects(getClaimsStore(), (e) => e.status === 503 && e.message === NOT_CONFIGURED_MESSAGE);
    }
  });
  it("the server counts as configured only with MongoDB and all three Firebase Admin values", () => {
    env({});
    assert.equal(isServerConfigured(), false);
    env({ MONGODB_URI: "mongodb://x" });
    assert.equal(isServerConfigured(), false);
    env({ FIREBASE_ADMIN_PROJECT_ID: "p", FIREBASE_ADMIN_CLIENT_EMAIL: "e", FIREBASE_ADMIN_PRIVATE_KEY: "k" });
    assert.equal(isServerConfigured(), false);
    env({ MONGODB_URI: "mongodb://x", FIREBASE_ADMIN_PROJECT_ID: "p", FIREBASE_ADMIN_CLIENT_EMAIL: "e", FIREBASE_ADMIN_PRIVATE_KEY: "k" });
    assert.equal(isServerConfigured(), true);
  });
  it("the message names MongoDB and the Firebase keys", () => {
    assert.match(NOT_CONFIGURED_MESSAGE, /MONGODB_URI/);
    assert.match(NOT_CONFIGURED_MESSAGE, /Firebase/);
  });
});

describe("practice cards", () => {
  it("carry a visible practice/sample label constant that says they are not a real pitch", () => {
    assert.match(PRACTICE_CARD_LABEL, /practice/i);
    assert.match(PRACTICE_CARD_LABEL, /not a real pitch/i);
    assert.equal(NORMAL_CARDS.length + CHECK_CARDS.length, 36);
  });
});
