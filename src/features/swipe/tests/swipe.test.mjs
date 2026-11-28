// Run: npm test -- swipe
// No dependencies: node:test + Node's built-in TypeScript type stripping (Node >= 22.18).
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cardForVariant, composeCard, exposureVariant, localCard, matchCard, splitHeadline, splitPrice } from "../card.ts";
import { sampleSwipeDecks } from "../../../shared/lib/testing/sample-swipe-decks.ts";
import { isEligibleForFeed, pickNextDeck, shuffle } from "../ordering.ts";
import { stateFromHeaders, stateFromRegionCode } from "../server/region.ts";
import { nextCard, parseNextBody, parseSubmitBody, submitResponse } from "../server/service.ts";
import { createMemorySwipeStore } from "../server/store-memory.ts";
import { isTargetUser } from "../target.ts";
import { readFileSync } from "node:fs";
import { guestKey, isValidGuid, parseUserKey, swiperIdHex, userKey } from "../identity.ts";
import { signServedToken, verifyServedToken } from "../server/token.ts";
import {
  decideCounted,
  earningsFor,
  evaluateSwipe,
  isPaidCard,
  serverDwellMs,
  shouldSendToFlagsmith,
} from "../validity.ts";

const SECRET = "test-secret-0123456789abcdef";

/** An in-memory store holding the sample live decks (a test double: the app reads decks from MongoDB). */
const memorySwipeStore = createMemorySwipeStore(sampleSwipeDecks());

const seeded = (seed = 1) => () => {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("validity", () => {
  it("ignores answers under 300 ms, invalid under 2 s, valid from 2 s", () => {
    assert.deepEqual(evaluateSwipe(0), { ignored: true, valid: false });
    assert.deepEqual(evaluateSwipe(299), { ignored: true, valid: false });
    assert.deepEqual(evaluateSwipe(300), { ignored: false, valid: false });
    assert.deepEqual(evaluateSwipe(1999), { ignored: false, valid: false });
    assert.deepEqual(evaluateSwipe(2000), { ignored: false, valid: true });
  });

  it("computes dwell from the server clock and the signed servedAt only", () => {
    assert.equal(serverDwellMs({ servedAt: 9_000, now: 10_000 }), 1000);
    assert.equal(serverDwellMs({ servedAt: 1_000, now: 10_000 }), 9000);
    assert.equal(serverDwellMs({ servedAt: 20_000, now: 10_000 }), 0, "never negative");
  });

  it("counts feed swipes by quality flag and link swipes without the check", () => {
    assert.equal(decideCounted({ valid: true, source: "feed", swiperCounting: true }), true);
    assert.equal(decideCounted({ valid: true, source: "feed", swiperCounting: false }), false);
    assert.equal(decideCounted({ valid: true, source: "link", swiperCounting: false }), true);
    assert.equal(decideCounted({ valid: false, source: "link", swiperCounting: true }), false);
  });

  it("a signed-in swiper's quality flag always applies, whatever the source", () => {
    assert.equal(decideCounted({ valid: true, source: "link", swiperCounting: false, guest: false }), false);
    assert.equal(decideCounted({ valid: true, source: "feed", swiperCounting: false, guest: false }), false);
    assert.equal(decideCounted({ valid: true, source: "link", swiperCounting: true, guest: false }), true);
    assert.equal(decideCounted({ valid: true, source: "feed", swiperCounting: false, guest: true }), false);
    assert.equal(decideCounted({ valid: true, source: "link", swiperCounting: false, guest: true }), true);
  });

  it("sends to Flagsmith only when valid AND counted", () => {
    assert.equal(shouldSendToFlagsmith({ valid: true, counted: true }), true);
    assert.equal(shouldSendToFlagsmith({ valid: true, counted: false }), false);
    assert.equal(shouldSendToFlagsmith({ valid: false, counted: true }), false);
    assert.equal(shouldSendToFlagsmith({ valid: false, counted: false }), false);
  });

  it("pays only feed swipes on boosted decks, valid and counted, with the kill switch on", () => {
    const boosted = { budget: 410, spent: 0 };
    assert.equal(isPaidCard({ source: "feed", boost: boosted, paidSwipingFlag: true }), true);
    assert.equal(isPaidCard({ source: "link", boost: boosted, paidSwipingFlag: true }), false);
    assert.equal(isPaidCard({ source: "feed", boost: { budget: 0, spent: 0 }, paidSwipingFlag: true }), false);
    assert.equal(isPaidCard({ source: "feed", boost: { budget: 5, spent: 5 }, paidSwipingFlag: true }), false);
    assert.equal(isPaidCard({ source: "feed", boost: boosted, paidSwipingFlag: false }), false);
    assert.equal(earningsFor({ paid: true, valid: true, counted: true }), 0.25);
    assert.equal(earningsFor({ paid: true, valid: false, counted: false }), 0);
    assert.equal(earningsFor({ paid: true, valid: true, counted: false }), 0);
    assert.equal(earningsFor({ paid: false, valid: true, counted: true }), 0);
  });
});

describe("isTargetUser", () => {
  it("compares the swipe-time role with the product's target roles", () => {
    assert.equal(isTargetUser("Shop owner", ["Shop owner", "Wholesaler"]), true);
    assert.equal(isTargetUser("Student", ["Shop owner", "Wholesaler"]), false);
    assert.equal(isTargetUser(undefined, ["Shop owner"]), false);
    assert.equal(isTargetUser("Shop owner", []), false);
  });
});

describe("ordering", () => {
  const decks = ["a", "b", "c", "d"].map((id) => ({ id }));

  it("shuffles without losing or duplicating items", () => {
    const out = shuffle([1, 2, 3, 4, 5, 6], seeded(7));
    assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5, 6]);
  });

  it("shows every deck exactly once, in random order, then runs out", () => {
    const seen = new Set();
    const order = [];
    const rng = seeded(42);
    for (;;) {
      const next = pickNextDeck({ decks, seenDeckIds: seen, rng });
      if (!next) break;
      assert.ok(!seen.has(next.id), "a deck never repeats");
      seen.add(next.id);
      order.push(next.id);
    }
    assert.deepEqual([...order].sort(), ["a", "b", "c", "d"]);
  });

  it("is random across seeds (not always the same order)", () => {
    const firsts = new Set();
    for (let s = 1; s <= 30; s++) firsts.add(pickNextDeck({ decks, seenDeckIds: new Set(), rng: seeded(s) }).id);
    assert.ok(firsts.size > 1);
  });

  it("puts the link deck first, then the random feed", () => {
    assert.equal(pickNextDeck({ decks, seenDeckIds: new Set(), firstDeckId: "c", rng: seeded(1) }).id, "c");
    const next = pickNextDeck({ decks, seenDeckIds: new Set(["c"]), firstDeckId: "c", rng: seeded(1) });
    assert.notEqual(next.id, "c");
  });

  it("applies product audience and home chips", () => {
    const deck = {
      product: {
        industry: "Retail",
        targetUsers: ["Shop owner"],
        audience: { who: "targetOnly", states: ["Gujarat"], interests: ["Finance"] },
      },
    };
    const priya = { role: "Shop owner", state: "Gujarat", interests: ["Finance", "Retail"] };
    assert.equal(isEligibleForFeed(deck, priya), true);
    assert.equal(isEligibleForFeed(deck, { ...priya, role: "Student" }), false);
    assert.equal(isEligibleForFeed(deck, { ...priya, state: "Delhi" }), false);
    assert.equal(isEligibleForFeed(deck, { ...priya, interests: ["Pets"] }), false);
    assert.equal(isEligibleForFeed(deck, priya, ["Food"]), false);
    assert.equal(isEligibleForFeed(deck, priya, ["Retail", "Food"]), true);
  });
});

describe("region", () => {
  it("maps edge region headers to standard states and never needs the IP", () => {
    assert.equal(stateFromRegionCode("GJ"), "Gujarat");
    assert.equal(stateFromRegionCode("IN-MH"), "Maharashtra");
    assert.equal(stateFromRegionCode("ZZ"), undefined);
    const h = (o) => ({ get: (k) => o[k] ?? null });
    const before = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      assert.equal(stateFromHeaders(h({ "x-vercel-ip-country": "IN", "x-vercel-ip-country-region": "WB" })), "West Bengal");
      assert.equal(stateFromHeaders(h({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "CA" })), undefined);
      assert.equal(stateFromHeaders(h({ "x-forwarded-for": "203.0.113.9" })), undefined);
    } finally {
      if (before === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = before;
    }
  });

  it("ignores client-sent geo headers off Vercel (they can be spoofed)", () => {
    const before = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      const h = { get: (k) => ({ "x-vercel-ip-country": "IN", "x-vercel-ip-country-region": "WB" })[k] ?? null };
      assert.equal(stateFromHeaders(h), undefined);
    } finally {
      if (before !== undefined) process.env.VERCEL = before;
    }
  });
});

describe("card rendering", () => {
  const decks = sampleSwipeDecks();
  const headlineDeck = decks.find((d) => d.slug === "voice-khata-headline");
  const languageDeck = decks.find((d) => d.slug === "voice-khata-language");
  const ctx = { source: "feed", paid: true, paidRs: 0.25, counting: true };

  it("fills the tested field from the card and the rest from the locked fields", () => {
    const view = composeCard(headlineDeck, headlineDeck.cards[1], ctx);
    assert.equal(view.headline, "Stop chasing payments. Get paid on time.");
    assert.deepEqual(view.headlineLines, ["Stop chasing payments.", "Get paid on time."]);
    assert.deepEqual(view.price, { amount: "Rs 299", unit: "/ mo" });
    assert.equal(view.reward, "Get 3 months free at launch");
    assert.deepEqual(view.madeFor, ["Shop owner", "Wholesaler"]);
    assert.equal(view.lang, "en");
  });

  it("renders the whole card in the language variant", () => {
    const view = composeCard(languageDeck, languageDeck.cards[1], ctx);
    assert.equal(view.language, "Hindi");
    assert.equal(view.lang, "hi");
    assert.match(view.headline, /पेमेंट/);
    assert.match(view.question, /क्या आप/);
    assert.equal(view.positiveLabel, "हाँ, मैं दूँगा");
    assert.equal(view.headlineLines[1], "समय पर पैसा पाएं।");
  });

  it("splits headline and price text", () => {
    assert.deepEqual(splitHeadline("Your whole ledger for Rs 10 a day."), ["Your whole ledger for Rs 10 a day.", null]);
    assert.deepEqual(splitPrice("2% per load"), { amount: "2%", unit: "per load" });
    assert.deepEqual(splitPrice("Rs 999"), { amount: "Rs 999", unit: null });
  });

  it("matches the value Flagsmith served to a card, else falls back stably", () => {
    assert.equal(matchCard(headlineDeck.cards, "Your whole ledger for Rs 10 a day.").variantKey, "C");
    assert.equal(matchCard(headlineDeck.cards, "B").variantKey, "B");
    assert.equal(matchCard(languageDeck.cards, "Hindi").variantKey, "B");
    assert.equal(matchCard(headlineDeck.cards, "nope"), undefined);
    assert.equal(matchCard(headlineDeck.cards, null), undefined);
    const a = localCard(headlineDeck.cards, headlineDeck.id, "guid-123456");
    assert.equal(localCard(headlineDeck.cards, headlineDeck.id, "guid-123456").id, a.id);
  });
});

describe("request parsing", () => {
  it("validates submit bodies", () => {
    const ok = { swiperGuid: "abcdefgh12", deckId: "d", cardId: "c", answer: "positive", token: "v1.a.b" };
    assert.ok(!("error" in parseSubmitBody(ok)));
    assert.ok("error" in parseSubmitBody({ ...ok, answer: "maybe" }));
    assert.ok("error" in parseSubmitBody({ ...ok, swiperGuid: "x" }));
    assert.ok("error" in parseSubmitBody({ ...ok, token: undefined }), "the served token is required");
    assert.ok("error" in parseSubmitBody({ ...ok, token: "" }));
    assert.ok("error" in parseSubmitBody(null));
  });

  it("drops client-declared source, dwellMs and servedAt", () => {
    const parsed = parseSubmitBody({
      swiperGuid: "abcdefgh12",
      deckId: "d",
      cardId: "c",
      answer: "positive",
      token: "v1.a.b",
      source: "link",
      dwellMs: 99999,
      servedAt: 1,
    });
    assert.deepEqual(Object.keys(parsed.value).sort(), ["answer", "cardId", "deckId", "token"]);
  });

  it("rejects a guid shaped like a Mongo ObjectId", () => {
    assert.equal(isValidGuid("507f1f77bcf86cd799439011"), false);
    assert.equal(isValidGuid("abcdefgh12"), true);
    assert.equal(isValidGuid("3f2b8c1e-5d44-4c1a-9a3e-0b1c2d3e4f50"), true);
  });

  it("keeps only standard interests in next bodies", () => {
    const parsed = parseNextBody({ swiperGuid: "abcdefgh12", interests: ["Retail", "Nonsense"], seen: ["a", 3] });
    assert.deepEqual(parsed.interests, ["Retail"]);
    assert.deepEqual(parsed.seen, ["a"]);
  });
});

/**
 * The memory store with every deck marked as running on Flagsmith (`experimentId`), the way a real deck looks
 * after a successful publish. `experimentId: null` gives local-split decks (publish failed / not configured).
 */
function storeWith(experimentId) {
  const tag = (deck) => (deck && experimentId ? { ...deck, experimentId } : deck);
  return {
    listFeedDecks: async () => (await memorySwipeStore.listFeedDecks()).map(tag),
    getDeckBySlug: async (slug) => tag(await memorySwipeStore.getDeckBySlug(slug)),
    getDeckById: async (id) => tag(await memorySwipeStore.getDeckById(id)),
    hasResponded: (d, k) => memorySwipeStore.hasResponded(d, k),
    saveResponse: (r) => memorySwipeStore.saveResponse(r),
    exposed: [],
    async markExposed(id) {
      this.exposed.push(id);
      await memorySwipeStore.markExposed(id);
    },
  };
}

/** Fake dependencies: the real memory store, recording Flagsmith calls. */
function makeDeps(overrides = {}, { experimentId = "42" } = {}) {
  const calls = { assign: [], track: [], exposure: [] };
  const deps = {
    store: storeWith(experimentId),
    async assign(deck, key, source) {
      calls.assign.push({ deck: deck.id, key, source });
      return { variant: deck.cards[1].variantKey, value: deck.cards[1].value };
    },
    async trackExposure(input) {
      calls.exposure.push({ deck: input.deck.id, key: input.swiperKey, source: input.source, variant: input.variant });
    },
    async trackAnswerPositive(input) {
      calls.track.push({ deck: input.deck.id, key: input.swiperKey, source: input.source });
    },
    async paidSwiping() {
      return true;
    },
    now: () => 100_000,
    rng: seeded(3),
    secret: SECRET,
    ...overrides,
  };
  return { deps, calls };
}

const priya = (key, extra = {}) => ({
  key,
  guest: true,
  role: "Shop owner",
  state: "Gujarat",
  interests: ["Retail", "Finance", "Logistics"],
  counting: true,
  ...extra,
});

describe("nextCard", () => {
  it("serves each sample deck once in the feed, then runs out", async () => {
    const { deps } = makeDeps();
    const swiper = priya("feed-once-1");
    const slugs = [];
    for (let i = 0; i < 10; i++) {
      const res = await nextCard(deps, { swiper, interests: [], seen: slugs.map((s) => s.deckId) });
      if (!res.card) break;
      assert.ok(!slugs.some((s) => s.deckId === res.card.deckId), "no repeat");
      slugs.push(res.card);
    }
    assert.equal(slugs.length, 4);
    const after = await nextCard(deps, { swiper, interests: [], seen: slugs.map((s) => s.deckId) });
    assert.equal(after.card, null);
  });

  it("puts the link deck first and tags it link, never paid", async () => {
    const { deps } = makeDeps();
    const res = await nextCard(deps, {
      swiper: priya("link-first-1"),
      firstSlug: "voice-khata-headline",
      interests: [],
      seen: [],
    });
    assert.equal(res.card.slug, "voice-khata-headline");
    assert.equal(res.card.source, "link");
    assert.equal(res.card.paid, false);
    const again = await nextCard(deps, {
      swiper: priya("link-first-1"),
      firstSlug: "voice-khata-headline",
      interests: [],
      seen: ["voice-khata-headline"],
    });
    assert.equal(again.card.source, "feed");
    assert.notEqual(again.card.slug, "voice-khata-headline");
  });

  it("marks boosted feed cards paid and the unboosted deck unpaid", async () => {
    const { deps } = makeDeps();
    const paidByDeck = {};
    const seen = [];
    for (;;) {
      const res = await nextCard(deps, { swiper: priya("paid-check-1"), interests: [], seen });
      if (!res.card) break;
      paidByDeck[res.card.slug] = res.card.paid;
      seen.push(res.card.deckId);
    }
    assert.equal(paidByDeck["voice-khata-headline"], true);
    assert.equal(paidByDeck["queueless-description"], true);
    assert.equal(paidByDeck["loadmate-headline"], false);
  });

  it("does not enroll not-counted swipers in Flagsmith", async () => {
    const { deps, calls } = makeDeps();
    await nextCard(deps, { swiper: priya("uncounted-1", { counting: false }), interests: [], seen: [] });
    assert.equal(calls.assign.length, 0);
    await nextCard(deps, { swiper: priya("counted-1"), interests: [], seen: [] });
    assert.equal(calls.assign.length, 1);
  });

  it("serves the card for Flagsmith's variant: an option key, or 'control' for the control card", async () => {
    const first = (key) => ({ swiper: priya(key), firstSlug: "voice-khata-headline", interests: [], seen: [] });
    const b = await nextCard(makeDeps().deps, first("variant-1"));
    assert.equal(b.card.cardId, "voice-khata-headline-B");
    const control = await nextCard(makeDeps({ assign: async () => ({ variant: "control", value: "x" }) }).deps, first("variant-2"));
    assert.equal(control.card.cardId, "voice-khata-headline-A");
    // No variant (older server): match the served value; nothing usable: local card.
    const byValue = await nextCard(
      makeDeps({ assign: async (deck) => ({ variant: null, value: deck.cards[2].value }) }).deps,
      first("variant-3"),
    );
    assert.equal(byValue.card.cardId, "voice-khata-headline-C");
    const none = await nextCard(makeDeps({ assign: async () => null }).deps, first("variant-4"));
    assert.ok(none.card);
  });

  it("cardForVariant and exposureVariant agree on control = cards[0]", () => {
    const cards = [
      { id: "a", variantKey: "A", value: "x" },
      { id: "b", variantKey: "B", value: "y" },
    ];
    assert.equal(cardForVariant(cards, "control").id, "a");
    assert.equal(cardForVariant(cards, "B").id, "b");
    assert.equal(cardForVariant(cards, "Z"), undefined);
    assert.equal(cardForVariant(cards, null), undefined);
    assert.equal(exposureVariant(cards, cards[0]), "control");
    assert.equal(exposureVariant(cards, cards[1]), "B");
  });

  it("a deck without an experimentId is a local split: no Flagsmith identity call", async () => {
    const { deps, calls } = makeDeps({}, { experimentId: null });
    const res = await nextCard(deps, { swiper: priya("local-split-1"), firstSlug: "voice-khata-headline", interests: [], seen: [] });
    assert.ok(res.card);
    assert.equal(calls.assign.length, 0);
  });

  it("falls back to a local card when Flagsmith throws", async () => {
    const { deps } = makeDeps({
      async assign() {
        throw new Error("not configured");
      },
    });
    const res = await nextCard(deps, { swiper: priya("fallback-1"), interests: [], seen: [] });
    assert.ok(res.card);
  });
});

describe("served token", () => {
  const claims = { deckId: "d1", cardKey: "c1", servedAt: 50_000, source: "feed" };
  const opts = { now: 60_000, maxAgeMs: 3_600_000 };

  it("round-trips for the same swiper only", () => {
    const token = signServedToken(SECRET, "u:abc", claims);
    assert.deepEqual(verifyServedToken(SECRET, "u:abc", token, opts), { ok: true, claims });
    assert.equal(verifyServedToken(SECRET, "g:abc", token, opts).reason, "signature", "another identity");
    assert.equal(verifyServedToken("another-secret-0123456789", "u:abc", token, opts).reason, "signature");
  });

  it("rejects tampered fields, garbage, expired and future tokens", () => {
    const token = signServedToken(SECRET, "u:abc", claims);
    const [v, payload, sig] = token.split(".");
    const forge = (patch) =>
      [v, Buffer.from(JSON.stringify({ d: "d1", c: "c1", t: 50_000, s: "feed", ...patch })).toString("base64url"), sig].join(".");
    assert.equal(verifyServedToken(SECRET, "u:abc", forge({ s: "link" }), opts).reason, "signature");
    assert.equal(verifyServedToken(SECRET, "u:abc", forge({ t: 1 }), opts).reason, "signature");
    assert.equal(verifyServedToken(SECRET, "u:abc", forge({ c: "c2" }), opts).reason, "signature");
    assert.equal(verifyServedToken(SECRET, "u:abc", `${v}.${payload}.${sig.slice(0, -2)}`, opts).reason, "signature");
    assert.equal(verifyServedToken(SECRET, "u:abc", "nope", opts).reason, "malformed");
    assert.equal(verifyServedToken(SECRET, "u:abc", undefined, opts).reason, "malformed");
    assert.equal(verifyServedToken(SECRET, "u:abc", token, { now: 50_000 + 3_600_001, maxAgeMs: 3_600_000 }).reason, "expired");
    assert.equal(verifyServedToken(SECRET, "u:abc", token, { now: 10_000, maxAgeMs: 3_600_000 }).reason, "future");
  });
});

describe("swiper identity (H1)", () => {
  const userId = "507f1f77bcf86cd799439011";

  it("namespaces guests so a 24-hex guid never maps to a user", () => {
    assert.notEqual(guestKey(userId), userKey(userId));
    assert.equal(parseUserKey(userKey(userId)), userId);
    assert.equal(parseUserKey(guestKey(userId)), undefined);
    assert.equal(parseUserKey(userId), undefined, "an unprefixed key is never a user");
    assert.equal(parseUserKey("u:not-an-object-id"), undefined);
  });

  it("only a user key resolves to the user's ObjectId in Mongo", async () => {
    assert.equal(swiperIdHex(userKey(userId)), userId);
    assert.notEqual(swiperIdHex(guestKey(userId)), userId);
    assert.notEqual(swiperIdHex(userId), userId, "even a raw 24-hex key is hashed");
    assert.match(swiperIdHex(guestKey("abcdefgh12")), /^[0-9a-f]{24}$/);
    assert.equal(swiperIdHex(guestKey("abcdefgh12")), swiperIdHex(guestKey("abcdefgh12")));
  });

  it("M1: the models declare the unique indexes the upserts rely on", () => {
    const src = readFileSync(new URL("../../../models/index.ts", import.meta.url), "utf8");
    assert.match(src, /responseSchema\.index\(\{ deckId: 1, swiperId: 1 \}, \{ unique: true \}\)/);
    assert.match(src, /claimSchema\.index\(\{ deckId: 1, email: 1 \}, \{ unique: true \}\)/);
  });

  it("a guest cannot occupy a user's one-answer slot", async () => {
    const { deps } = makeDeps();
    const victim = priya(userKey(userId), { guest: false });
    const attacker = priya(guestKey(userId), { guest: true });
    const t = (swiper) => mint(swiper);
    assert.equal((await submitResponse(deps, sub(attacker, t(attacker)), { swiper: attacker })).ok, true);
    assert.equal(await deps.store.hasResponded("voice-khata-headline", victim.key), false);
    assert.equal((await submitResponse(deps, sub(victim, t(victim)), { swiper: victim })).ok, true);
  });
});

const DECK = "voice-khata-headline";
const CARD = "voice-khata-headline-B";
/** A token the server would have issued, served 3 s before `now` (100_000) unless overridden. */
const mint = (swiper, over = {}) =>
  signServedToken(SECRET, swiper.key, { deckId: DECK, cardKey: CARD, servedAt: 97_000, source: "feed", ...over });
const sub = (swiper, token, over = {}) => ({ deckId: DECK, cardId: CARD, answer: "positive", token, ...over });

describe("submitResponse", () => {
  it("valid + counted positive swipe is stored and sent to Flagsmith once", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-ok-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper, region: "Gujarat" });
    assert.equal(out.ok, true);
    assert.equal(out.valid, true);
    assert.equal(out.counted, true);
    assert.equal(out.paid, true);
    assert.equal(out.earnedRs, 0.25);
    assert.equal(out.sentToFlagsmith, true);
    assert.equal(calls.track.length, 1);
    assert.equal(calls.track[0].source, "feed");
    assert.deepEqual(calls.exposure, [{ deck: DECK, key: "sub-ok-1", source: "feed", variant: "B" }]);
    assert.equal(typeof out.servedToken, "string");
    assert.deepEqual(deps.store.exposed, [out.responseId], "the accepted exposure is recorded on the response");
  });

  it("the control card's exposure value is 'control'", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-ctrl-1");
    const card = "voice-khata-headline-A";
    await submitResponse(deps, sub(swiper, mint(swiper, { cardKey: card }), { cardId: card }), { swiper });
    assert.equal(calls.exposure[0].variant, "control");
  });

  it("a local-split deck (no experimentId) sends nothing to Flagsmith", async () => {
    const { deps, calls } = makeDeps({}, { experimentId: null });
    const swiper = priya("sub-local-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.counted, true);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(calls.exposure.length + calls.track.length, 0);
  });

  it("no answer_positive without its exposure", async () => {
    const { deps, calls } = makeDeps({
      async trackExposure() {
        throw new Error("down");
      },
    });
    const swiper = priya("sub-noexp-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(calls.track.length, 0);
    assert.deepEqual(deps.store.exposed, [], "a refused exposure is not recorded, so no reward_claim follows either");
  });

  it("stores role at swipe time, isTargetUser, region and counted on the response", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-role-1", { role: "Doctor" });
    const token = mint(swiper, { deckId: "queueless-description", cardKey: "queueless-description-A" });
    await submitResponse(deps, sub(swiper, token, { deckId: "queueless-description", cardId: "queueless-description-A" }), {
      swiper,
      region: "Delhi",
    });
    const stored = [...memorySwipeStore.responses()].find((r) => r.deckId === "queueless-description" && r.swiperKey === "sub-role-1");
    assert.equal(stored.role, "Doctor");
    assert.equal(stored.isTargetUser, true);
    assert.equal(stored.region, "Delhi");
    assert.equal(stored.counted, true);
    assert.equal(stored.ip, undefined, "no raw IP on the record");
  });

  it("an invalid (under 2 s) swipe is stored but never reaches Flagsmith", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-fast-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper, { servedAt: 98_800 })), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.valid, false);
    assert.equal(out.counted, false);
    assert.equal(out.earnedRs, 0);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(calls.track.length, 0);
    assert.equal(calls.exposure.length, 0, "invalid swipes never reach Flagsmith, not even as exposures");
  });

  it("a not-counted swiper's valid feed swipe is stored, unpaid and never reaches Flagsmith", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-uncounted-1", { counting: false });
    const out = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.valid, true);
    assert.equal(out.counted, false);
    assert.equal(out.earnedRs, 0);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(calls.track.length, 0);
    assert.equal(calls.exposure.length, 0);
  });

  it("H3: dwell comes from the signed servedAt; a client claiming 5 s changes nothing", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-liar-1");
    // Served 400 ms ago; the body claims dwellMs 5000 and an old servedAt. Both are ignored.
    const out = await submitResponse(
      deps,
      { ...sub(swiper, mint(swiper, { servedAt: 99_600 })), dwellMs: 5000, servedAt: 1 },
      { swiper },
    );
    assert.equal(out.ok, true);
    assert.equal(out.valid, false);
    assert.equal(calls.track.length, 0);
  });

  it("ignores answers under the 300 ms floor without storing them", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-ignored-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper, { servedAt: 99_900 })), { swiper });
    assert.deepEqual(out, { ok: false, ignored: true, reason: "too_fast" });
    assert.equal(await deps.store.hasResponded(DECK, "sub-ignored-1"), false);
  });

  it("H3: a missing, forged, expired, future or foreign token is refused and stores nothing", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-token-1");
    const other = priya("sub-token-2");
    const good = mint(swiper);
    const [v, , sig] = good.split(".");
    const forged = [v, Buffer.from(JSON.stringify({ d: DECK, c: CARD, t: 1, s: "feed" })).toString("base64url"), sig].join(".");
    for (const token of [undefined, "", "junk", forged, mint(other), mint(swiper, { servedAt: 100_000 - 3_600_001 }), mint(swiper, { servedAt: 200_000 })]) {
      const out = await submitResponse(deps, sub(swiper, token), { swiper });
      assert.equal(out.ok, false);
      assert.equal(out.status, 400);
    }
    assert.equal(await deps.store.hasResponded(DECK, swiper.key), false);
    assert.equal(calls.track.length, 0);
  });

  it("H3: the answered card must be the served card and deck", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-bind-1");
    const token = mint(swiper);
    assert.equal((await submitResponse(deps, sub(swiper, token, { cardId: "voice-khata-headline-C" }), { swiper })).status, 400);
    assert.equal((await submitResponse(deps, sub(swiper, token, { deckId: "queueless-description" }), { swiper })).status, 400);
    assert.equal(await deps.store.hasResponded(DECK, swiper.key), false);
  });

  it("H3: a token cannot be replayed (one answer per deck and swiper)", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-replay-1");
    const token = mint(swiper);
    assert.equal((await submitResponse(deps, sub(swiper, token), { swiper })).ok, true);
    const again = await submitResponse(deps, sub(swiper, token), { swiper });
    assert.equal(again.status, 409);
    assert.equal(calls.track.length, 1, "no second Flagsmith event");
  });

  it("H2: a client-declared source never makes a not-counted swipe counted", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-source-1", { counting: false, guest: false });
    // The token was served as a feed card; the body claims link.
    const out = await submitResponse(deps, { ...sub(swiper, mint(swiper)), source: "link" }, { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.source, "feed");
    assert.equal(out.counted, false);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(calls.track.length, 0);
  });

  it("H2: a not-counted signed-in swiper stays uncounted even on a link-signed card", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-source-2", { counting: false, guest: false });
    const out = await submitResponse(deps, sub(swiper, mint(swiper, { source: "link" })), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.counted, false);
    assert.equal(out.paid, false);
    assert.equal(calls.track.length, 0);
  });

  it("H2: flipping the signed source breaks the signature", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-source-3", { counting: false });
    const [v, payload, sig] = mint(swiper).split(".");
    const flipped = JSON.parse(Buffer.from(payload, "base64url").toString());
    flipped.s = "link";
    const token = [v, Buffer.from(JSON.stringify(flipped)).toString("base64url"), sig].join(".");
    assert.equal((await submitResponse(deps, sub(swiper, token), { swiper })).status, 400);
  });

  it("guest link answers need no quality check, are never paid, and carry the link source", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-link-1", { counting: false });
    const out = await submitResponse(deps, sub(swiper, mint(swiper, { source: "link" })), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.counted, true);
    assert.equal(out.paid, false);
    assert.equal(out.earnedRs, 0);
    assert.equal(calls.track[0].source, "link");
  });

  it("negative valid swipes are stored and counted, send their exposure but no answer_positive event", async () => {
    const { deps, calls } = makeDeps();
    const swiper = priya("sub-neg-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper), { answer: "negative" }), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.counted, true);
    assert.equal(calls.track.length, 0);
    assert.equal(calls.exposure.length, 1, "exposures cover every counted answer, so conversion rates are not 100%");
  });

  it("one vote per swiper per deck", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-dup-1");
    assert.equal((await submitResponse(deps, sub(swiper, mint(swiper)), { swiper })).ok, true);
    const second = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper });
    assert.equal(second.ok, false);
    assert.equal(second.status, 409);
  });

  it("rejects unknown decks, cards from another deck and draft-like states", async () => {
    const { deps } = makeDeps();
    const swiper = priya("sub-bad-1");
    const nope = mint(swiper, { deckId: "nope" });
    assert.equal((await submitResponse(deps, sub(swiper, nope, { deckId: "nope" }), { swiper })).status, 404);
    const foreign = mint(swiper, { cardKey: "loadmate-headline-A" });
    assert.equal((await submitResponse(deps, sub(swiper, foreign, { cardId: "loadmate-headline-A" }), { swiper })).status, 400);
  });

  it("a Flagsmith failure does not lose the stored response", async () => {
    const { deps } = makeDeps({
      async trackAnswerPositive() {
        throw new Error("down");
      },
    });
    const swiper = priya("sub-down-1");
    const out = await submitResponse(deps, sub(swiper, mint(swiper)), { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(await deps.store.hasResponded(DECK, "sub-down-1"), true);
  });

  it("next-card responses carry a token that the same swiper can answer with", async () => {
    const { deps } = makeDeps({ now: () => 100_000 });
    const swiper = priya("sub-e2e-1");
    const next = await nextCard(deps, { swiper, firstSlug: DECK, interests: [], seen: [] });
    assert.equal(typeof next.token, "string");
    const later = { ...deps, now: () => 103_000 };
    const out = await submitResponse(later, { deckId: next.card.deckId, cardId: next.card.cardId, answer: "positive", token: next.token }, { swiper });
    assert.equal(out.ok, true);
    assert.equal(out.source, "link", "the server decided the source when it served the card");
    assert.equal(out.valid, true);
  });

  it("nextCard refuses to serve in production without a signing secret", async () => {
    const { deps } = makeDeps({ secret: undefined });
    const env = process.env;
    const prev = [env.NODE_ENV, env.SWIPE_SIGNING_SECRET];
    env.NODE_ENV = "production";
    delete env.SWIPE_SIGNING_SECRET;
    try {
      await assert.rejects(nextCard(deps, { swiper: priya("prod-1"), interests: [], seen: [] }), /SWIPE_SIGNING_SECRET/);
    } finally {
      env.NODE_ENV = prev[0];
      if (prev[1] !== undefined) env.SWIPE_SIGNING_SECRET = prev[1];
    }
  });
});
