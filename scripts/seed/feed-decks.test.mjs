// The 100 starter feed decks (scripts/seed/feed-ideas.mjs) must each pass the same checks as a founder's publish.
import test from "node:test";
import assert from "node:assert/strict";

import { FEED_VARIABLES, HOUSE_ACCOUNT, IDEAS, REWARDS, deckInput, feedPlan, productInput } from "./feed-ideas.mjs";
import { validateDeck } from "../../src/lib/decks/validate.ts";
import { validateProduct } from "../../src/lib/decks/product.ts";

test("100 decks: 25 products x headline, description, price, reward", () => {
  const plan = feedPlan();
  assert.equal(IDEAS.length, 25);
  assert.equal(plan.length, 100);
  assert.deepEqual(FEED_VARIABLES, ["headline", "price", "description", "reward"]);
  assert.equal(new Set(IDEAS.map((i) => i.name.toLowerCase())).size, IDEAS.length, "product names are unique");
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

test("honest cards: the house name shows and rewards only promise what can be kept", () => {
  for (const idea of IDEAS) assert.equal(productInput(idea).showOwnerName, true);
  assert.match(HOUSE_ACCOUNT.email, /\.invalid$/);
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

test("the house account is the feed's starter owner", async () => {
  const { STARTER_OWNER_UID } = await import("../../src/lib/swipe/starter.ts");
  assert.equal(HOUSE_ACCOUNT.firebaseUid, STARTER_OWNER_UID);
});
