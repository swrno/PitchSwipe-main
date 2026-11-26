/**
 * Demo-mode inputs (no MongoDB / Flagsmith env): Voice Khata numbers from
 * spec/08 §13.2 and spec/02 §5.13, copied from src/fixtures. Only the two decks
 * with published demo numbers (headline test, price test) have data; every other
 * deck renders an empty state.
 *
 * Three small cross-tabs are NOT in the build reference (headline test split by target
 * users, the interest overlap tiles, the 22 waitlist emails past the first four). They are
 * chosen here so they reconcile with the published totals (71 / 45 / 16) and the numbers in
 * the design (Headline B leads among target users at 29%, 71% and 38%).
 */
import {
  HEADLINE_FLAGSMITH_RESULTS,
  HEADLINE_RESULTS_BY_AUDIENCE,
  HEADLINE_RESULTS_BY_INTEREST,
  HEADLINE_RESULTS_BY_SOURCE,
  HEADLINE_RESULTS_BY_STATE,
  HEADLINE_RESULTS_BY_VARIANT,
  HEADLINE_RESULTS_TOTAL,
  HEADLINE_TEST,
  PRICE_TEST_ARMS,
  VOICE_KHATA,
} from "@/fixtures";
import type { FlagsmithExperimentResults } from "@/types";

import type { DeckAggregates, GroupRow, Tally } from "./aggregate";
import type { CardMeta, ClaimantInput } from "./leaderboard";

/** First row of the demo waitlist CSV: only the first four emails are in the design. */
export const DEMO_WAITLIST_NOTE = "Demo data: example emails and times made up for the mockup. Not real people.";

export interface DemoDeckData {
  cards: CardMeta[];
  controlKey: string;
  aggregates: DeckAggregates;
  flagsmith: FlagsmithExperimentResults | null;
  claimants: ClaimantInput[];
  reward: string | null;
  targetRoles: string[];
}

const tally = (swipers: number, saidYes: number, joined: number): Tally => ({ swipers, saidYes, joined });
const fromRow = (r: { swipers: number; saidYes: number; joined: number }): Tally => tally(r.swipers, r.saidYes, r.joined);

const TARGET_ROLES = ["Shop owner", "Wholesaler"];

/* Headline test -------------------------------------------------------------- */

const HEADLINE_CARDS: CardMeta[] = HEADLINE_TEST.variantKeys.map((k) => ({
  key: k,
  label: `Headline ${k}`,
  valueText: HEADLINE_TEST.headlines[k],
}));

const variantRow = (k: string) => HEADLINE_RESULTS_BY_VARIANT.find((r) => r.group === `Headline ${k}`)!;
const sourceRow = (group: string) => HEADLINE_RESULTS_BY_SOURCE.find((r) => r.group === group)!;

/** Headline test split by target users: reconciles with 71 / 45 / 16 (B 7 of 24 = 29%). */
const TARGET_BY_CARD: Record<string, Tally> = {
  B: tally(24, 16, 7),
  A: tally(24, 15, 5),
  C: tally(23, 14, 4),
};

/**
 * Per card, feed and link (spec/08 rows 7 to 9: "B feed / link 53 / 18 · 27 / 11 · 7 / 6", and so on).
 * The fixture rows keep only the feed half of each pair, so both halves are spelled out here.
 */
const PAIRS: Record<string, { feed: Tally; link: Tally }> = {
  B: { feed: tally(53, 27, 7), link: tally(18, 11, 6) },
  A: { feed: tally(54, 24, 4), link: tally(18, 10, 4) },
  C: { feed: tally(53, 19, 3), link: tally(18, 7, 2) },
};

function headlineAggregates(): DeckAggregates {
  const keys = HEADLINE_TEST.variantKeys;
  const states: GroupRow[] = HEADLINE_RESULTS_BY_STATE.map((r) =>
    r.group.startsWith("Hidden")
      ? { key: "hidden", label: "Other", ...fromRow(r), forceHidden: true }
      : { key: r.group, label: r.group, ...fromRow(r) },
  );
  const interests: GroupRow[] = HEADLINE_RESULTS_BY_INTEREST.map((r) => {
    const label = r.group.replace(/^Interest: /, "");
    return { key: label, label, ...fromRow(r) };
  });
  const [target, others] = HEADLINE_RESULTS_BY_AUDIENCE;

  return {
    total: fromRow(HEADLINE_RESULTS_TOTAL),
    byCard: {
      everyone: Object.fromEntries(keys.map((k) => [k, fromRow(variantRow(k))])),
      target: TARGET_BY_CARD,
      link: Object.fromEntries(keys.map((k) => [k, PAIRS[k].link])),
    },
    cardBySource: Object.fromEntries(keys.map((k) => [k, PAIRS[k]])),
    location: states,
    target: [
      { key: "target", label: "Target users", ...fromRow(target) },
      { key: "other", label: others.group, ...fromRow(others) },
    ],
    source: [
      { key: "feed", label: "Swipe feed", ...fromRow(sourceRow("Feed")) },
      { key: "link", label: "Your link", ...fromRow(sourceRow("Personal link")) },
    ],
    interests,
    // 71% of Finance swipers (41 of 58) also follow Retail; 38% of target users (27 of 71) follow Finance.
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

/** 26 claimants: B 13, A 8, C 5 (spec/08 row 2). Emails past the first four are placeholders. */
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
      out.push({
        email: `waitlist-${String(n).padStart(2, "0")}@example.com`,
        cardKey: k,
        createdAt: new Date(now.getTime() - (36 + n * 3) * HOUR),
      });
    }
  }
  return out;
}

/* Price test (spec/02 §5.13) ------------------------------------------------- */

const PRICE_ARMS: { key: string; price: number; tally: Tally }[] = PRICE_TEST_ARMS.map((a) => ({
  key: a.key,
  price: a.price,
  tally: tally(a.swipers, a.saidYes, a.joined),
}));

function priceAggregates(): DeckAggregates {
  const everyone = Object.fromEntries(PRICE_ARMS.map((a) => [a.key, a.tally]));
  return {
    total: PRICE_ARMS.reduce((t, a) => tally(t.swipers + a.tally.swipers, t.saidYes + a.tally.saidYes, t.joined + a.tally.joined), tally(0, 0, 0)),
    byCard: { everyone, target: {}, link: {} },
    cardBySource: {},
    location: [],
    target: [],
    source: [],
    interests: [],
    overlap: null,
  };
}

const PRICE_CARDS: CardMeta[] = PRICE_ARMS.map((a) => ({
  key: a.key,
  label: `Rs ${a.price} / mo`,
  valueText: `Rs ${a.price} / mo`,
}));

/* Lookup ---------------------------------------------------------------------- */

export function demoDeckData(deckId: string, now: Date): DemoDeckData | null {
  if (deckId === "voice-khata-headline") {
    return {
      cards: HEADLINE_CARDS,
      controlKey: HEADLINE_TEST.variantKeys[0],
      aggregates: headlineAggregates(),
      flagsmith: { ...HEADLINE_FLAGSMITH_RESULTS, refreshedAt: new Date(now.getTime() - 2 * 60_000) },
      claimants: headlineClaimants(now),
      reward: HEADLINE_TEST.reward,
      targetRoles: TARGET_ROLES,
    };
  }
  if (deckId === "voice-khata-price") {
    return {
      cards: PRICE_CARDS,
      controlKey: "A",
      aggregates: priceAggregates(),
      flagsmith: null,
      claimants: [],
      reward: HEADLINE_TEST.reward,
      targetRoles: TARGET_ROLES,
    };
  }
  return null;
}

export const DEMO_PRODUCT_NAME = VOICE_KHATA.name;
