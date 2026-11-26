/**
 * Pure aggregation of swipes into the numbers the Results and Who swiped screens show.
 * No I/O. The server loader (load.ts) turns MongoDB rows into `SwipeRow`s; demo mode
 * builds `DeckAggregates` straight from fixtures.
 *
 * Only counted swipes count: `toSwipeRows` drops anything that is not valid AND counted.
 */
import type { Industry, State } from "@/lib/lists";
import type { Answer, ResponseSource } from "@/types";

import type { LeaderFilter } from "./types";

export interface Tally {
  swipers: number;
  saidYes: number;
  joined: number;
}

export const emptyTally = (): Tally => ({ swipers: 0, saidYes: 0, joined: 0 });

export function addTally(a: Tally, b: Tally): Tally {
  return { swipers: a.swipers + b.swipers, saidYes: a.saidYes + b.saidYes, joined: a.joined + b.joined };
}

/** One swipe as the loader hands it over (before the counted filter). */
export interface ResponseInput {
  cardKey: string;
  source: ResponseSource;
  isTargetUser: boolean;
  answer: Answer;
  region?: State;
  /** The swiper's "Show me ideas for" choices. */
  interests: Industry[];
  /** The swiper claimed the reward (left an email) on this deck. */
  joined: boolean;
  valid: boolean;
  counted: boolean;
}

export interface SwipeRow {
  cardKey: string;
  source: ResponseSource;
  isTargetUser: boolean;
  saidYes: boolean;
  region?: State;
  interests: Industry[];
  joined: boolean;
}

/** Only counted swipes count (valid, and the swiper's quality score is 70+). */
export function toSwipeRows(inputs: readonly ResponseInput[]): SwipeRow[] {
  return inputs
    .filter((r) => r.valid && r.counted)
    .map((r) => ({
      cardKey: r.cardKey,
      source: r.source,
      isTargetUser: r.isTargetUser,
      saidYes: r.answer === "positive",
      region: r.region,
      interests: r.interests,
      joined: r.joined,
    }));
}

export function tally(rows: readonly SwipeRow[]): Tally {
  const t = emptyTally();
  for (const r of rows) {
    t.swipers += 1;
    if (r.saidYes) t.saidYes += 1;
    if (r.joined) t.joined += 1;
  }
  return t;
}

export interface GroupRow extends Tally {
  key: string;
  label: string;
  /** Already rolled into "Other" by the source (demo fixtures: "Hidden (states under 10)"). */
  forceHidden?: boolean;
}

/** Groups rows by one or more keys per row (interests: one swiper can be in several groups). */
export function groupRows(rows: readonly SwipeRow[], keysOf: (row: SwipeRow) => readonly string[]): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const row of rows) {
    for (const key of new Set(keysOf(row))) {
      const g = map.get(key) ?? { key, label: key, ...emptyTally() };
      g.swipers += 1;
      if (row.saidYes) g.saidYes += 1;
      if (row.joined) g.joined += 1;
      map.set(key, g);
    }
  }
  return [...map.values()];
}

export interface InterestOverlap {
  a: string;
  b: string;
  /** Swipers who follow `a`. */
  aFollowers: number;
  /** ...and also follow `b`. */
  aAlsoB: number;
  /** Swipers who are target users. */
  targets: number;
  /** ...and follow `a`. */
  targetsFollowA: number;
}

/** Everything the screens need about one deck, before the 10-swiper rule is applied. */
export interface DeckAggregates {
  total: Tally;
  /** Per card key, for each leaderboard filter. */
  byCard: Record<LeaderFilter, Record<string, Tally>>;
  cardBySource: Record<string, { feed: Tally; link: Tally }>;
  location: GroupRow[];
  /** Keys "target" and "other". */
  target: GroupRow[];
  /** Keys "feed" and "link". */
  source: GroupRow[];
  interests: GroupRow[];
  overlap?: InterestOverlap | null;
}

export function emptyAggregates(): DeckAggregates {
  return {
    total: emptyTally(),
    byCard: { everyone: {}, target: {}, link: {} },
    cardBySource: {},
    location: [],
    target: [],
    source: [],
    interests: [],
    overlap: null,
  };
}

function byCardKey(rows: readonly SwipeRow[], cardKeys: readonly string[]): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const k of cardKeys) out[k] = tally(rows.filter((r) => r.cardKey === k));
  return out;
}

/** Interest overlap for the Interests tab: the top interest by join rate against the most followed other one. */
function computeOverlap(rows: readonly SwipeRow[], interests: readonly GroupRow[]): InterestOverlap | null {
  if (interests.length < 2) return null;
  const rate = (g: GroupRow) => (g.swipers === 0 ? 0 : g.joined / g.swipers);
  const a = [...interests].sort((x, y) => rate(y) - rate(x) || y.swipers - x.swipers)[0];
  const b = [...interests].filter((g) => g.key !== a.key).sort((x, y) => y.swipers - x.swipers)[0];
  const followers = rows.filter((r) => r.interests.includes(a.key as Industry));
  const targets = rows.filter((r) => r.isTargetUser);
  return {
    a: a.key,
    b: b.key,
    aFollowers: followers.length,
    aAlsoB: followers.filter((r) => r.interests.includes(b.key as Industry)).length,
    targets: targets.length,
    targetsFollowA: targets.filter((r) => r.interests.includes(a.key as Industry)).length,
  };
}

export function aggregateSwipes(rows: readonly SwipeRow[], cardKeys: readonly string[]): DeckAggregates {
  const feed = rows.filter((r) => r.source === "feed");
  const link = rows.filter((r) => r.source === "link");
  const targets = rows.filter((r) => r.isTargetUser);
  const cardBySource: DeckAggregates["cardBySource"] = {};
  for (const k of cardKeys) {
    cardBySource[k] = {
      feed: tally(feed.filter((r) => r.cardKey === k)),
      link: tally(link.filter((r) => r.cardKey === k)),
    };
  }
  const interests = groupRows(rows, (r) => r.interests);
  return {
    total: tally(rows),
    byCard: {
      everyone: byCardKey(rows, cardKeys),
      target: byCardKey(targets, cardKeys),
      link: byCardKey(link, cardKeys),
    },
    cardBySource,
    // Swipes without a state estimate cannot be placed on the map and are left out of it.
    location: groupRows(rows.filter((r) => r.region), (r) => [r.region as string]),
    target: [
      { key: "target", label: "Target users", ...tally(targets) },
      { key: "other", label: "Everyone else", ...tally(rows.filter((r) => !r.isTargetUser)) },
    ],
    source: [
      { key: "feed", label: "Swipe feed", ...tally(feed) },
      { key: "link", label: "Your link", ...tally(link) },
    ],
    interests,
    overlap: computeOverlap(rows, interests),
  };
}
