/**
 * One short insight per Who swiped tab, plus the said-yes-vs-acted headline.
 * Written from templates: code fills every number, nothing here calls an AI and
 * nothing decides a winner. Every insight is a Lead (spec/05 section 5.10), never a Result.
 */
import { LIMITS } from "@/shared/lib/limits";

import type { InsightView, SaidYesVsActed, SegmentRowView, SegmentView, SourceCardRow } from "./types";

export const pct = (x: number): number => Math.round(x * 100);

/** "almost double", "double", "3x", "1.5x" for rate / overall rate. */
export function multiplePhrase(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "far below";
  if (ratio < 1.15 && ratio > 0.87) return "about the same as";
  if (ratio <= 0.87) return `${Math.round(ratio * 10) / 10}x`;
  if (ratio < 1.8) return `${Math.round(ratio * 10) / 10}x`;
  if (ratio < 1.95) return "almost double";
  if (ratio < 2.1) return "double";
  return `${Math.round(ratio)}x`;
}

/* Said yes vs acted ------------------------------------------------------- */

export function saidYesVsActed(total: { swipers: number; saidYes: number; joined: number }): SaidYesVsActed {
  const saidYesPct = total.swipers === 0 ? 0 : pct(total.saidYes / total.swipers);
  const joinedPct = total.swipers === 0 ? 0 : pct(total.joined / total.swipers);
  const gapPoints = Math.max(0, saidYesPct - joinedPct);
  const mostDidNotAct = total.saidYes > 0 && total.joined < total.saidYes / 2;
  return {
    swipers: total.swipers,
    saidYes: total.saidYes,
    saidYesPct,
    joined: total.joined,
    joinedPct,
    gapPoints,
    headline: `${gapPoints} points said yes but did not act.`,
    note: mostDidNotAct
      ? "Most people who say yes do not act. The email is the real signal."
      : "About half or more of the people who said yes also left an email. The email is the real signal.",
  };
}

/* Location ---------------------------------------------------------------- */

export function locationInsight(view: SegmentView): InsightView | null {
  const top = view.rows[0];
  if (!top || top.joined === 0) return null;
  return {
    title: `${top.label} joins the most`,
    body: `${top.joined} of ${top.swipers} joined (${pct(top.joinRate)}%), ${multiplePhrase(top.joinRate / (view.overall.rate || 1))} the ${pct(view.overall.rate)}% overall. A small group: a lead, not a result.`,
    lead: `Lead: 1 of ${view.groupCount} state groups, ${top.swipers} swipers. Confirm with a test in ${top.label}.`,
  };
}

/* Target users ------------------------------------------------------------ */

export function targetInsight(input: {
  target: SegmentRowView;
  everyone: SegmentRowView;
  total: { swipers: number; saidYes: number; joined: number };
  /** Best card among target users (10+ swipers), if known. */
  topCard: { label: string; rate: number } | null;
}): InsightView {
  const t = pct(input.target.joinRate);
  const o = pct(input.everyone.joinRate);
  const ratio = input.everyone.joinRate > 0 ? input.target.joinRate / input.everyone.joinRate : Infinity;
  let title: string;
  if (ratio >= 1.5 && Number.isFinite(ratio)) title = `Your target users want it ${Math.round(ratio)}x more`;
  else if (ratio >= 1.5) title = "Only your target users joined";
  else if (ratio > 0.87) title = "Target users act about as often as everyone else";
  else title = "Target users act less often than everyone else";
  const yesPct = input.total.swipers === 0 ? 0 : pct(input.total.saidYes / input.total.swipers);
  const joinedPct = input.total.swipers === 0 ? 0 : pct(input.total.joined / input.total.swipers);
  const parts = [`${t}% of target users joined the waitlist vs ${o}% of others.`];
  if (input.topCard) parts.push(`Among target users, ${input.topCard.label} leads (${pct(input.topCard.rate)}%).`);
  parts.push(`Plan around the ${joinedPct}% who acted, not the ${yesPct}% who said yes.`);
  return {
    title,
    body: parts.join(" "),
    lead: `Lead: ${input.target.swipers} vs ${input.everyone.swipers} swipers. Confirm with a target-users-only test.`,
  };
}

/* Source ------------------------------------------------------------------ */

export function sourceInsight(input: {
  cards: SourceCardRow[];
  /** Label of the card Flagsmith leads with on the full experiment, if any. */
  fullLeaderLabel: string | null;
}): InsightView | null {
  const feed = input.cards.find((c) => c.feedBest);
  const link = input.cards.find((c) => c.linkBest);
  if (!feed || !link) return null;
  const agree = feed.key === link.key;
  const agreesWithFull = input.fullLeaderLabel !== null && feed.label === input.fullLeaderLabel;
  if (agree) {
    return {
      title: `Both sources pick ${feed.label}`,
      body: `People from your link join more often when they may know you. The feed is the neutral read, and it agrees on ${feed.key}.`,
      lead: agreesWithFull
        ? "Agrees with the full experiment, so treat it as support, not a separate result."
        : "Differs from the full experiment, so treat it as a Lead, not a result.",
    };
  }
  return {
    title: "Feed and link disagree",
    body: `The feed picks ${feed.label}, your link picks ${link.label}. People from your link may know you, so trust the feed more.`,
    lead: "Lead: the two sources disagree. The full experiment decides, not this split.",
    warning: true,
  };
}

/* Interests --------------------------------------------------------------- */

export function interestsInsight(view: SegmentView): InsightView | null {
  const top = view.rows[0];
  if (!top || top.joined === 0) return null;
  return {
    title: `${top.label}-minded swipers join the most`,
    body: `${top.joined} of ${top.swipers} (${pct(top.joinRate)}%) joined. A ${top.label}-only audience may be worth trying next.`,
    lead: `Lead: 1 of ${view.groupCount} interest groups, ${top.swipers} swipers. Confirm with a ${top.label}-only test.`,
  };
}

/** Reminder text shown under every Who swiped view. */
export const LEADS_FOOTNOTE = `Segment views are leads, not results: the winner is decided only on the full experiment. Groups under ${LIMITS.groupMinSize} swipers are hidden.`;
