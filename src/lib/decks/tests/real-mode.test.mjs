// Real mode (not demo) must never show placeholder numbers. Pure logic only, no database, no network.
// Run: node --import ./src/lib/decks/tests/register.mjs --test src/lib/decks/tests/real-mode.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

delete process.env.MONGODB_URI;
const { allowanceFor } = await import("../service.ts");
const { draftAvailability, AI_NOT_CONFIGURED_MESSAGE } = await import("../ai-stub.ts");
const { demoIdentity, realIdentity, initialsOf } = await import("../../../components/shell/identity.ts");

test("deck allowance: designed 7 of 10 in demo, nothing in real mode", () => {
  assert.deepEqual(allowanceFor(true), { left: 7, total: 10 });
  assert.equal(allowanceFor(false), undefined);
});

test("AI drafting: fixtures only in demo; real mode is 503-bound with or without a key", () => {
  assert.equal(draftAvailability({ demo: true, env: {} }), "demo");
  assert.equal(draftAvailability({ demo: true, env: { LLM_API_KEY: "x" } }), "demo");
  assert.equal(draftAvailability({ demo: false, env: {} }), "not_configured");
  assert.equal(draftAvailability({ demo: false, env: { LLM_API_KEY: "" } }), "not_configured");
  assert.equal(draftAvailability({ demo: false, env: { LLM_API_KEY: "k" } }), "live");
  assert.equal(AI_NOT_CONFIGURED_MESSAGE, "AI drafts need an LLM key to be configured");
});

test("sidebar identity: real mode shows only the loaded profile and wallet", () => {
  assert.equal(realIdentity(null, null), null);
  assert.equal(realIdentity({ name: "  " }, { balanceRs: 5 }), null);
  const loadedProfileOnly = realIdentity({ name: "Asha Rao", state: "Kerala", role: "Student" }, null);
  assert.equal(loadedProfileOnly.name, "Asha Rao");
  assert.equal(loadedProfileOnly.initials, "AR");
  assert.equal(loadedProfileOnly.detail, "Kerala · Student");
  assert.equal(loadedProfileOnly.balanceRs, undefined, "no balance until the wallet loads");
  assert.equal(loadedProfileOnly.demo, false);
  assert.equal(realIdentity({ name: "Asha Rao" }, { balanceRs: 12.5 }).balanceRs, 12.5);
  assert.equal(realIdentity({ name: "Asha Rao" }, { balanceRs: NaN }).balanceRs, undefined);
  assert.equal(realIdentity({ name: "Asha Rao" }, null).detail, "");
  assert.equal(initialsOf("madonna"), "M");
});

test("sidebar identity: demo user is flagged demo", () => {
  const d = demoIdentity({ name: "Priya Nair", initials: "PN", detail: "Gujarat · Shop owner" }, 46.75);
  assert.equal(d.demo, true);
  assert.equal(d.balanceRs, 46.75);
});
