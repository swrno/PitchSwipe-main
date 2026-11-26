// Run: node --import ./scripts/register-ts.mjs --test src/lib/results/demo-consistency.test.ts
// Cross-screen checks: every demo screen reads src/fixtures, so the same deck shows the same number everywhere.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DECIDED_HEADLINE_TEST,
  DECKS,
  HEADLINE_FLAGSMITH_RESULTS,
  HEADLINE_RESULTS_TOTAL,
  OTHER_DECK_COUNTS,
  PRICE_TEST_ARMS,
  PRODUCT_TOTALS,
  RESULT_INSIGHT_SWIPERS,
  VOICE_KHATA_DECK_COUNTS as COUNTS,
  decidedIdentitiesByVariant,
  demoDeckStats,
} from "@/fixtures";

delete process.env.MONGODB_URI;
delete process.env.PITCHSWIPE_DEMO;

const NOW = new Date("2026-11-15T12:00:00+05:30");
const deckIds = Object.keys(COUNTS);
const sum = (f: (c: (typeof COUNTS)[string]) => number) => deckIds.reduce((n, id) => n + f(COUNTS[id]), 0);

describe("fixture totals agree with spec/08 and the designs", () => {
  it("headline is 214 / 98 / 26 and price is 480 / 203 / 76 (120 per price)", () => {
    assert.deepEqual(COUNTS["voice-khata-headline"], { swipers: 214, saidYes: 98, joined: 26, comments: 24 });
    assert.equal(COUNTS["voice-khata-headline"].swipers, HEADLINE_RESULTS_TOTAL.swipers);
    const price = COUNTS["voice-khata-price"];
    assert.deepEqual([price.swipers, price.saidYes, price.joined], [480, 203, 76]);
    assert.equal(PRICE_TEST_ARMS.reduce((n, a) => n + a.swipers, 0), price.swipers);
    assert.equal(PRICE_TEST_ARMS.reduce((n, a) => n + a.saidYes, 0), price.saidYes);
    assert.equal(PRICE_TEST_ARMS.reduce((n, a) => n + a.joined, 0), price.joined);
  });
  it("headline chances: Results is 91/8/1 (designs web 16, phone 14), decided is 96/3/1 (spec/08); each adds up to 100%", () => {
    const pct = (n: number) => Math.round(n * 100);
    const onResults = Object.fromEntries(HEADLINE_FLAGSMITH_RESULTS.cards.map((c) => [c.variantKey, pct(c.chanceToBeatControl)]));
    assert.deepEqual(onResults, { A: 8, B: 91, C: 1 });
    assert.equal(Object.values(onResults).reduce((a, b) => a + b, 0), 100);
    const decided = DECIDED_HEADLINE_TEST.chanceByVariant;
    assert.deepEqual({ A: pct(decided.A), B: pct(decided.B), C: pct(decided.C) }, { A: 3, B: 96, C: 1 });
    assert.equal(pct(decided.A) + pct(decided.B) + pct(decided.C), 100);
  });
  it("waitlist: the four deck rows add up to the 118 pilot customers", () => {
    assert.equal(sum((c) => c.joined), 118);
    assert.equal(PRODUCT_TOTALS.waitlistAcrossProducts, 118);
  });
  it("612 counts distinct people: more than any deck, no more than the deck rows added up", () => {
    const sw = deckIds.map((id) => COUNTS[id].swipers);
    assert.equal(PRODUCT_TOTALS.voiceKhataSwipers, 612);
    assert.ok(PRODUCT_TOTALS.voiceKhataSwipers >= Math.max(...sw));
    assert.ok(PRODUCT_TOTALS.voiceKhataSwipers <= sw.reduce((a, b) => a + b, 0));
  });
  it("decks 1 and 2 are 438 swipers and 41 comments (web 25)", () => {
    assert.equal(RESULT_INSIGHT_SWIPERS, 438);
    assert.equal(COUNTS["voice-khata-headline"].comments + COUNTS["voice-khata-product-ui"].comments, 41);
  });
  it("QueueLess waitlist is 12 (spec/08 13.1)", () => {
    assert.equal(OTHER_DECK_COUNTS["queueless-description"].waitlist, 12);
  });
});

describe("every demo screen reads the same numbers", () => {
  it("Results (headline and price) equal the fixtures", async () => {
    const { demoDeckData } = await import("./demo");
    const h = demoDeckData("voice-khata-headline", NOW)!;
    const hc = COUNTS["voice-khata-headline"];
    assert.deepEqual([h.aggregates.total.swipers, h.aggregates.total.saidYes, h.aggregates.total.joined], [hc.swipers, hc.saidYes, hc.joined]);
    assert.equal(h.claimants.length, hc.joined);
    const p = demoDeckData("voice-khata-price", NOW)!;
    const c = COUNTS["voice-khata-price"];
    assert.deepEqual([p.aggregates.total.swipers, p.aggregates.total.saidYes, p.aggregates.total.joined], [c.swipers, c.saidYes, c.joined]);
  });

  it("My decks (swipers and waitlist per deck) equal the fixtures, and the product waitlist is 118", async () => {
    const svc = await import("@/lib/decks/service");
    const { DEMO_OWNER_ID } = await import("@/lib/decks/store-memory");
    const overview = await svc.getOverview(DEMO_OWNER_ID);
    const vk = overview.products.find((x) => x.name === "Voice Khata")!;
    assert.equal(vk.waitlist, 118);
    for (const d of vk.decks) {
      assert.equal(d.swipers, COUNTS[d.id].swipers, d.id);
      assert.equal(d.waitlist, COUNTS[d.id].joined, d.id);
    }
    const ql = overview.products.find((x) => x.name === "QueueLess")!;
    assert.equal(ql.waitlist, 12);
    assert.equal(demoDeckStats("voice-khata-price")?.swipers, 480);
  });

  it("the headline deck is 'Leading' on My decks and on Results, never 'Won' before approval", async () => {
    const svc = await import("@/lib/decks/service");
    const { DEMO_OWNER_ID } = await import("@/lib/decks/store-memory");
    const { loadResults } = await import("./load");
    const vk = (await svc.getOverview(DEMO_OWNER_ID)).products.find((x) => x.name === "Voice Khata")!;
    const myDecks = vk.decks.find((d) => d.id === "voice-khata-headline")!;
    const results = (await loadResults(DEMO_OWNER_ID, "voice-khata-headline", NOW))!;
    assert.match(myDecks.statusLabel, /^Leading/);
    assert.equal(results.verdict.kind, "leading");
    assert.match(results.deck.statusLabel, /^Leading/);
    assert.ok(DECKS[0].statusLabel.startsWith("Leading"));
  });

  it("Insights: 612 swipers, 118 waitlist, the Result cites decks 1 and 2 with 438 swipers, per-deck counts equal the fixtures", async () => {
    const { loadInsights } = await import("@/lib/insights/load");
    const { DEMO_OWNER_ID } = await import("@/lib/decks/store-memory");
    const p = (await loadInsights(DEMO_OWNER_ID, "voice-khata", NOW))!;
    assert.equal(p.swipers, 612);
    assert.equal(p.waitlist, 118);
    const result = p.insights.find((i) => i.tag === "Result")!;
    assert.match(result.sourceLine, /^Decks 1 and 2 · 438 swipers /);
    const { demoDecks } = await import("@/lib/insights/demo");
    for (const d of demoDecks()) {
      assert.equal(d.swipers, COUNTS[d.id].swipers, d.id);
      assert.equal(d.joined, COUNTS[d.id].joined, d.id);
      assert.equal(d.cards.reduce((n, c) => n + c.identities, 0), d.swipers, `${d.id} identities add up to its swipers`);
    }
  });

  it("Ask header shows the same 612 as Insights, and the price deck is 480 there too", async () => {
    const { buildAskContext, contextHeader } = await import("@/lib/ask");
    const { DEMO_OWNER_ID } = await import("@/lib/decks/store-memory");
    const ctx = (await buildAskContext(DEMO_OWNER_ID, "voice-khata-headline", NOW))!;
    const header = contextHeader(ctx);
    assert.equal(header.swipers, 612);
    assert.equal(header.demo, true);
    assert.equal(ctx.decks["voice-khata-price"].payload.totals.swipers, 480);
  });

  it("assistant decided state: 256 swipers split in the proportions of the results page", async () => {
    const { demoDecidedResults } = await import("@/lib/assistant/sources");
    const decided = demoDecidedResults();
    assert.equal(decided.cards.reduce((n, c) => n + c.identities, 0), DECIDED_HEADLINE_TEST.validSwipers);
    const split = decidedIdentitiesByVariant();
    for (const c of decided.cards) assert.equal(c.identities, split[c.variantKey as "A" | "B" | "C"]);
    for (const c of decided.cards) {
      const exact = (HEADLINE_FLAGSMITH_RESULTS.cards.find((b) => b.variantKey === c.variantKey)!.identities / 214) * 256;
      assert.ok(Math.abs(c.identities - exact) < 1, `${c.variantKey} is within one swiper of its share`);
    }
  });

  it("demo every-swipe rows match the Results per-version counts", async () => {
    const { demoDeckData } = await import("./demo");
    const { demoSwipes } = await import("@/lib/export/demo");
    const d = demoDeckData("voice-khata-headline", NOW)!;
    assert.equal(demoSwipes(d.cards, d.aggregates, NOW).length, COUNTS["voice-khata-headline"].swipers);
    const price = demoDeckData("voice-khata-price", NOW)!;
    assert.equal(demoSwipes(price.cards, price.aggregates, NOW).length, COUNTS["voice-khata-price"].swipers);
  });
});

describe("seed follows the fixtures", () => {
  it("claims per deck equal the fixture waitlist split; the price deck has the four prices", async () => {
    type Doc = { _id: string; deckId?: string; slug?: string; cardId?: string; value?: string; variantKey?: string };
    const seed = (await import(new URL("../../../scripts/seed/seed-data.mjs", import.meta.url).href)) as { decks: Doc[]; cards: Doc[]; claims: Doc[] };
    const { decks, cards, claims } = seed;
    const slug = (id: string) => decks.find((d) => d._id === id)?.slug as string;
    const perDeck = new Map<string, number>();
    for (const c of claims) perDeck.set(slug(c.deckId!), (perDeck.get(slug(c.deckId!)) ?? 0) + 1);
    for (const id of deckIds) assert.equal(perDeck.get(id), COUNTS[id].joined, id);
    assert.equal(claims.length, PRODUCT_TOTALS.waitlistAcrossProducts);
    const priceDeck = decks.find((d) => d.slug === "voice-khata-price")!;
    const priceCards = cards.filter((c) => c.deckId === priceDeck._id);
    assert.deepEqual(priceCards.map((c) => c.value), PRICE_TEST_ARMS.map((a) => `Rs ${a.price} / mo`));
    assert.deepEqual(
      priceCards.map((c) => claims.filter((x) => x.cardId === c._id).length),
      PRICE_TEST_ARMS.map((a) => a.joined),
    );
  });
});
