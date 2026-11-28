/**
 * The "decided" rule as a pure function (spec 05 6.6 step 2). Flagsmith decides:
 * this wraps decideDeck, which applies 95% chance, >= 50 identities on every card
 * and no sample-ratio warning to Flagsmith's own numbers. Nothing here computes a
 * probability or overrides Flagsmith. "Counted swipes only" holds because only
 * counted swipes are ever sent to Flagsmith (see swipe pipeline), so identities and
 * chances already exclude uncounted swipers.
 */
import { LIMITS } from "@/shared/lib/limits";
import { decideDeck } from "@/features/results/decision";
import type { FlagsmithExperimentResults } from "@/types";

import type { Assessment, CardChance } from "./types";

export function toChances(results: FlagsmithExperimentResults): CardChance[] {
  return results.cards.map((c) => ({
    key: c.variantKey,
    cardId: c.cardId,
    chance: c.chanceToBeatControl,
    identities: c.identities,
  }));
}

export function assessDeck(
  results: FlagsmithExperimentResults | null,
  controlKey: string,
  swipers: number | null = null,
): Assessment {
  if (!results || results.cards.length === 0) {
    return { decided: false, reason: "no_results", chances: [], swipers, checksPassed: false };
  }
  const chances = toChances(results);
  const verdict = decideDeck(results, controlKey);
  if (verdict.status === "decided") {
    return { decided: true, winnerKey: verdict.winner.variantKey, chances, swipers, checksPassed: true };
  }
  const enough = chances.every((c) => c.identities >= LIMITS.minIdentitiesPerCard);
  return {
    decided: false,
    reason: verdict.status === "collecting" ? "collecting" : "too_close",
    chances,
    swipers,
    checksPassed: enough && !results.srmWarning,
  };
}

export const percent = (chance: number): number => Math.round(chance * 100);
