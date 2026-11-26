/**
 * Demo data from goal/spec/08-build-reference.md §13. Every number and label is
 * copied exactly. Derived numbers (join rates, shares) are computed by code in
 * src/lib/results, never typed in here.
 */
import type { Industry, Role, State, TestVariable } from "@/lib/lists";

import type { DeckStatus, FlagsmithExperimentResults } from "@/types";

/* 13.1 Product and decks (Voice Khata, founder Arjun Sen) */

export const FOUNDER = {
  name: "Arjun Sen",
} as const;

export interface FixtureProduct {
  id: string;
  name: string;
  category: string;
  industry: Industry;
  /** Accent colour for the product tile (green / blue / purple). */
  accent: "green" | "blue" | "purple";
  waitlistCount: number;
}

export const VOICE_KHATA: FixtureProduct = {
  id: "voice-khata",
  name: "Voice Khata",
  category: "Voice ledger · Retail",
  industry: "Retail",
  accent: "green",
  waitlistCount: 118,
};

export const QUEUELESS: FixtureProduct = {
  id: "queueless",
  name: "QueueLess",
  category: "Clinic bookings",
  industry: "Healthcare",
  accent: "blue",
  waitlistCount: 12,
};

export const LEDGER_FOR_CHEMISTS: FixtureProduct = {
  id: "ledger-for-chemists",
  name: "Ledger for chemists",
  category: "Ledger",
  industry: "Healthcare",
  accent: "purple",
  waitlistCount: 0,
};

export interface FixtureDeck {
  id: string;
  productId: string;
  variable: TestVariable;
  /** Label shown on the My decks screen. */
  label: string;
  /** Status label shown on My decks ("Won", "Leading · 88% sure", "Live", "Draft"). */
  statusLabel: string;
  status: DeckStatus;
  /** Chance as a fraction, where shown. */
  chance?: number;
  flagName?: string;
}

export const DECKS: FixtureDeck[] = [
  {
    id: "voice-khata-headline",
    productId: VOICE_KHATA.id,
    variable: "headline",
    label: "Headline",
    // Design web 03 (My decks: "Headline B · Leading"), web 24 (switcher: "Leading · 91% chance best") and spec/08 §13.1
    // ("Leading on results; decided in the assistant flow"). It becomes "Won" only after the founder taps Approve and ship.
    statusLabel: "Leading · 91% sure",
    status: "live",
    chance: 0.91,
    flagName: "deck_voice-khata-headline",
  },
  {
    id: "voice-khata-product-ui",
    productId: VOICE_KHATA.id,
    variable: "productUI",
    label: "Product UI",
    statusLabel: "Won",
    status: "decided",
    chance: 0.95,
  },
  {
    id: "voice-khata-price",
    productId: VOICE_KHATA.id,
    variable: "price",
    label: "Price",
    statusLabel: "Leading · 88% sure",
    status: "live",
    chance: 0.88,
  },
  {
    id: "voice-khata-launch-reward",
    productId: VOICE_KHATA.id,
    variable: "reward",
    label: "Launch reward",
    statusLabel: "Won",
    status: "decided",
    chance: 0.97,
  },
  {
    id: "queueless-description",
    productId: QUEUELESS.id,
    variable: "description",
    label: "Description",
    statusLabel: "Live",
    status: "live",
  },
  {
    id: "queueless-price",
    productId: QUEUELESS.id,
    variable: "price",
    label: "Price",
    statusLabel: "Draft",
    status: "draft",
  },
];

/**
 * Per-deck demo counts for Voice Khata: the SINGLE source for My decks, Insights, Ask, Results and the seed.
 *
 * Reconciling spec/08 and the designs (they cannot all be sums of one another):
 *  - headline 214 / 98 / 26 (spec/08 §13.2) and price 480 / 203 / 76 (web 17, 120 per price) are exact.
 *  - Insights says "decks 1 and 2 · 438 swipers" (web 25), so the Product UI deck has 438 - 214 = 224 swipers.
 *  - The product header says "612 real swipers across 4 decks" (spec/08 §13.1, web 25). The deck counts add up to
 *    more than that, because 612 counts PEOPLE: a swiper may answer several decks of the same product (one card
 *    per deck). So 612 is a distinct-swiper total and never a sum of the deck rows.
 *  - 118 on the waitlist is a sum: an email joins a product's waitlist once, so the four deck rows add up to 118
 *    (26 + 11 + 76 + 5). Product UI and Launch reward are not in the design; their rows are demo-only and every screen
 *    that shows them carries a "Demo data" label.
 */
export interface DemoDeckCounts {
  swipers: number;
  saidYes: number;
  joined: number;
  /** Comments read for the insight cards (spec/08: 41 across decks 1 and 2 = 24 + 17). */
  comments: number;
}

export const VOICE_KHATA_DECK_COUNTS: Record<string, DemoDeckCounts> = {
  "voice-khata-headline": { swipers: 214, saidYes: 98, joined: 26, comments: 24 },
  "voice-khata-product-ui": { swipers: 224, saidYes: 100, joined: 11, comments: 17 },
  "voice-khata-price": { swipers: 480, saidYes: 203, joined: 76, comments: 0 },
  "voice-khata-launch-reward": { swipers: 120, saidYes: 54, joined: 5, comments: 0 },
};

/** Other demo decks (My decks only): QueueLess has 12 on the waitlist (spec/08 §13.1). Swipers is demo-only. */
export const OTHER_DECK_COUNTS: Record<string, { swipers: number; waitlist: number }> = {
  "queueless-description": { swipers: 90, waitlist: 12 },
};

/** Swipers and waitlist for every demo deck, as My decks shows them. */
export function demoDeckStats(deckId: string): { swipers: number; waitlist: number } | null {
  const v = VOICE_KHATA_DECK_COUNTS[deckId];
  if (v) return { swipers: v.swipers, waitlist: v.joined };
  return OTHER_DECK_COUNTS[deckId] ?? null;
}

export const PRODUCT_TOTALS = {
  /** Distinct swipers across the four decks (see the note above); NOT the sum of the deck rows. */
  voiceKhataSwipers: 612,
  voiceKhataDecks: 4,
  voiceKhataWinners: 3,
  waitlistAcrossProducts: 118,
} as const;

/** Decks 1 and 2: "decks 1 and 2 · 438 swipers" on the Result insight (web 25). */
export const RESULT_INSIGHT_SWIPERS =
  VOICE_KHATA_DECK_COUNTS["voice-khata-headline"].swipers + VOICE_KHATA_DECK_COUNTS["voice-khata-product-ui"].swipers;

/** Price test arms (spec/02 §5.13, web 17): 120 swipers per price. */
export const PRICE_TEST_ARMS = [
  { key: "A", price: 99, swipers: 120, saidYes: 71, joined: 29 },
  { key: "B", price: 199, swipers: 120, saidYes: 64, joined: 29 },
  { key: "C", price: 299, swipers: 120, saidYes: 43, joined: 13 },
  { key: "D", price: 399, swipers: 120, saidYes: 25, joined: 5 },
] as const;

/**
 * What web 17 prints for the price test that the demand-curve code computes slightly differently from the same counts
 * (it computes 89% and 90 more swipers). The demo pins the design's values so every demo screen says 88%; the results
 * screen says so under its "Demo data" badge. Real mode never uses this.
 */
export const PRICE_TEST_DESIGN_VALUES = {
  chancePctByPrice: { 99: 0, 199: 88, 299: 11, 399: 1 } as Record<number, number>,
  moreSwipersPerPrice: 40,
} as const;

/* 13.1 Headline A / B / C card copy */

export const HEADLINE_TEST = {
  variantKeys: ["A", "B", "C"] as const,
  headlines: {
    A: "Speak your sales. The ledger writes itself.",
    B: "Stop chasing payments. Get paid on time.",
    C: "Your whole ledger for Rs 10 a day.",
  },
  cardCategory: "Voice ledger · Retail",
  price: "Rs 299 / mo",
  reward: "Get 3 months free at launch",
  question: "Would you pay Rs 299 a month?",
  positiveLabel: "Yes, I would pay",
  negativeLabel: "No, I would not",
  madeFor: ["Shop owner", "Wholesaler"] as Role[],
  flagName: "deck_voice-khata-headline",
} as const;

/* 13.2 Headline test results. Order: Swipers, Said yes, Joined waitlist. */

export interface ResultRow {
  group: string;
  swipers: number;
  saidYes: number;
  joined: number;
}

export const HEADLINE_RESULTS_TOTAL: ResultRow = { group: "Total", swipers: 214, saidYes: 98, joined: 26 };

export const HEADLINE_RESULTS_BY_VARIANT: ResultRow[] = [
  { group: "Headline B", swipers: 71, saidYes: 38, joined: 13 },
  { group: "Headline A", swipers: 72, saidYes: 34, joined: 8 },
  { group: "Headline C", swipers: 71, saidYes: 26, joined: 5 },
];

export const HEADLINE_RESULTS_BY_SOURCE: ResultRow[] = [
  { group: "Feed", swipers: 160, saidYes: 70, joined: 14 },
  { group: "Personal link", swipers: 54, saidYes: 28, joined: 12 },
  { group: "B feed / link", swipers: 53, saidYes: 27, joined: 7 },
  { group: "A feed / link", swipers: 54, saidYes: 24, joined: 4 },
  { group: "C feed / link", swipers: 53, saidYes: 19, joined: 3 },
];

export const HEADLINE_RESULTS_BY_AUDIENCE: ResultRow[] = [
  { group: "Target users (Shop owner, Wholesaler)", swipers: 71, saidYes: 45, joined: 16 },
  { group: "Everyone else", swipers: 143, saidYes: 53, joined: 10 },
];

export const HEADLINE_RESULTS_BY_STATE: ResultRow[] = [
  { group: "Gujarat", swipers: 41, saidYes: 22, joined: 9 },
  { group: "Maharashtra", swipers: 62, saidYes: 28, joined: 8 },
  { group: "West Bengal", swipers: 27, saidYes: 12, joined: 3 },
  { group: "Uttar Pradesh", swipers: 33, saidYes: 13, joined: 2 },
  { group: "Delhi", swipers: 27, saidYes: 11, joined: 2 },
  { group: "Hidden (states under 10)", swipers: 24, saidYes: 12, joined: 2 },
];

export const HEADLINE_RESULTS_BY_INTEREST: ResultRow[] = [
  { group: "Interest: Finance", swipers: 58, saidYes: 31, joined: 10 },
  { group: "Interest: Retail", swipers: 96, saidYes: 45, joined: 14 },
  { group: "Interest: Logistics", swipers: 41, saidYes: 17, joined: 4 },
  { group: "Interest: Fashion", swipers: 22, saidYes: 9, joined: 2 },
  { group: "Interest: Food", swipers: 37, saidYes: 14, joined: 3 },
];

/** Decided state (assistant): 256 valid swipers; B 96%, A 3%, C 1%; approved 18:42. */
export const DECIDED_HEADLINE_TEST = {
  validSwipers: 256,
  chanceByVariant: { B: 0.96, A: 0.03, C: 0.01 },
  approvedBy: FOUNDER.name,
  approvedAt: "18:42",
} as const;

/**
 * Identities per card in the decided state: the 256 valid swipers split in the same proportions as the results page
 * (A 72, B 71, C 71 of 214), by largest remainder, so there is one source for both. The decided state is a later
 * snapshot of the same deck than the 214 shown on Results.
 */
export function decidedIdentitiesByVariant(): Record<"A" | "B" | "C", number> {
  const base = HEADLINE_IDENTITIES;
  const total = base.A + base.B + base.C;
  const exact = (Object.keys(base) as ("A" | "B" | "C")[]).map((k) => ({ k, share: (base[k] / total) * DECIDED_HEADLINE_TEST.validSwipers }));
  const out = { A: 0, B: 0, C: 0 };
  for (const e of exact) out[e.k] = Math.floor(e.share);
  let left = DECIDED_HEADLINE_TEST.validSwipers - (out.A + out.B + out.C);
  for (const e of [...exact].sort((a, b) => (b.share % 1) - (a.share % 1))) {
    if (left <= 0) break;
    out[e.k] += 1;
    left -= 1;
  }
  return out;
}

/** Identities per card on the results page: the swiper counts per version (spec/08 §13.2 rows 2 to 4). */
const HEADLINE_IDENTITIES = {
  A: HEADLINE_RESULTS_BY_VARIANT[1].swipers,
  B: HEADLINE_RESULTS_BY_VARIANT[0].swipers,
  C: HEADLINE_RESULTS_BY_VARIANT[2].swipers,
};

/**
 * Flagsmith results as the results page shows them (assistant last check: 91%). Chances are the design's own
 * (web 16 and phone 14: B 91%, A 8%, C 1%, summing to 100). The later decided state is B 96%, A 3%, C 1%
 * (DECIDED_HEADLINE_TEST, web 20 / phone 18): two moments of one test, so the two screens differ by design.
 */
export const HEADLINE_FLAGSMITH_RESULTS: FlagsmithExperimentResults = {
  experimentId: "exp-voice-khata-headline",
  flagName: "deck_voice-khata-headline",
  cards: [
    { cardId: "card-headline-a", variantKey: "A", identities: HEADLINE_IDENTITIES.A, chanceToBeatControl: 0.08 },
    { cardId: "card-headline-b", variantKey: "B", identities: HEADLINE_IDENTITIES.B, chanceToBeatControl: 0.91 },
    { cardId: "card-headline-c", variantKey: "C", identities: HEADLINE_IDENTITIES.C, chanceToBeatControl: 0.01 },
  ],
  srmWarning: false,
  refreshedAt: new Date("2026-11-15T18:40:00+05:30"),
};

/** AI vs humans, persona preview (Simulated + Unproven). */
export const PERSONA_PREVIEW = {
  personasPerCard: 20,
  totalPersonas: 60,
  picksOfTwenty: { B: 9, A: 7, C: 4 },
  trackRecord: "right in 1 of 3 finished decks",
} as const;

/** Insight cards (AI writes, code fills every number). */
export const INSIGHT_CARDS = {
  result: {
    title: "People buy 'get paid', not 'voice'",
    sourceLine: "decks 1 and 2 · 438 swipers · Flagsmith 96% and 95% · 41 comments",
  },
  lead: {
    title: "Price matters most to small shops",
    sourceLine: "deck 3 · 83 target users · Flagsmith 88%",
  },
} as const;

/* 13.2a Language test demo copy */

export const LANGUAGE_TEST_COPY = {
  English: "Stop chasing payments. Get paid on time.",
  Hindi: "पेमेंट के पीछे भागना बंद करें। समय पर पैसा पाएं।",
  HindiReward: "लॉन्च पर 3 महीने मुफ़्त",
  HindiQuestion: "क्या आप इसके लिए हर महीने Rs 299 देंगे?",
  HindiAnswers: { positive: "हाँ, मैं दूँगा", negative: "नहीं" },
  Bengali: "টাকার পেছনে ছোটা বন্ধ করুন। সময়মতো টাকা পান।",
} as const;

/* 13.3 Swiper side */

export const SWIPER = {
  name: "Priya Nair",
  email: "priya.n@example.com",
  state: "Gujarat" as State,
  role: "Shop owner" as Role,
  interests: ["Retail", "Finance", "Logistics"] as Industry[],
} as const;

/** Account chip in the web sidebar (demo swiper; spec/08 §13.3). */
export const USER_CHIP = {
  name: SWIPER.name,
  initials: "PN",
  detail: `${SWIPER.state} · ${SWIPER.role}`,
} as const;

/** Home screen "Show me ideas for" selection (black chips in the design). */
export const HOME_IDEA_SELECTION: Industry[] = ["Retail", "Food", "Healthcare", "Logistics", "Travel"];

export const SWIPE_HOME = {
  earnedTodayRs: 6.25,
  validSwipesToday: 25,
  ratePerPaidSwipeRs: 0.25,
  minReadSeconds: 2,
} as const;

export const WALLET = {
  label: "Demo earnings",
  balanceRs: 46.75,
  withdrawMinRs: 100,
  weeklyRs: 31.0,
  weeklyValidSwipes: 124,
  ratePerValidSwipeRs: 0.25,
  qualityThreshold: 70,
  currentQualityScore: 82,
} as const;

/** Quality check demo (spec §5.9): pass 82, not counted 54. */
export const QUALITY_RESULT = {
  pass: { score: 82, status: "Swipes counting" },
  notCounted: {
    score: 54,
    status: "Not counted yet",
    reasons: [{ label: "Too fast", count: 9, of: 30 }],
    recheckCards: 20,
  },
  practiceCards: 30,
} as const;

/* 13.4 Pricing and limits */

export const DECK_PLANS = {
  decksLeft: 7,
  decksTotal: 10,
  plans: [
    { name: "Free", price: "Rs 0", detail: "Try it with your own audience" },
    { name: "Deck pack", price: "Rs 200", detail: "10 decks, Rs 20 each" },
    { name: "Big pack", price: "Rs 1,600", detail: "100 decks, Rs 16 each (save 20%)" },
  ],
  boost: { price: "Rs 2", detail: "Per valid swipe; Rs 0.25 of it to the swiper", label: "Boosted · Rs 410 left" },
} as const;

export const LIMITS = {
  winnerConfidence: 0.95,
  minIdentitiesPerCard: 50,
  minConversionsPerCard: 5,
  resultsRefreshMinutes: 5,
  groupMinSize: 10,
  otherLabel: "Other",
} as const;

/* 13.5 Standard lists are in src/lib/lists.ts. */
