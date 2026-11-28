/**
 * "Test decided" check. Applies the shared rules (95% chance to beat control,
 * >= 50 identities per card, no SRM warning) to numbers Flagsmith reported.
 * It never computes a probability and never overrides Flagsmith: if Flagsmith
 * reports no winner at the threshold, the answer is not "decided".
 */
import { LIMITS } from "@/shared/lib/limits";
import type { FlagsmithCardResult, FlagsmithExperimentResults } from "@/types";

import { isResult } from "./rules";

export type DeckDecision =
  | { status: "decided"; winner: FlagsmithCardResult }
  | { status: "collecting" }
  | { status: "too_close" };

/** @param controlKey variant key of the control card; it cannot win against itself. */
export function decideDeck(results: FlagsmithExperimentResults, controlKey: string): DeckDecision {
  const { cards, srmWarning } = results;
  if (cards.length === 0) return { status: "collecting" };

  // Every card (control included) needs its identities before anything is a Result.
  if (cards.some((c) => c.identities < LIMITS.minIdentitiesPerCard)) return { status: "collecting" };

  const winners = cards
    .filter((card) => card.variantKey !== controlKey && isResult(card, srmWarning))
    .sort((a, b) => b.chanceToBeatControl - a.chanceToBeatControl);

  return winners.length > 0 ? { status: "decided", winner: winners[0] } : { status: "too_close" };
}
