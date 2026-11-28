/**
 * Builds the whole Results / Who swiped payload from aggregates. Pure: the server
 * loader (load.ts) feeds it, so the screens and GET /api/results/[deckId] show the same numbers.
 */
import { LIMITS } from "@/shared/lib/limits";
import { parsePrice } from "@/features/decks/price";
import { shapeDemandCurve, type PriceArm } from "@/features/demand-curve";
import type { FlagsmithExperimentResults } from "@/types";

import type { DeckAggregates, GroupRow, Tally } from "./aggregate";
import { emptyTally } from "./aggregate";
import { interestsInsight, locationInsight, saidYesVsActed, sourceInsight, targetInsight, pct } from "./insights";
import {
  buildLeaderboard,
  buildVerdict,
  buildWaitlist,
  type CardMeta,
  type ClaimantInput,
} from "./leaderboard";
import { joinRate } from "./rules";
import { buildSegmentView } from "./segments";
import { STATE_TILES } from "./state-tiles";
import {
  LEADER_FILTERS,
  type AssistantNote,
  type DeckMeta,
  type InterestsTab,
  type LeaderFilter,
  type LeaderRow,
  type LocationTab,
  type ResultsPayload,
  type SegmentRowView,
  type SourceCardRow,
  type SourceTab,
  type TargetTab,
  type TotalsView,
  type WhoSwipedView,
} from "./types";

export interface PayloadInput {
  deck: DeckMeta;
  cards: CardMeta[];
  /** Variant key of the control card (the first card). */
  controlKey: string;
  aggregates: DeckAggregates;
  /** Null when Flagsmith could not be read (not configured, or an error). */
  flagsmith: FlagsmithExperimentResults | null;
  claimants: ClaimantInput[];
  reward: string | null;
  targetRoles: string[];
  now: Date;
}

const rateRow = (t: Tally) => ({ ...t, rate: joinRate(t.joined, t.swipers) });

function groupToRow(g: GroupRow): SegmentRowView {
  return { key: g.key, label: g.label, swipers: g.swipers, saidYes: g.saidYes, joined: g.joined, joinRate: joinRate(g.joined, g.swipers), best: false };
}

function buildLocation(agg: DeckAggregates): LocationTab {
  const groups = [...agg.location];
  const placed = groups.reduce((n, g) => n + g.swipers, 0);
  if (agg.total.swipers > placed) {
    // Swipes with no state estimate cannot be placed on the map; they count as hidden.
    const rest = agg.total.swipers - placed;
    const saidYes = agg.total.saidYes - groups.reduce((n, g) => n + g.saidYes, 0);
    const joined = agg.total.joined - groups.reduce((n, g) => n + g.joined, 0);
    groups.push({ key: "unknown", label: "No state estimate", swipers: rest, saidYes: Math.max(0, saidYes), joined: Math.max(0, joined), forceHidden: true });
  }
  const view = buildSegmentView(groups, agg.total);
  const hiddenSwipers = view.other?.swipers ?? 0;
  const tiles = view.rows.flatMap((r) => {
    const tile = STATE_TILES.find((t) => t.state === r.label);
    return tile ? [{ state: tile.state, joinRate: r.joinRate, best: r.best }] : [];
  });
  return {
    ...view,
    insight: locationInsight(view),
    tiles,
    hiddenNote:
      view.other && hiddenSwipers > 0
        ? `Not shown: ${view.other.swipers} swipers from states with under ${LIMITS.groupMinSize} people each (${view.other.joined} of them joined). You never see anyone's IP.`
        : null,
  };
}

function buildTarget(agg: DeckAggregates, roles: string[], topCard: { label: string; rate: number } | null): TargetTab {
  const t = agg.target.find((g) => g.key === "target");
  const o = agg.target.find((g) => g.key === "other");
  const enough = !!t && !!o && t.swipers >= LIMITS.groupMinSize && o.swipers >= LIMITS.groupMinSize;
  if (!enough || !t || !o) {
    return {
      roles,
      target: null,
      everyone: null,
      enough: false,
      total: { swipers: agg.total.swipers, saidYes: agg.total.saidYes, joined: agg.total.joined, text: `Too few swipers in a group to show it yet (under ${LIMITS.groupMinSize}).` },
      insight: null,
    };
  }
  const target = { ...groupToRow(t), best: true };
  const everyone = groupToRow(o);
  return {
    roles,
    target,
    everyone,
    enough: true,
    total: {
      swipers: agg.total.swipers,
      saidYes: agg.total.saidYes,
      joined: agg.total.joined,
      text: `Total: ${t.swipers} + ${o.swipers} = ${agg.total.swipers} swipers · ${t.saidYes} + ${o.saidYes} = ${agg.total.saidYes} said yes · ${t.joined} + ${o.joined} = ${agg.total.joined} joined. Every swiper has a role, so no one is left out.`,
    },
    insight: targetInsight({ target, everyone, total: agg.total, topCard }),
  };
}

function buildSource(agg: DeckAggregates, cards: CardMeta[], fullLeaderLabel: string | null): SourceTab {
  const view = buildSegmentView(agg.source, agg.total);
  // Fixed order as in the design: swipe feed first, then your link.
  view.rows.sort((a, b) => (a.key === "feed" ? -1 : 0) - (b.key === "feed" ? -1 : 0));
  const min = LIMITS.groupMinSize;
  const cell = (t: Tally | undefined) => (t && t.swipers >= min ? rateRow(t) : null);
  const rows: SourceCardRow[] = cards.map((c) => ({
    key: c.key,
    label: c.label,
    feed: cell(agg.cardBySource[c.key]?.feed),
    link: cell(agg.cardBySource[c.key]?.link),
    feedBest: false,
    linkBest: false,
  }));
  for (const side of ["feed", "link"] as const) {
    const ranked = rows.filter((r) => r[side]).sort((a, b) => (b[side]?.rate ?? 0) - (a[side]?.rate ?? 0) || (b[side]?.swipers ?? 0) - (a[side]?.swipers ?? 0));
    // "Best" needs at least two cards to compare.
    if (ranked.length >= 2 && ranked[0][side]!.rate > 0) ranked[0][side === "feed" ? "feedBest" : "linkBest"] = true;
  }
  const feed = agg.source.find((g) => g.key === "feed");
  const link = agg.source.find((g) => g.key === "link");
  const bothShown = !!feed && !!link && feed.swipers >= min && link.swipers >= min;
  return {
    ...view,
    cards: rows,
    totalText: bothShown
      ? `${feed.swipers} feed + ${link.swipers} link = ${agg.total.swipers} · ${feed.joined} + ${link.joined} = ${agg.total.joined} joined`
      : "",
    insight: sourceInsight({ cards: rows, fullLeaderLabel }),
  };
}

function buildInterests(agg: DeckAggregates): InterestsTab {
  const view = buildSegmentView(agg.interests, agg.total, { overlapping: true });
  const tiles: InterestsTab["tiles"] = [];
  const o = agg.overlap;
  if (o) {
    if (o.aFollowers >= LIMITS.groupMinSize) {
      tiles.push({ value: `${pct(o.aAlsoB / o.aFollowers)}%`, text: `of ${o.a} swipers also follow ${o.b}` });
    }
    if (o.targets >= LIMITS.groupMinSize) {
      tiles.push({ value: `${pct(o.targetsFollowA / o.targets)}%`, text: `of target users follow ${o.a}` });
    }
  }
  return {
    ...view,
    insight: interestsInsight(view),
    tiles,
    totalText: `One person can follow several interests, so the groups add up to more than ${agg.total.swipers}`,
  };
}

function buildTotals(agg: DeckAggregates): TotalsView {
  const t = agg.total;
  const feed = agg.source.find((g) => g.key === "feed")?.swipers ?? 0;
  const link = agg.source.find((g) => g.key === "link")?.swipers ?? 0;
  const target = agg.target.find((g) => g.key === "target")?.swipers ?? 0;
  return {
    swipers: t.swipers,
    saidYes: t.saidYes,
    saidYesPct: t.swipers === 0 ? 0 : pct(t.saidYes / t.swipers),
    joined: t.joined,
    joinedPct: t.swipers === 0 ? 0 : pct(t.joined / t.swipers),
    feed,
    link,
    targetSharePct: t.swipers === 0 ? 0 : pct(target / t.swipers),
  };
}

/** Price arms for a "find the best price" deck: one per card, price parsed from the card's text. */
export function priceArms(cards: readonly CardMeta[], tallies: Record<string, Tally>): PriceArm[] {
  const arms: PriceArm[] = [];
  for (const c of cards) {
    const parsed = parsePrice(c.valueText);
    if (!parsed) continue;
    const t = tallies[c.key] ?? emptyTally();
    arms.push({ key: c.key, price: parsed.amount, swipers: t.swipers, saidYes: t.saidYes, joined: t.joined });
  }
  return arms;
}

/** "/mo" becomes "/ mo", matching the "Rs 199 / mo" labels. */
export function unitLabelFor(valueText: string): string {
  const unit = parsePrice(valueText)?.unit ?? "";
  return unit.replace("/", "/ ").trim();
}

export function buildResultsPayload(input: PayloadInput): ResultsPayload {
  const { aggregates: agg, cards, deck, flagsmith } = input;

  const chances: Record<string, number | undefined> = {};
  for (const c of flagsmith?.cards ?? []) {
    // The wrapper reports control as 0; show no chance for it rather than a made-up one.
    chances[c.variantKey] = c.chanceToBeatControl > 0 ? c.chanceToBeatControl : undefined;
  }

  const leaderboard = {} as Record<LeaderFilter, LeaderRow[]>;
  for (const f of LEADER_FILTERS) leaderboard[f] = buildLeaderboard(cards, agg.byCard[f], f, chances);

  const verdict = buildVerdict(cards, input.controlKey, flagsmith);

  const topTarget = leaderboard.target[0];
  const topCard =
    topTarget && !topTarget.suppressed && topTarget.claimRate !== null && topTarget.claimRate > 0
      ? { label: topTarget.label, rate: topTarget.claimRate }
      : null;

  const whoSwiped: WhoSwipedView = {
    validSwipers: agg.total.swipers,
    hasData: agg.total.swipers > 0,
    location: buildLocation(agg),
    target: buildTarget(agg, input.targetRoles, topCard),
    source: buildSource(agg, cards, verdict.leaderLabel),
    interests: buildInterests(agg),
    saidYesVsActed: saidYesVsActed(agg.total),
  };

  let priceCurve = null;
  if (deck.variable === "price" && deck.priceMode === "level") {
    const arms = priceArms(cards, agg.byCard.everyone);
    if (arms.length >= 2) {
      priceCurve = shapeDemandCurve({
        arms,
        srmWarning: flagsmith?.srmWarning ?? false,
        unitLabel: unitLabelFor(cards[0]?.valueText ?? ""),
      });
    }
  }

  const refreshedAt = flagsmith?.refreshedAt ?? null;
  const assistant: AssistantNote = {
    refreshedAt: refreshedAt ? refreshedAt.toISOString() : null,
    minutesAgo: refreshedAt ? Math.max(0, Math.floor((input.now.getTime() - refreshedAt.getTime()) / 60_000)) : null,
  };

  return {
    deck,
    verdict,
    totals: buildTotals(agg),
    leaderboard,
    waitlist: buildWaitlist(input.claimants, cards, input.reward, input.now, deck.noun),
    whoSwiped,
    priceCurve,
    assistant,
    flagsmithAvailable: flagsmith !== null,
    generatedAt: input.now.toISOString(),
  };
}
