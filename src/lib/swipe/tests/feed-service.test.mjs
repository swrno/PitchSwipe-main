// The feed weighting through the real card picker (nextCard), not just the weight function on its own.
// Run: node --import ./scripts/register-ts.mjs --test src/lib/swipe/tests/feed-service.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedWeight, isEligibleForFeed } from "../ordering.ts";
import { nextCard } from "../service.ts";
import { memorySwipeStore } from "../store-memory.ts";

const SECRET = "test-secret-0123456789abcdef";

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** The demo feed with every deck except `founderId` marked as a starter deck (local split: no Flagsmith calls). */
function deps({ founderId, starter = true, rng = seeded(11) }) {
  const mark = (d) => (d ? { ...d, starter: starter && d.id !== founderId } : d);
  return {
    store: {
      demo: true,
      listFeedDecks: async () => (await memorySwipeStore.listFeedDecks()).map(mark),
      getDeckBySlug: async (slug) => mark(await memorySwipeStore.getDeckBySlug(slug)),
      getDeckById: async (id) => mark(await memorySwipeStore.getDeckById(id)),
      hasResponded: async () => false,
    },
    async assign() {
      throw new Error("a local-split deck never calls Flagsmith");
    },
    paidSwiping: async () => true,
    now: () => 100_000,
    rng,
    secret: SECRET,
  };
}

const swiper = (over = {}) => ({ key: "g:feed-test", guest: true, demo: true, role: "Student", interests: [], counting: true, ...over });

async function firstPicks(d, who, runs) {
  const counts = new Map();
  for (let i = 0; i < runs; i++) {
    const res = await nextCard(d, { swiper: who, interests: [], seen: [] });
    counts.set(res.card.deckId, (counts.get(res.card.deckId) ?? 0) + 1);
  }
  return counts;
}

describe("nextCard with feed weighting", () => {
  it("serves a founder's deck about as often as its weight says, starter decks less", async () => {
    const decks = await memorySwipeStore.listFeedDecks();
    const founderId = "loadmate-headline";
    const who = swiper();
    const eligible = decks.filter((x) => isEligibleForFeed(x, who, []));
    const weights = eligible.map((x) => feedWeight({ ...x, starter: x.id !== founderId }, who));
    const expected = weights[eligible.findIndex((x) => x.id === founderId)] / weights.reduce((a, b) => a + b, 0);

    const runs = 800;
    const counts = await firstPicks(deps({ founderId }), who, runs);
    const share = (counts.get(founderId) ?? 0) / runs;
    assert.ok(Math.abs(share - expected) < 0.06, `founder deck share ${share.toFixed(2)}, expected about ${expected.toFixed(2)}`);
    assert.ok(share > 1 / eligible.length, "more than an even share");
    for (const x of eligible.filter((x) => x.id !== founderId)) assert.ok((counts.get(x.id) ?? 0) > 0, `${x.id} still shown`);
  });

  it("a target user sees decks for their role more often", async () => {
    const runs = 600;
    const driver = swiper({ role: "Driver" });
    const counts = await firstPicks(deps({ founderId: null, starter: false, rng: seeded(5) }), driver, runs);
    const loadmate = (counts.get("loadmate-headline") ?? 0) / runs;
    const others = [...counts].filter(([id]) => id !== "loadmate-headline").map(([, n]) => n / runs);
    assert.ok(others.every((s) => loadmate > s), `Driver deck ${loadmate.toFixed(2)} vs others ${others.map((s) => s.toFixed(2)).join(", ")}`);
  });

  it("weighting picks the deck only: the card a swiper gets within a deck does not change", async () => {
    const decks = await memorySwipeStore.listFeedDecks();
    const target = "voice-khata-headline";
    const seen = decks.filter((x) => x.id !== target).map((x) => x.id);
    for (const key of ["g:a", "g:b", "g:c", "g:d"]) {
      const who = swiper({ key });
      const asFounder = await nextCard(deps({ founderId: target }), { swiper: who, interests: [], seen });
      const asStarter = await nextCard(deps({ founderId: null }), { swiper: who, interests: [], seen });
      assert.equal(asFounder.card.deckId, target);
      assert.equal(asFounder.card.cardId, asStarter.card.cardId, key);
    }
  });

  it("a deck already answered is never served again, however heavy", async () => {
    const decks = await memorySwipeStore.listFeedDecks();
    const res = await nextCard(deps({ founderId: "loadmate-headline" }), {
      swiper: swiper({ role: "Driver" }),
      interests: [],
      seen: decks.map((x) => x.id),
    });
    assert.equal(res.card, null);
    assert.equal(res.reason, "empty");
  });
});
