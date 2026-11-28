// Without a configured server nothing is faked. Pure logic only, no database, no network.
// Run: npm test -- decks
import test from "node:test";
import assert from "node:assert/strict";

delete process.env.MONGODB_URI;
const { draftAvailability, AI_NOT_CONFIGURED_MESSAGE } = await import("../server/ai-availability.ts");
const { realIdentity, initialsOf } = await import("../../../shared/shell/identity.ts");
const { getStore } = await import("../server/store.ts");

test("AI drafting: 503-bound with no key, live with one; never fixture copy", () => {
  assert.equal(draftAvailability({ env: {} }), "not_configured");
  assert.equal(draftAvailability({ env: { LLM_API_KEY: "" } }), "not_configured");
  assert.equal(draftAvailability({ env: { LLM_API_KEY: "k" } }), "live");
  assert.equal(AI_NOT_CONFIGURED_MESSAGE, "AI drafts need an LLM key to be configured");
});

test("sidebar identity shows only the loaded profile and wallet", () => {
  assert.equal(realIdentity(null, null), null);
  assert.equal(realIdentity({ name: "  " }, { balanceRs: 5 }), null);
  const loadedProfileOnly = realIdentity({ name: "Asha Rao", state: "Kerala", role: "Student" }, null);
  assert.equal(loadedProfileOnly.name, "Asha Rao");
  assert.equal(loadedProfileOnly.initials, "AR");
  assert.equal(loadedProfileOnly.detail, "Kerala · Student");
  assert.equal(loadedProfileOnly.balanceRs, undefined, "no balance until the wallet loads");
  assert.equal(realIdentity({ name: "Asha Rao" }, { balanceRs: 12.5 }).balanceRs, 12.5);
  assert.equal(realIdentity({ name: "Asha Rao" }, { balanceRs: NaN }).balanceRs, undefined);
  assert.equal(realIdentity({ name: "Asha Rao" }, null).detail, "");
  assert.equal(initialsOf("madonna"), "M");
});

test("no MONGODB_URI: the deck store refuses with a 503 instead of an in-memory fallback", async () => {
  await assert.rejects(getStore(), (e) => e.status === 503 && /MONGODB_URI/.test(e.message));
});
