/**
 * Leaderboard, verdict and waitlist helpers. Pure.
 *
 * Winner / Result wording comes ONLY from decideDeck (decision.ts), which applies
 * Flagsmith's 95% chance, >= 50 identities per card and no SRM warning. "Leading" is a
 * display label for a card well ahead that has not reached a Result; it never ships anything.
 */
import { LIMITS } from "@/shared/lib/limits";
import type { FlagsmithExperimentResults } from "@/types";

import type { Tally } from "./aggregate";
import { decideDeck } from "./decision";
import { joinRate } from "./rules";
import type { ClaimantView, LeaderFilter, LeaderRow, VerdictView, WaitlistView } from "./types";

export interface CardMeta {
  key: string;
  /** "Headline B", "Rs 199 / mo". */
  label: string;
  valueText: string;
}

/** A card this far ahead (but short of a Result) is called "Leading" instead of "Too close to call". */
export const LEADING_FLOOR = 0.75;

export function buildLeaderboard(
  cards: readonly CardMeta[],
  tallies: Record<string, Tally>,
  filter: LeaderFilter,
  chances: Record<string, number | undefined> = {},
): LeaderRow[] {
  const rows = cards.map((card) => {
    const t = tallies[card.key] ?? { swipers: 0, saidYes: 0, joined: 0 };
    // Segment filters follow the 10-swiper rule; the full experiment (Everyone) does not.
    const suppressed = filter !== "everyone" && t.swipers < LIMITS.groupMinSize;
    return {
      card,
      t,
      suppressed,
      rate: suppressed ? -1 : joinRate(t.joined, t.swipers),
    };
  });
  rows.sort((a, b) => b.rate - a.rate || b.t.swipers - a.t.swipers || a.card.key.localeCompare(b.card.key));
  return rows.map(({ card, t, suppressed }, i) => ({
    rank: i + 1,
    key: card.key,
    label: card.label,
    valueText: card.valueText,
    swipers: suppressed ? null : t.swipers,
    saidYes: suppressed ? null : t.saidYes,
    joined: suppressed ? null : t.joined,
    claimRate: suppressed ? null : joinRate(t.joined, t.swipers),
    chanceBest: filter === "everyone" ? (chances[card.key] ?? null) : null,
    suppressed,
  }));
}

const noVerdict = (): VerdictView => ({
  kind: "none",
  headline: "No results yet.",
  pill: "Collecting data",
  leaderKey: null,
  leaderLabel: null,
  chance: null,
});

/**
 * @param controlKey variant key of the control card (the first card).
 * @param results what Flagsmith reported, or null when it could not be read.
 */
export function buildVerdict(
  cards: readonly CardMeta[],
  controlKey: string,
  results: FlagsmithExperimentResults | null,
): VerdictView {
  if (!results || results.cards.length === 0) return noVerdict();
  const label = (key: string) => cards.find((c) => c.key === key)?.label ?? key;
  const decision = decideDeck(results, controlKey);
  const challengers = results.cards
    .filter((c) => c.variantKey !== controlKey)
    .sort((a, b) => b.chanceToBeatControl - a.chanceToBeatControl);
  const top = challengers[0];

  if (decision.status === "decided") {
    const w = decision.winner;
    return {
      kind: "decided",
      headline: `${label(w.variantKey)} wins.`,
      pill: "Winner found",
      leaderKey: w.variantKey,
      leaderLabel: label(w.variantKey),
      chance: w.chanceToBeatControl,
    };
  }
  if (decision.status === "collecting") {
    return { ...noVerdict(), kind: "collecting", headline: "Collecting data." };
  }
  if (top && top.chanceToBeatControl >= LEADING_FLOOR) {
    return {
      kind: "leading",
      headline: `${label(top.variantKey)} is in the lead.`,
      pill: "Leading, not decided yet",
      leaderKey: top.variantKey,
      leaderLabel: label(top.variantKey),
      chance: top.chanceToBeatControl,
    };
  }
  return {
    kind: "too_close",
    headline: "Too close to call.",
    pill: "Too close to call",
    leaderKey: top?.variantKey ?? null,
    leaderLabel: top ? label(top.variantKey) : null,
    chance: top?.chanceToBeatControl ?? null,
  };
}

/* Waitlist ---------------------------------------------------------------- */

export interface ClaimantInput {
  email: string;
  cardKey: string;
  createdAt: Date;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function whenLabel(createdAt: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const WAITLIST_PREVIEW = 4;

export function buildWaitlist(
  claimants: readonly ClaimantInput[],
  cards: readonly CardMeta[],
  reward: string | null,
  now: Date,
  noun: string,
): WaitlistView {
  const sorted = [...claimants].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const label = (key: string) => cards.find((c) => c.key === key)?.label ?? key;
  const preview: ClaimantView[] = sorted.slice(0, WAITLIST_PREVIEW).map((c) => ({
    email: c.email,
    cardLabel: label(c.cardKey),
    when: whenLabel(c.createdAt, now),
  }));
  return {
    count: sorted.length,
    reward,
    preview,
    moreCount: Math.max(0, sorted.length - preview.length),
    acrossText: `One list across all ${cards.length} ${noun}s`,
  };
}

/** CSV cells starting with = + - @ are prefixed so a spreadsheet never runs them as formulas. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The founder's waitlist: the people who explicitly claimed the reward. Nothing else is exported. */
export function waitlistCsv(claimants: readonly ClaimantInput[], cards: readonly CardMeta[]): string {
  const label = (key: string) => cards.find((c) => c.key === key)?.label ?? key;
  const rows = [...claimants]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => [c.email, label(c.cardKey), c.createdAt.toISOString()].map(csvCell).join(","));
  return ["email,card,claimed_at", ...rows].join("\r\n") + "\r\n";
}
