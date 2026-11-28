// The 200 starter feed decks (scripts/seed/feed-ideas.mjs) must each pass the same checks as a founder's publish.
import test from "node:test";
import assert from "node:assert/strict";

import { FEED_VARIABLES, FOUNDERS, IDEAS, OWNER_IDEAS, REWARDS, deckInput, feedPlan, productInput } from "./feed-ideas.mjs";
import { validateDeck } from "../../src/features/decks/validate.ts";
import { validateProduct } from "../../src/features/decks/product.ts";

test("200 decks: 50 products x headline, description, price, reward", () => {
  const plan = feedPlan();
  assert.equal(IDEAS.length, 50);
  assert.equal(plan.length, 200);
  assert.deepEqual(FEED_VARIABLES, ["headline", "price", "description", "reward"]);
  assert.equal(new Set(IDEAS.map((i) => i.name.toLowerCase())).size, IDEAS.length, "product names are unique");
});

test("5 founders own 10 products and 40 decks each, with unique names and headlines", () => {
  assert.equal(FOUNDERS.length, 5);
  assert.equal(new Set(FOUNDERS.map((f) => f.firebaseUid)).size, 5);
  assert.equal(new Set(FOUNDERS.map((f) => f.name)).size, 5);
  const plan = feedPlan();
  for (const f of FOUNDERS) {
    assert.equal(IDEAS.filter((i) => i.owner === f).length, 10, `${f.name} products`);
    assert.equal(plan.filter((x) => x.idea.owner === f).length, 40, `${f.name} decks`);
    assert.match(f.email, /\.invalid$/);
    assert.match(f.firebaseUid, /^founder-pitchswipe-/);
  }
  const headlines = IDEAS.flatMap((i) => i.headlines.map((h) => h.toLowerCase()));
  assert.equal(new Set(headlines).size, headlines.length, "headlines are unique");
  assert.ok(new Set(IDEAS.map((i) => i.industry)).size >= 14, "varied industries");
});

test("every product and every deck passes the publish checks", () => {
  for (const idea of IDEAS) {
    const p = validateProduct(productInput(idea));
    assert.ok(p.ok, `${idea.name}: ${JSON.stringify(p.errors)}`);
  }
  for (const { idea, variable } of feedPlan()) {
    const d = validateDeck(deckInput(idea, variable, "000000000000000000000000"), "publish");
    assert.ok(d.ok, `${idea.name} / ${variable}: ${JSON.stringify(d.errors)}`);
  }
});

test("one variable per deck: the tested field is never also locked", () => {
  for (const { idea, variable } of feedPlan()) {
    const d = deckInput(idea, variable, "p");
    assert.equal(variable in d.shared, false, `${idea.name} / ${variable}`);
    assert.equal(d.cards.length, 3);
    assert.equal(new Set(d.cards.map((c) => String(c.value))).size, 3, `${idea.name} / ${variable}: versions differ`);
  }
});

test("honest cards: the founder name shows and rewards only promise what can be kept", () => {
  for (const idea of IDEAS) assert.equal(productInput(idea).showOwnerName, true);
  for (const r of REWARDS) assert.match(r, /gets built/, "a reward is conditional on the idea being built");
});

test("no invented results: no percentages or user counts in the copy", () => {
  const text = IDEAS.flatMap((i) => [...i.headlines, ...i.descriptions]).join("\n");
  assert.doesNotMatch(text, /\d+\s*%/);
  assert.doesNotMatch(text, /\d[\d,]*\s*(users|customers|farmers|shops|swipers)\b/i);
});

test("a small set for a short event: first N ideas, chosen test types", () => {
  const plan = feedPlan({ ideas: 3, variables: ["headline", "price"] });
  assert.equal(plan.length, 6);
  assert.deepEqual([...new Set(plan.map((x) => x.variable))], ["headline", "price"]);
  assert.deepEqual([...new Set(plan.map((x) => x.idea.name))], IDEAS.slice(0, 3).map((i) => i.name));
  assert.throws(() => feedPlan({ variables: ["logo"] }), /Unknown test type/);
  assert.throws(() => feedPlan({ ideas: 0 }), /ideas must be/);
});

test("founder accounts are not the starter (down-weighted) owner", async () => {
  const { STARTER_OWNER_UID } = await import("../../src/features/swipe/starter.ts");
  for (const f of FOUNDERS) assert.notEqual(f.firebaseUid, STARTER_OWNER_UID);
});

test("owner ideas: 5 extra products x 4 decks, new names, all pass the publish checks", () => {
  assert.equal(OWNER_IDEAS.length, 5);
  const feedNames = new Set(IDEAS.map((i) => i.name.toLowerCase()));
  const plan = feedPlan({ pool: OWNER_IDEAS });
  assert.equal(plan.length, 20);
  for (const idea of OWNER_IDEAS) {
    assert.ok(!feedNames.has(idea.name.toLowerCase()), `${idea.name} is not a feed product`);
    assert.ok(validateProduct(productInput(idea)).ok, idea.name);
  }
  for (const { idea, variable } of plan) {
    const d = validateDeck(deckInput(idea, variable, "000000000000000000000000"), "publish");
    assert.ok(d.ok, `${idea.name} / ${variable}: ${JSON.stringify(d.errors)}`);
  }
});
