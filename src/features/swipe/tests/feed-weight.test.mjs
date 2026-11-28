// Feed weighting (src/features/swipe/ordering.ts feedWeight): which deck a swiper sees next. Never which version.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedWeight, pickNextDeck } from "../ordering.ts";
import { STARTER_FEED_WEIGHT } from "../starter.ts";

const product = (over = {}) => ({ industry: "Retail", targetUsers: ["Shop owner"], ...over });
const deck = (id, over = {}) => ({ id, product: product(over.product), starter: over.starter ?? false });

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("feedWeight", () => {
  const swiper = { role: "Shop owner", interests: ["Retail"] };

  it("favours target users and matching interests", () => {
    assert.equal(feedWeight(deck("a"), { role: "Student", interests: [] }), 1);
    assert.equal(feedWeight(deck("a"), { role: "Shop owner", interests: [] }), 2);
    assert.equal(feedWeight(deck("a"), { role: "Student", interests: ["Retail"] }), 1.5);
    assert.equal(feedWeight(deck("a"), swiper), 3);
  });

  it("gives starter decks a quarter of a founder deck's weight", () => {
    assert.equal(feedWeight(deck("s", { starter: true }), { role: "Student", interests: [] }), STARTER_FEED_WEIGHT);
    assert.equal(STARTER_FEED_WEIGHT, 0.25);
  });

  it("a swiper with no profile is treated evenly", () => {
    assert.equal(feedWeight(deck("a"), { role: undefined, interests: [] }), 1);
  });
});

describe("weighted pickNextDeck", () => {
  const decks = [deck("founder"), deck("starter", { starter: true })];
  const weight = (d) => feedWeight(d, { role: "Student", interests: [] });

  it("picks in proportion to weight (founder deck about 4 times as often)", () => {
    const rng = seeded(7);
    let founder = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) if (pickNextDeck({ decks, seenDeckIds: new Set(), rng, weight }).id === "founder") founder++;
    const share = founder / runs;
    assert.ok(share > 0.76 && share < 0.84, `founder share ${share}`);
  });

  it("still shows every deck once, then runs out", () => {
    const seen = new Set();
    const rng = seeded(3);
    for (;;) {
      const next = pickNextDeck({ decks, seenDeckIds: seen, rng, weight });
      if (!next) break;
      assert.ok(!seen.has(next.id));
      seen.add(next.id);
    }
    assert.deepEqual([...seen].sort(), ["founder", "starter"]);
  });

  it("the link deck still comes first, whatever its weight", () => {
    assert.equal(pickNextDeck({ decks, seenDeckIds: new Set(), firstDeckId: "starter", rng: seeded(1), weight }).id, "starter");
  });

  it("falls back to an even pick when every weight is zero or broken", () => {
    const next = pickNextDeck({ decks, seenDeckIds: new Set(), rng: seeded(1), weight: () => NaN });
    assert.ok(next);
  });
});
