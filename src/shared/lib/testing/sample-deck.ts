/**
 * Hand-built inputs for tests only (never imported by the app): a headline deck with three versions and a price deck
 * with four arms, as results aggregates, claimants, swipe rows, comments and Flagsmith results. The numbers reconcile
 * with each other (rows add up to the totals), so the results, export, assistant and Ask tests can check real logic
 * on realistic data.
 */
import type { DeckAggregates, GroupRow, Tally } from "@/features/results/aggregate";
import type { CardMeta, ClaimantInput } from "@/features/results/leaderboard";
import type { FlagsmithExperimentResults } from "@/types";
import type { CommentRow } from "@/features/ask/types";
import type { ExportSwipe } from "@/features/export/types";

export const SAMPLE_HEADLINE_DECK_ID = "sample-headline";
export const SAMPLE_PRICE_DECK_ID = "sample-price";

const HEADLINE_KEYS = ["A", "B", "C"] as const;
const HEADLINES: Record<(typeof HEADLINE_KEYS)[number], string> = {
  A: "Speak your sales. The ledger writes itself.",
  B: "Stop chasing payments. Get paid on time.",
  C: "Your whole ledger for Rs 10 a day.",
};
export const SAMPLE_REWARD = "Get 3 months free at launch";
const TARGET_ROLES = ["Shop owner", "Wholesaler"];

const tally = (swipers: number, saidYes: number, joined: number): Tally => ({ swipers, saidYes, joined });

/* Headline deck: 214 swipers, 98 said yes, 26 joined the waitlist. */
const TOTAL = tally(214, 98, 26);
const BY_VARIANT: Record<string, Tally> = { B: tally(71, 38, 13), A: tally(72, 34, 8), C: tally(71, 26, 5) };
const FEED_LINK: Record<string, { feed: Tally; link: Tally }> = {
  B: { feed: tally(53, 27, 7), link: tally(18, 11, 6) },
  A: { feed: tally(54, 24, 4), link: tally(18, 10, 4) },
  C: { feed: tally(53, 19, 3), link: tally(18, 7, 2) },
};
const TARGET_BY_CARD: Record<string, Tally> = { B: tally(24, 16, 7), A: tally(24, 15, 5), C: tally(23, 14, 4) };
const STATES: [string, Tally, boolean?][] = [
  ["Gujarat", tally(41, 22, 9)],
  ["Maharashtra", tally(62, 28, 8)],
  ["West Bengal", tally(27, 12, 3)],
  ["Uttar Pradesh", tally(33, 13, 2)],
  ["Delhi", tally(27, 11, 2)],
  ["hidden", tally(24, 12, 2), true],
];
const INTERESTS: [string, Tally][] = [
  ["Finance", tally(58, 31, 10)],
  ["Retail", tally(96, 45, 14)],
  ["Logistics", tally(41, 17, 4)],
  ["Fashion", tally(22, 9, 2)],
  ["Food", tally(37, 14, 3)],
];

const HEADLINE_CARDS: CardMeta[] = HEADLINE_KEYS.map((k) => ({ key: k, label: `Headline ${k}`, valueText: HEADLINES[k] }));

function headlineAggregates(): DeckAggregates {
  const states: GroupRow[] = STATES.map(([name, t, hidden]) =>
    hidden ? { key: "hidden", label: "Other", ...t, forceHidden: true } : { key: name, label: name, ...t },
  );
  const interests: GroupRow[] = INTERESTS.map(([name, t]) => ({ key: name, label: name, ...t }));
  return {
    total: TOTAL,
    byCard: {
      everyone: BY_VARIANT,
      target: TARGET_BY_CARD,
      link: Object.fromEntries(HEADLINE_KEYS.map((k) => [k, FEED_LINK[k].link])),
    },
    cardBySource: FEED_LINK,
    location: states,
    target: [
      { key: "target", label: "Target users", ...tally(71, 45, 16) },
      { key: "other", label: "Everyone else", ...tally(143, 53, 10) },
    ],
    source: [
      { key: "feed", label: "Swipe feed", ...tally(160, 70, 14) },
      { key: "link", label: "Your link", ...tally(54, 28, 12) },
    ],
    interests,
    overlap: { a: "Finance", b: "Retail", aFollowers: 58, aAlsoB: 41, targets: 71, targetsFollowA: 27 },
  };
}

const HOUR = 3_600_000;
const FIRST_FOUR: [string, string, number][] = [
  ["priya.n@example.com", "B", 2],
  ["rakesh.traders@example.com", "A", 5],
  ["sana.k@example.com", "B", 27],
  ["mohan.store@example.com", "C", 30],
];

/** 26 claimants: B 13, A 8, C 5. */
function headlineClaimants(now: Date): ClaimantInput[] {
  const out: ClaimantInput[] = FIRST_FOUR.map(([email, cardKey, hoursAgo]) => ({
    email,
    cardKey,
    createdAt: new Date(now.getTime() - hoursAgo * HOUR),
  }));
  const need: Record<string, number> = { B: 13 - 2, A: 8 - 1, C: 5 - 1 };
  let n = 5;
  for (const k of ["B", "A", "C"]) {
    for (let i = 0; i < need[k]; i++, n++) {
      out.push({ email: `waitlist-${String(n).padStart(2, "0")}@example.com`, cardKey: k, createdAt: new Date(now.getTime() - (36 + n * 3) * HOUR) });
    }
  }
  return out;
}

/** Flagsmith results for the headline deck: B leads at 91%. */
export function sampleFlagsmithResults(chance: Record<"A" | "B" | "C", number> = { A: 0.08, B: 0.91, C: 0.01 }, identities = { A: 72, B: 71, C: 71 }): FlagsmithExperimentResults {
  return {
    experimentId: "exp-sample-headline",
    flagName: "deck_sample-headline",
    cards: HEADLINE_KEYS.map((k) => ({ cardId: `card-headline-${k.toLowerCase()}`, variantKey: k, identities: identities[k], chanceToBeatControl: chance[k] })),
    srmWarning: false,
    refreshedAt: new Date("2026-11-15T18:40:00+05:30"),
  };
}

/* Price deck: 4 arms of 120 swipers. */
const PRICE_ARMS = [
  { key: "A", price: 99, tally: tally(120, 71, 29) },
  { key: "B", price: 199, tally: tally(120, 64, 29) },
  { key: "C", price: 299, tally: tally(120, 43, 13) },
  { key: "D", price: 399, tally: tally(120, 25, 5) },
];
export const SAMPLE_PRICE_ARMS = PRICE_ARMS.map((a) => ({ key: a.key, price: a.price, swipers: a.tally.swipers, saidYes: a.tally.saidYes, joined: a.tally.joined }));

function priceAggregates(): DeckAggregates {
  return {
    total: PRICE_ARMS.reduce((t, a) => tally(t.swipers + a.tally.swipers, t.saidYes + a.tally.saidYes, t.joined + a.tally.joined), tally(0, 0, 0)),
    byCard: { everyone: Object.fromEntries(PRICE_ARMS.map((a) => [a.key, a.tally])), target: {}, link: {} },
    cardBySource: {},
    location: [],
    target: [],
    source: [],
    interests: [],
    overlap: null,
  };
}

export interface SampleDeckData {
  cards: CardMeta[];
  controlKey: string;
  aggregates: DeckAggregates;
  flagsmith: FlagsmithExperimentResults | null;
  claimants: ClaimantInput[];
  reward: string | null;
  targetRoles: string[];
}

export function sampleDeckData(deckId: string, now: Date): SampleDeckData | null {
  if (deckId === SAMPLE_HEADLINE_DECK_ID) {
    return {
      cards: HEADLINE_CARDS,
      controlKey: "A",
      aggregates: headlineAggregates(),
      flagsmith: { ...sampleFlagsmithResults(), refreshedAt: new Date(now.getTime() - 2 * 60_000) },
      claimants: headlineClaimants(now),
      reward: SAMPLE_REWARD,
      targetRoles: TARGET_ROLES,
    };
  }
  if (deckId === SAMPLE_PRICE_DECK_ID) {
    return {
      cards: PRICE_ARMS.map((a) => ({ key: a.key, label: `Rs ${a.price} / mo`, valueText: `Rs ${a.price} / mo` })),
      controlKey: "A",
      aggregates: priceAggregates(),
      flagsmith: null,
      claimants: [],
      reward: SAMPLE_REWARD,
      targetRoles: TARGET_ROLES,
    };
  }
  return null;
}

/** Comments on the headline deck, as Ask reads them. */
export const SAMPLE_COMMENTS: Record<string, CommentRow[]> = {
  [SAMPLE_HEADLINE_DECK_ID]: [
    { id: "c1", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "Rs 10 a day sounds cheap, but I do not know what I get.", state: "Uttar Pradesh", role: "Shop owner" },
    { id: "c2", cardKey: "C", cardLabel: "Headline C", kind: "voice", language: "Hindi", seconds: 9, text: "Ledger I already keep in a notebook. Why pay for that?", state: "Gujarat", role: "Shop owner" },
    { id: "c3", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "The price is fine, but it is not clear what you get for it.", state: "Maharashtra", role: "Wholesaler" },
    { id: "c4", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "Sounds like another app. Does it work in Hindi?", state: "Delhi", role: "Salaried" },
    { id: "c5", cardKey: "B", cardLabel: "Headline B", kind: "typed", text: "Getting paid on time is the whole problem for me.", state: "Gujarat", role: "Shop owner" },
    { id: "c6", cardKey: "B", cardLabel: "Headline B", kind: "voice", language: "Hindi", seconds: 12, text: "I spend my evenings calling people for money. This is for me.", state: "Maharashtra", role: "Wholesaler" },
    { id: "c7", cardKey: "A", cardLabel: "Headline A", kind: "typed", text: "Clear, but I have heard this promise before.", state: "West Bengal", role: "Shop owner" },
  ],
};

const SWIPE_COMMENTS = [
  "Getting paid faster is the real pain, not keeping the ledger.",
  "Voice entry sounds handy, but will it understand customer names?",
  "The price is fine, but it is not clear what you get for it.",
  "Reminders on WhatsApp would be good.",
  "I already use a notebook, why switch?",
];

/** One anonymous swipe row per swipe, built from the aggregates so the group sizes match them. */
export function sampleSwipes(cards: readonly CardMeta[], agg: DeckAggregates, now: Date): ExportSwipe[] {
  const total = cards.reduce((n, c) => n + (agg.byCard.everyone[c.key]?.swipers ?? 0), 0);
  if (total === 0) return [];

  const states: (string | null)[] = [];
  for (const g of agg.location) if (!g.forceHidden) for (let i = 0; i < g.swipers; i++) states.push(g.key);
  while (states.length < total) states.push(null);

  const interests: string[][] = Array.from({ length: total }, () => []);
  let cursor = 0;
  for (const g of agg.interests) {
    for (let i = 0; i < g.swipers; i++) interests[(cursor + i) % total].push(g.label);
    cursor += g.swipers;
  }

  const out: ExportSwipe[] = [];
  let g = 0;
  for (const card of cards) {
    const t = agg.byCard.everyone[card.key];
    if (!t) continue;
    const feed = agg.cardBySource[card.key]?.feed.swipers ?? t.swipers;
    for (let i = 0; i < t.swipers; i++, g++) {
      const minutesAgo = (g * 997) % (5 * 24 * 60);
      out.push({
        at: new Date(now.getTime() - minutesAgo * 60_000),
        cardLabel: card.label,
        answer: i < t.saidYes ? "yes" : "no",
        comment: g % 9 === 0 ? SWIPE_COMMENTS[(g / 9) % SWIPE_COMMENTS.length | 0] : "",
        region: states[g],
        source: i < feed ? "feed" : "link",
        interests: interests[g],
      });
    }
  }
  return out;
}
