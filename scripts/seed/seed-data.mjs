// Demo seed data for PitchSwipe, built from docs/spec/08-build-reference.md (section 13)
// and src/fixtures/index.ts. Pure data: no connection, no secrets, safe to import in tests.
//
// Everything is deterministic. Every document has a stable _id derived from a string key, so
// the seed script can upsert and re-running it never creates duplicates.
//
// From the spec: people, products, deck names, headline copy, flag name, the headline results
// by variant x source (swipers / said yes / joined), 118 waitlist, wallet Rs 46.75.
// Seed assumptions are marked ASSUMPTION or TODO. No AI or Flagsmith output is invented here;
// Flagsmith results stay in src/fixtures.
//
// DEMO DATA: every row below is synthetic demo data (example.invalid emails, made-up dwell times and
// times of day). The waitlist split across decks follows src/fixtures VOICE_KHATA_DECK_COUNTS, the
// single source for the demo screens: headline 26, Product UI 11, Price 76 (29 / 29 / 13 / 5 on the four
// prices, spec/02 5.13 and web 17), Launch reward 5; the four add up to the 118 of spec/08 13.1. Only the
// headline and price splits are in the spec or designs; Product UI 11 and Launch reward 5 are demo-only.
// scripts/seed/seed.test.mjs and src/lib/results/demo-consistency.test.ts fail if this drifts from the fixtures.
// Do not seed this into a real product database: nothing here is real.
import { createHash } from "node:crypto";
import mongoose from "mongoose";

/** Stable 24-hex ObjectId string from a key. */
export function oid(key) {
  return createHash("sha1").update(`pitchswipe-seed:${key}`).digest("hex").slice(0, 24);
}

/** Collection name Mongoose uses for a model name (same pluralizer as the models). */
export function collectionFor(modelName) {
  return mongoose.pluralize()(modelName);
}

export const MODEL_ORDER = ["User", "Product", "Deck", "Card", "Response", "Claim", "AssistantEvent", "Wallet"];

const IST = "+05:30";
const BASE_TIME = Date.parse(`2026-11-15T10:00:00${IST}`);
const at = (minutes) => new Date(BASE_TIME + minutes * 60_000);

/* ---------- users ---------- */

const ARJUN = oid("user:arjun-sen");
const PRIYA = oid("user:priya-nair");

export const users = [
  {
    _id: ARJUN,
    firebaseUid: "seed-arjun-sen",
    name: "Arjun Sen",
    email: "arjun.sen@example.com",
    emailVerified: true,
    roles: ["founder"],
    interests: ["Retail"],
    qualityScore: 0,
    counting: false,
    checkReasons: [],
    createdAt: at(0),
  },
  {
    _id: PRIYA,
    firebaseUid: "seed-priya-nair",
    name: "Priya Nair",
    email: "priya.n@example.com",
    emailVerified: true,
    roles: ["swiper"],
    role: "Shop owner",
    state: "Gujarat",
    interests: ["Retail", "Finance", "Logistics"],
    qualityScore: 82, // spec/08 13.3 quality pass demo
    counting: true,
    checkReasons: [],
    createdAt: at(0),
  },
];

/* ---------- products ---------- */

const VK = oid("product:voice-khata");
const QL = oid("product:queueless");
const LM = oid("product:loadmate");

const VK_DECK_IDS = ["voice-khata-headline", "voice-khata-product-ui", "voice-khata-price", "voice-khata-launch-reward"];
const QL_DECK_IDS = ["queueless-description", "queueless-price"];

export const products = [
  {
    _id: VK,
    ownerId: ARJUN,
    name: "Voice Khata",
    icon: "",
    category: "Voice ledger · Retail",
    industry: "Retail",
    showOwnerName: true,
    targetUsers: ["Shop owner", "Wholesaler"],
    audience: { who: "everyone", states: [], interests: [] },
    deckIds: VK_DECK_IDS.map((d) => oid(`deck:${d}`)),
  },
  {
    _id: QL,
    ownerId: ARJUN,
    name: "QueueLess",
    icon: "",
    category: "Clinic bookings",
    industry: "Healthcare",
    showOwnerName: true,
    targetUsers: [],
    audience: { who: "everyone", states: [], interests: [] },
    deckIds: QL_DECK_IDS.map((d) => oid(`deck:${d}`)),
  },
  {
    // README names LoadMate (return loads); the spec gives no decks for it, so none are seeded.
    _id: LM,
    ownerId: ARJUN,
    name: "LoadMate",
    icon: "",
    category: "Return loads",
    industry: "Logistics",
    showOwnerName: true,
    targetUsers: [],
    audience: { who: "everyone", states: [], interests: [] },
    deckIds: [],
  },
];

/* ---------- decks and cards ---------- */

const HEADLINES = {
  A: "Speak your sales. The ledger writes itself.",
  B: "Stop chasing payments. Get paid on time.",
  C: "Your whole ledger for Rs 10 a day.",
};

const VK_SHARED = {
  category: "Voice ledger · Retail",
  price: "Rs 299 / mo",
  reward: "Get 3 months free at launch",
  madeFor: ["Shop owner", "Wholesaler"],
};
const VK_QUESTION = {
  question: "Would you pay Rs 299 a month?",
  positiveLabel: "Yes, I would pay",
  negativeLabel: "No, I would not",
};
const OPEN_QUESTION = { question: "", positiveLabel: "Yes, I would", negativeLabel: "No, I would not" };

// TODO(owner): spec/08 gives card copy only for the headline test (plus the Rs 199 / Rs 299
// prices and the reward text). Other card values are placeholders so the decks are valid;
// replace them with the real design copy before using this seed for a recorded demo.
const deckDefs = [
  {
    key: "voice-khata-headline",
    product: VK,
    variable: "headline",
    status: "decided",
    shared: { ...VK_SHARED },
    cards: [
      ["A", HEADLINES.A],
      ["B", HEADLINES.B],
      ["C", HEADLINES.C],
    ],
    flagName: "deck_voice-khata-headline", // spec/08 13.1
    winner: "B",
    ...VK_QUESTION,
  },
  {
    key: "voice-khata-product-ui",
    product: VK,
    variable: "productUI",
    status: "decided",
    shared: { category: VK_SHARED.category, price: VK_SHARED.price, reward: VK_SHARED.reward, headline: HEADLINES.B },
    cards: [
      ["A", "TODO placeholder: product UI screenshot A"],
      ["B", "TODO placeholder: product UI screenshot B"],
    ],
    flagName: "deck_voice-khata-product-ui",
    ...VK_QUESTION,
  },
  {
    key: "voice-khata-price",
    product: VK,
    variable: "price",
    priceMode: "level",
    status: "live",
    shared: { category: VK_SHARED.category, reward: VK_SHARED.reward, headline: HEADLINES.B },
    // Four prices, as in the spec/02 5.13 demo table and web 17 (demand curve needs 2 to 4 prices).
    cards: [
      ["A", "Rs 99 / mo"],
      ["B", "Rs 199 / mo"], // spec/08: "Rs 199 leads with target users"
      ["C", "Rs 299 / mo"],
      ["D", "Rs 399 / mo"],
    ],
    flagName: "deck_voice-khata-price",
    ...VK_QUESTION,
  },
  {
    key: "voice-khata-launch-reward",
    product: VK,
    variable: "reward",
    status: "decided",
    shared: { category: VK_SHARED.category, price: VK_SHARED.price, headline: HEADLINES.B },
    cards: [
      ["A", "Get 3 months free at launch"],
      ["B", "TODO placeholder: alternative launch reward"],
    ],
    flagName: "deck_voice-khata-launch-reward",
    ...VK_QUESTION,
  },
  {
    key: "queueless-description",
    product: QL,
    variable: "description",
    status: "live",
    shared: { category: "Clinic bookings" },
    cards: [
      ["A", "TODO placeholder: QueueLess description A"],
      ["B", "TODO placeholder: QueueLess description B"],
    ],
    flagName: "deck_queueless-description",
    ...OPEN_QUESTION,
  },
  {
    key: "queueless-price",
    product: QL,
    variable: "price",
    priceMode: "level",
    status: "draft",
    shared: { category: "Clinic bookings" },
    cards: [
      ["A", "TODO placeholder: QueueLess price A"],
      ["B", "TODO placeholder: QueueLess price B"],
    ],
    flagName: "deck_queueless-price",
    ...OPEN_QUESTION,
  },
];

const cardId = (deckKey, variantKey) => oid(`card:${deckKey}:${variantKey}`);

export const decks = deckDefs.map((d) => {
  const doc = {
    _id: oid(`deck:${d.key}`),
    ownerId: ARJUN,
    productId: d.product,
    slug: d.key,
    variable: d.variable,
    shared: d.shared,
    question: d.question,
    positiveLabel: d.positiveLabel,
    negativeLabel: d.negativeLabel,
    flagName: d.flagName,
    status: d.status,
    listedInFeed: d.status === "live" || d.status === "decided",
    boost: { perSwipe: 0, budget: 0, spent: 0 },
  };
  if (d.priceMode) doc.priceMode = d.priceMode;
  if (d.status === "decided") doc.decidedAt = new Date(`2026-11-15T18:42:00${IST}`); // approved 18:42 (spec/08 13.2)
  if (d.winner) doc.winnerCardId = cardId(d.key, d.winner);
  return doc;
});

export const cards = deckDefs.flatMap((d) =>
  d.cards.map(([variantKey, value]) => ({
    _id: cardId(d.key, variantKey),
    deckId: oid(`deck:${d.key}`),
    variantKey,
    value,
  })),
);

/* ---------- headline test: responses and claims (spec/08 13.2, rows 2-9) ---------- */

// [variant, source, swipers, said yes, joined]. Totals 214 / 98 / 26. By variant: B 71/38/13,
// A 72/34/8, C 71/26/5. By source: feed 160/70/14, link 54/28/12.
export const HEADLINE_GROUPS = [
  ["B", "feed", 53, 27, 7],
  ["B", "link", 18, 11, 6],
  ["A", "feed", 54, 24, 4],
  ["A", "link", 18, 10, 4],
  ["C", "feed", 53, 19, 3],
  ["C", "link", 18, 7, 2],
];

const HEADLINE_DECK = oid("deck:voice-khata-headline");
export const responses = [];
export const claims = [];

for (const [variant, source, swipers, yes, joined] of HEADLINE_GROUPS) {
  for (let i = 0; i < swipers; i += 1) {
    const key = `headline:${variant}:${source}:${i}`;
    responses.push({
      _id: oid(`response:${key}`),
      deckId: HEADLINE_DECK,
      // ASSUMPTION: anonymous synthetic swiper ids (no user documents); refs are not enforced.
      swiperId: oid(`swiper:${key}`),
      source,
      cardId: cardId("voice-khata-headline", variant),
      // Target-user, state and interest splits are not joint-distributed in the spec, so they are not seeded.
      isTargetUser: false,
      answer: i < yes ? "positive" : "negative",
      dwellMs: 2000 + ((i * 137) % 3000),
      valid: true,
      counted: true,
      createdAt: at(30 + responses.length),
    });
  }
  for (let i = 0; i < joined; i += 1) {
    claims.push({
      _id: oid(`claim:headline:${variant}:${source}:${i}`),
      deckId: HEADLINE_DECK,
      cardId: cardId("voice-khata-headline", variant),
      email: `seed-claim-${String(claims.length + 1).padStart(3, "0")}@example.invalid`,
      createdAt: at(300 + claims.length),
    });
  }
}

// 118 on the Voice Khata waitlist (spec/08 13.1); 26 come from the headline test above. The other 92 follow
// the fixtures' per-deck split (see the header): [deck, card, claims]. Price is 29 / 29 / 13 / 5 on its four
// prices (web 17); ASSUMPTION: Product UI's 11 and Launch reward's 5 sit on each deck's first card (the fixtures
// give no per-card split for them).
export const WAITLIST_TOTAL = 118;
export const OTHER_DECK_CLAIMS = [
  ["voice-khata-product-ui", "A", 11],
  ["voice-khata-price", "A", 29],
  ["voice-khata-price", "B", 29],
  ["voice-khata-price", "C", 13],
  ["voice-khata-price", "D", 5],
  ["voice-khata-launch-reward", "A", 5],
];
for (const [deckKey, variantKey, n] of OTHER_DECK_CLAIMS) {
  for (let i = 0; i < n; i += 1) {
    claims.push({
      _id: oid(`claim:${deckKey}:${variantKey}:${i}`),
      deckId: oid(`deck:${deckKey}`),
      cardId: cardId(deckKey, variantKey),
      email: `seed-claim-${String(claims.length + 1).padStart(3, "0")}@example.invalid`,
      createdAt: at(300 + claims.length),
    });
  }
}

/* ---------- assistant events (decided state, spec/08 13.2) ---------- */

export const assistantEvents = [
  {
    _id: oid("assistant:headline:decided"),
    deckId: HEADLINE_DECK,
    type: "decided",
    chanceBest: [
      { cardId: cardId("voice-khata-headline", "B"), chance: 0.96 },
      { cardId: cardId("voice-khata-headline", "A"), chance: 0.03 },
      { cardId: cardId("voice-khata-headline", "C"), chance: 0.01 },
    ],
    swipers: 256,
    checksPassed: true,
    createdAt: new Date(`2026-11-15T18:40:00${IST}`),
  },
  {
    _id: oid("assistant:headline:approved"),
    deckId: HEADLINE_DECK,
    type: "approved", // approved by Arjun Sen at 18:42
    chanceBest: [{ cardId: cardId("voice-khata-headline", "B"), chance: 0.96 }],
    swipers: 256,
    checksPassed: true,
    createdAt: new Date(`2026-11-15T18:42:00${IST}`),
  },
];

/* ---------- wallet: Rs 46.75 demo earnings, Rs 0.25 per valid swipe (spec/08 13.3) ---------- */

// Weekly Rs 31.00 from 124 valid swipes (spec). The earlier Rs 15.75 (63 swipes) is the
// remainder that makes the balance Rs 46.75; the entry split itself is a seed assumption.
export const wallets = [
  {
    _id: oid("wallet:priya-nair"),
    userId: PRIYA,
    balance: 46.75,
    entries: [
      { deckId: HEADLINE_DECK, amount: 15.75, swipeCount: 63, createdAt: new Date(`2026-11-08T12:00:00${IST}`) },
      { deckId: HEADLINE_DECK, amount: 31.0, swipeCount: 124, createdAt: new Date(`2026-11-15T12:00:00${IST}`) },
    ],
  },
];

/** model name -> documents. */
export const SEED = {
  User: users,
  Product: products,
  Deck: decks,
  Card: cards,
  Response: responses,
  Claim: claims,
  AssistantEvent: assistantEvents,
  Wallet: wallets,
};
