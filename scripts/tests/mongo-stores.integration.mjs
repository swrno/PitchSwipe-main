// Opt-in integration test for the MongoDB store adapters (decks, swipe, claims) against a real server.
//
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/pitchswipe_it_local npm run test:mongo
//
// Skips (exit 0) when MONGODB_TEST_URI is unset. The database name must start with "pitchswipe_it_" (refused
// otherwise, before connecting); the whole database is dropped at the end, also when a test fails. MONGODB_URI is
// never read: it is overwritten with MONGODB_TEST_URI because connectDb() (src/shared/lib/db.ts) connects to MONGODB_URI.
// Not registered in scripts/run-tests.mjs, whose judge() fails a suite that runs no tests.
import assert from "node:assert/strict";
import { register } from "node:module";
import { after, before, describe, it } from "node:test";
import mongoose from "mongoose";

const PREFIX = "pitchswipe_it_";
const TEST_URI = process.env.MONGODB_TEST_URI;

/** Database name from a mongodb:// or mongodb+srv:// URI ("" when the URI names none). */
function dbNameOf(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri);
  return match ? decodeURIComponent(match[1]) : "";
}

const skip = TEST_URI ? false : "MONGODB_TEST_URI is not set";
if (skip) {
  console.log(`skip: Mongo store integration tests (${skip}). Run: MONGODB_TEST_URI=mongodb://127.0.0.1:27017/${PREFIX}local npm run test:mongo`);
} else {
  const name = dbNameOf(TEST_URI);
  if (!name.startsWith(PREFIX)) {
    throw new Error(`Refusing to run: the MONGODB_TEST_URI database name must start with "${PREFIX}" (got "${name}"). This test drops it.`);
  }
  // connectDb() reads MONGODB_URI; point it at the throwaway database so an inherited MONGODB_URI is never used.
  process.env.MONGODB_URI = TEST_URI;
}

// src/models imports `models` by name from mongoose, which Node's ESM interop does not expose; the seed's shim fixes
// that. Registered before the app modules load, hence the dynamic imports. Importing them does not connect.
register("../seed/mongoose-hooks.mjs", import.meta.url);
const { connectDb } = await import("../../src/shared/lib/db.ts");
const { createMongoStore } = await import("../../src/features/decks/server/store-mongo.ts");
const { EDIT_LOCK_TTL_MS, PUBLISH_CLAIM_TTL_MS, isPublishClaimed } = await import("../../src/features/decks/server/store.ts");
const { createMongoSwipeStore } = await import("../../src/features/swipe/server/store-mongo.ts");
const { createMongoClaimsStore } = await import("../../src/features/claims/server/store-mongo.ts");
const { Card, Claim, Deck, Product, Response } = await import("../../src/models/index.ts");

/** Throws unless the live connection is on a pitchswipe_it_ database. Called before any write and before the drop. */
function assertTestDb() {
  const name = mongoose.connection.db?.databaseName ?? "";
  if (!name.startsWith(PREFIX)) throw new Error(`Refusing: connected database "${name}" does not start with "${PREFIX}".`);
  return name;
}

/** Mongoose warnings (deprecations) seen during the run; the last test fails on any. */
const mongooseWarnings = [];
process.on("warning", (warning) => {
  if (warning.code === "MONGOOSE") mongooseWarnings.push(warning.message);
});

const RUN = Date.now().toString(36);
const owner = new mongoose.Types.ObjectId().toHexString();
const store = createMongoStore();
const swipe = createMongoSwipeStore();
const claims = createMongoClaimsStore();
const KEYS = ["A", "B", "C", "D"];
const cardsOf = (tag) => KEYS.map((k) => ({ variantKey: k, value: `${tag}-${k}` }));
let seq = 0;
let product;

async function newDraft(cards = cardsOf("v0"), over = {}) {
  const n = ++seq;
  return store.createDeck(owner, {
    ownerId: owner,
    productId: product.id,
    slug: `it-${RUN}-${n}`,
    variable: "headline",
    shared: { description: "Integration test deck." },
    question: "Q0",
    positiveLabel: "Yes",
    negativeLabel: "No",
    flagName: `deck_it_${RUN}_${n}`,
    status: "draft",
    listedInFeed: false,
    boost: { perSwipe: 0, budget: 0, spent: 0 },
    cards,
    ...over,
  });
}

const oid = (id) => new mongoose.Types.ObjectId(id);
const rawDeck = (id) => Deck.collection.findOne({ _id: oid(id) });
const setRaw = (id, fields) => Deck.collection.updateOne({ _id: oid(id) }, { $set: fields });
const ago = (ms) => new Date(Date.now() - ms);
const values = (deck) => deck.cards.map((c) => `${c.variantKey}=${c.value}`).join(",");

/** Holds the next Card.insertMany (the second half of a card replace) until release(); restore() undoes the wrap. */
function holdCardInsert({ fail = false } = {}) {
  const original = Card.insertMany;
  let release;
  let entered;
  const gate = new Promise((resolve) => (release = resolve));
  const reached = new Promise((resolve) => (entered = resolve));
  Card.insertMany = async function (...args) {
    Card.insertMany = original;
    entered();
    await gate;
    if (fail) throw new Error("simulated card insert failure");
    return original.apply(this, args);
  };
  return { reached, release: () => release(), restore: () => (Card.insertMany = original) };
}

describe("Mongo stores (integration)", { skip }, () => {
  before(async () => {
    await connectDb();
    assertTestDb();
    // Unique indexes (slug, flagName, deckId+variantKey, deckId+swiperId) are part of the behaviour under test.
    await Promise.all([Product, Deck, Card, Response, Claim].map((model) => model.init()));
    product = await store.createProduct(owner, {
      name: "IT product",
      icon: "",
      category: "",
      industry: "SaaS",
      showOwnerName: false,
      targetUsers: [],
      audience: { who: "everyone", states: [], interests: [] },
    });
  });

  after(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        const name = assertTestDb();
        await mongoose.connection.dropDatabase();
        console.log(`dropped ${name}`);
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  it("claimPublish: once, then refused, stale claim abandoned, release, final save clears it", { timeout: 60_000 }, async () => {
    const deck = await newDraft();
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), true, "fresh draft claims");
    const claimed = await store.getDeck(owner, deck._id);
    assert.ok(claimed.publishingAt instanceof Date, "publishingAt round-trips as a Date");
    assert.equal(isPublishClaimed(claimed), true);
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), false, "a second claim is refused");

    // A claim older than 5 minutes is abandoned (backdated in the database: updateDeck/deleteDeck use their own clock).
    await setRaw(deck._id, { publishingAt: ago(PUBLISH_CLAIM_TTL_MS + 1000) });
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), true, "a stale claim is taken over");
    // Just inside the window it still holds.
    await setRaw(deck._id, { publishingAt: ago(PUBLISH_CLAIM_TTL_MS - 5000) });
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), false, "a 4m55s-old claim still holds");

    // Release (what publish does on 409/422/throw), then claim again.
    const released = await store.updateDeck(owner, deck._id, { publishingAt: null });
    assert.equal(released.publishingAt, undefined);
    assert.equal((await rawDeck(deck._id)).publishingAt, null, "release stores null");
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), true, "claims again after release");

    // The publish's final save clears the claim and stores the Flagsmith fields.
    const saved = await store.updateDeck(owner, deck._id, {
      status: "live",
      listedInFeed: true,
      publishingAt: null,
      experimentId: "exp-42",
      featureId: 9001,
      optionIds: { B: 101, C: 102, D: 103 },
      rewardMetricId: "metric-7",
      flagsmithError: "simulated: warehouse not connected",
    });
    // The value returned by findOneAndUpdate({ returnDocument: "after" }) is the updated document.
    assert.equal(saved.status, "live");
    assert.equal(saved.publishingAt, undefined);
    assert.equal(saved.featureId, 9001);
    assert.deepEqual(saved.optionIds, { B: 101, C: 102, D: 103 });
    assert.equal(saved.rewardMetricId, "metric-7");
    assert.equal(saved.flagsmithError, "simulated: warehouse not connected");
    assert.equal(saved.experimentId, "exp-42");
    assert.equal(saved.cards.length, 4, "a field-only save keeps the cards");

    // Stored, not dropped by Mongoose strict mode, with the right BSON types.
    const raw = await rawDeck(deck._id);
    assert.equal(raw.publishingAt, null);
    assert.equal(typeof raw.featureId, "number");
    assert.equal(raw.featureId, 9001);
    assert.deepEqual(raw.optionIds, { B: 101, C: 102, D: 103 });
    assert.equal(raw.rewardMetricId, "metric-7");
    assert.equal(raw.flagsmithError, "simulated: warehouse not connected");
    assert.equal(raw.experimentId, "exp-42");

    const reread = await store.getDeck(owner, deck._id);
    assert.equal(reread.featureId, 9001);
    assert.deepEqual(reread.optionIds, { B: 101, C: 102, D: 103 });
    assert.equal(isPublishClaimed(reread), false);
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), false, "a live deck cannot be claimed");
    assert.equal(await store.updateDeck(owner, deck._id, { cards: cardsOf("late") }), null, "a live deck's cards are locked");
  });

  it("claimPublish: concurrent claims via Promise.all, exactly one wins (20 rounds of 5)", { timeout: 60_000 }, async () => {
    for (let round = 0; round < 20; round++) {
      const deck = await newDraft();
      const results = await Promise.all(Array.from({ length: 5 }, () => store.claimPublish(owner, deck._id, new Date())));
      assert.equal(results.filter(Boolean).length, 1, `round ${round}: ${JSON.stringify(results)}`);
    }
  });

  it("edit lock: a card save marks editingAt, blocks claim/delete/another card save, clears only its own marker", { timeout: 60_000 }, async () => {
    const deck = await newDraft(cardsOf("old"));
    const hold = holdCardInsert();
    try {
      const saving = store.updateDeck(owner, deck._id, { question: "Q1", cards: cardsOf("new") });
      await hold.reached;
      const mid = await rawDeck(deck._id);
      assert.ok(mid.editingAt instanceof Date, "editingAt is stored while the cards are replaced");
      assert.equal(mid.question, "Q1");
      assert.equal(await Card.countDocuments({ deckId: deck._id }), 0, "held between the card delete and the insert");
      assert.equal(await store.claimPublish(owner, deck._id, new Date()), false, "no claim mid-replace");
      assert.equal(await store.deleteDeck(owner, deck._id), false, "no delete mid-replace");
      assert.equal(await store.updateDeck(owner, deck._id, { cards: cardsOf("other") }), null, "no second card save mid-replace");
      // A field-only save is not a card write and is not blocked.
      assert.notEqual(await store.updateDeck(owner, deck._id, { negativeLabel: "Nope" }), null);
      hold.release();
      const saved = await saving;
      assert.equal(values(saved), values({ cards: cardsOf("new") }));
      assert.equal(saved.question, "Q1");
      assert.equal(saved.negativeLabel, "Nope");
      assert.equal((await rawDeck(deck._id)).editingAt, null, "the marker is cleared after the save");
    } finally {
      hold.restore();
    }

    // Own marker only: if a later write took the marker over, the earlier write must not clear it.
    const hold2 = holdCardInsert();
    const foreign = new Date(Date.now() + 1234);
    try {
      const saving = store.updateDeck(owner, deck._id, { cards: cardsOf("third") });
      await hold2.reached;
      await setRaw(deck._id, { editingAt: foreign });
      hold2.release();
      assert.notEqual(await saving, null);
      assert.equal((await rawDeck(deck._id)).editingAt.getTime(), foreign.getTime(), "another write's marker is left alone");
    } finally {
      hold2.restore();
    }

    // A fresh marker (that other write) blocks; a stale one (> EDIT_LOCK_TTL_MS) does not.
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), false, "fresh foreign marker blocks the claim");
    await setRaw(deck._id, { editingAt: ago(EDIT_LOCK_TTL_MS + 1000) });
    const overStale = await store.updateDeck(owner, deck._id, { cards: cardsOf("fourth") });
    assert.equal(values(overStale), values({ cards: cardsOf("fourth") }), "a card save takes over a stale marker");
    assert.equal((await rawDeck(deck._id)).editingAt, null);
    await setRaw(deck._id, { editingAt: ago(EDIT_LOCK_TTL_MS + 1000) });
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), true, "a stale marker does not block the claim");
    await store.updateDeck(owner, deck._id, { publishingAt: null, editingAt: null });
    await setRaw(deck._id, { editingAt: ago(EDIT_LOCK_TTL_MS + 1000) });
    assert.equal(await store.deleteDeck(owner, deck._id), true, "a stale marker does not block the delete");
  });

  it("edit lock: a failing card insert still clears the marker (try/finally)", { timeout: 60_000 }, async () => {
    const deck = await newDraft(cardsOf("old"));
    const hold = holdCardInsert({ fail: true });
    try {
      const saving = store.updateDeck(owner, deck._id, { cards: cardsOf("new") });
      await hold.reached;
      hold.release();
      await assert.rejects(saving, /simulated card insert failure/);
    } finally {
      hold.restore();
    }
    assert.equal((await rawDeck(deck._id)).editingAt, null, "the marker is cleared even though the insert threw");
    assert.equal(await store.claimPublish(owner, deck._id, new Date()), true, "the deck is claimable again at once");
  });

  it("edit lock vs claimPublish: 50 concurrent rounds, the publish never sees old fields or a partial card set", { timeout: 60_000 }, async () => {
    const outcomes = { claimWonSaveRefused: 0, saveWonClaimRefused: 0, saveThenClaim: 0 };
    // A local server replaces cards in well under a millisecond; add 0-3 ms before each card write (as a remote
    // Atlas round trip would) so a claim landing mid-replace is actually reachable if the edit lock is broken.
    const { deleteMany, insertMany } = Card;
    const latency = () => new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 4)));
    Card.deleteMany = async function (...args) {
      await latency();
      return deleteMany.apply(this, args);
    };
    Card.insertMany = async function (...args) {
      await latency();
      return insertMany.apply(this, args);
    };
    try {
      await raceRounds(outcomes);
    } finally {
      Card.deleteMany = deleteMany;
      Card.insertMany = insertMany;
    }
    console.log(`race outcomes over 50 rounds: ${JSON.stringify(outcomes)}`);
  });

  async function raceRounds(outcomes) {
    for (let i = 0; i < 50; i++) {
      const oldCards = cardsOf(`old${i}`);
      const newCards = cardsOf(`new${i}`);
      const deck = await newDraft(oldCards, { question: `old${i}` });
      let claimRead = null;
      // Like publish(): read the deck right after a successful claim. Half the rounds retry a refused claim (a founder
      // clicking again; rounds 2 and 3 of every 4), so a claim that lands right after the save's marker is cleared is
      // exercised too.
      const claim = async () => {
        for (let attempt = 0; attempt < (i % 4 < 2 ? 1 : 200); attempt++) {
          if (await store.claimPublish(owner, deck._id, new Date())) {
            claimRead = await store.getDeck(owner, deck._id);
            return true;
          }
          await new Promise((resolve) => setImmediate(resolve));
        }
        return false;
      };
      const save = () => store.updateDeck(owner, deck._id, { question: `new${i}`, cards: newCards });
      const jitter = () => new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3)));
      // Even rounds start the claim first, odd rounds the save; the other side waits 0-2 ms.
      const [claimed, saved] = await Promise.all(i % 2 === 0 ? [claim(), jitter().then(save)] : [jitter().then(claim), save()]);
      const label = `round ${i}: claimed=${claimed} saved=${saved !== null}`;
      if (claimed && saved === null) {
        outcomes.claimWonSaveRefused++;
        assert.equal(claimRead.question, `old${i}`, label);
        assert.equal(values(claimRead), values({ cards: oldCards }), label);
      } else if (!claimed && saved !== null) {
        outcomes.saveWonClaimRefused++;
        assert.equal(saved.question, `new${i}`, label);
        assert.equal(values(saved), values({ cards: newCards }), label);
      } else if (claimed && saved !== null) {
        outcomes.saveThenClaim++;
        // The save reported success and the claim also landed: the claim must have come after the new cards.
        assert.equal(claimRead.question, `new${i}`, label);
        assert.equal(values(claimRead), values({ cards: newCards }), label);
      } else {
        assert.fail(`${label}: neither the claim nor the save succeeded`);
      }
      const final = await store.getDeck(owner, deck._id);
      assert.equal(final.cards.length, 4, `${label}: no partial card set`);
      assert.equal((await rawDeck(deck._id)).editingAt ?? null, null, `${label}: no marker left behind`);
    }
  }

  it("deleteDeck: refuses a claimed draft, a draft being edited and a live deck; deletes an unclaimed draft", { timeout: 60_000 }, async () => {
    const claimed = await newDraft();
    assert.equal(await store.claimPublish(owner, claimed._id, new Date()), true);
    assert.equal(await store.deleteDeck(owner, claimed._id), false, "claimed draft");
    assert.notEqual(await store.getDeck(owner, claimed._id), null);

    const editing = await newDraft();
    await setRaw(editing._id, { editingAt: new Date() });
    assert.equal(await store.deleteDeck(owner, editing._id), false, "draft being edited");

    const live = await newDraft();
    await store.updateDeck(owner, live._id, { status: "live" });
    assert.equal(await store.deleteDeck(owner, live._id), false, "live deck");

    const free = await newDraft();
    assert.ok((await store.getProduct(owner, product.id)).deckIds.includes(free._id));
    assert.equal(await store.deleteDeck(owner, "not-an-id"), false);
    assert.equal(await store.deleteDeck(new mongoose.Types.ObjectId().toHexString(), free._id), false, "another owner");
    assert.equal(await store.deleteDeck(owner, free._id), true, "unclaimed draft");
    assert.equal(await store.getDeck(owner, free._id), null);
    assert.equal(await Card.countDocuments({ deckId: free._id }), 0, "its cards are deleted");
    assert.equal((await store.getProduct(owner, product.id)).deckIds.includes(free._id), false, "pulled from the product");
    for (const kept of [claimed, editing, live]) assert.equal(await Card.countDocuments({ deckId: kept._id }), 4);
  });

  it("Response.exposedToFlagsmith: markExposed stores it and the claims store maps it", { timeout: 60_000 }, async () => {
    const deck = await newDraft();
    await store.updateDeck(owner, deck._id, { status: "live", listedInFeed: true });
    const card = await Card.findOne({ deckId: deck._id, variantKey: "B" }).lean();
    const record = {
      deckId: deck._id,
      cardId: String(card._id),
      swiperKey: `g:it-guest-${RUN}`,
      source: "feed",
      isTargetUser: false,
      answer: "positive",
      dwellMs: 1500,
      valid: true,
      counted: true,
      createdAt: new Date(),
    };
    const saved = await swipe.saveResponse(record);
    assert.equal(saved.saved, true);
    assert.deepEqual(await swipe.saveResponse(record), { saved: false, duplicate: true }, "one response per swiper per deck");

    const before = await claims.getResponse(saved.id);
    assert.equal(before.exposedToFlagsmith, false);
    assert.equal("exposedToFlagsmith" in (await Response.collection.findOne({ _id: oid(saved.id) })), false);

    await swipe.markExposed(saved.id);
    assert.equal((await Response.collection.findOne({ _id: oid(saved.id) })).exposedToFlagsmith, true, "stored, not stripped");
    const exposed = await claims.getResponse(saved.id);
    assert.equal(exposed.exposedToFlagsmith, true);
    assert.equal(exposed.deckId, deck._id);
    assert.equal(exposed.cardId, String(card._id));
    assert.equal(claims.isOwner(exposed, record.swiperKey), true);

    await swipe.markExposed("not-an-id"); // ignored, no throw
    const stats = await store.deckStats(owner, [deck._id]);
    assert.equal(stats[deck._id].swipers, 1);
  });

  // Runs last: every store call above has run by now. Mongoose reports deprecated options (such as `new: true` on
  // findOneAndUpdate) through process warnings with code MONGOOSE.
  it("no Mongoose deprecation warnings during the run", async () => {
    await new Promise((resolve) => setImmediate(resolve)); // warnings are delivered on a later tick
    assert.deepEqual(mongooseWarnings, []);
  });
});
