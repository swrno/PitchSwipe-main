/**
 * Adapter from the WP7 results payload (and Flagsmith results) to the builder's DeckFacts. Pure.
 * Every number is copied from the aggregates the Results screens already show; nothing is computed here
 * beyond rounding the Flagsmith chance for display.
 */
import { TEST_VARIABLE_LABELS, type TestVariable } from "@/shared/lib/lists";
import type { ResultsPayload } from "@/features/results/types";
import type { FlagsmithExperimentResults } from "@/types";

import type { DeckFacts } from "./types";

export function deckFactsFromResults(
  payload: ResultsPayload,
  experiment: FlagsmithExperimentResults | null,
  commentCount: number,
  index: number,
): DeckFacts {
  const { deck, verdict, totals } = payload;
  // "Finished" is the Results screen's own verdict (Flagsmith decision) or an approved winner.
  const finished = verdict.kind === "decided" || deck.status === "decided" || deck.status === "shipped";
  const row = verdict.leaderKey ? payload.leaderboard.everyone.find((r) => r.key === verdict.leaderKey) : undefined;
  const topState = payload.whoSwiped.location.rows[0];
  return {
    id: deck.id,
    index,
    label: TEST_VARIABLE_LABELS[deck.variable as TestVariable] ?? deck.label,
    noun: deck.noun,
    variable: deck.variable,
    status: deck.status,
    finished,
    swipers: totals.swipers,
    saidYes: totals.saidYes,
    joined: totals.joined,
    waitlist: payload.waitlist.count,
    comments: commentCount,
    leaderText: row ? row.valueText || row.label : null,
    leaderChancePct: verdict.chance === null ? null : Math.round(verdict.chance * 100),
    cards: experiment
      ? experiment.cards.map((c) => ({ id: c.variantKey, chancePct: c.chanceToBeatControl * 100, identities: c.identities }))
      : [],
    srmWarning: experiment?.srmWarning ?? false,
    targetSwipers: payload.whoSwiped.target.target?.swipers ?? null,
    topState: topState ? { label: topState.label, swipers: topState.swipers, joined: topState.joined } : null,
  };
}
