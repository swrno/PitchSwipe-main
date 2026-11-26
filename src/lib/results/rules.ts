/**
 * Shared results rules (spec/06 §7, spec/08 §13.4). Used by UI, export, the
 * assistant and chat. Pure functions only: no I/O, no Flagsmith calls.
 */
import { LIMITS } from "@/fixtures";
import type { FlagsmithCardResult } from "@/types";

export type CardVerdict = "result" | "collecting" | "too_close";

/** A card is a Result only with >= 95% chance, >= 50 identities and no SRM warning. */
export function isResult(card: FlagsmithCardResult, srmWarning: boolean): boolean {
  return (
    !srmWarning &&
    card.identities >= LIMITS.minIdentitiesPerCard &&
    card.chanceToBeatControl >= LIMITS.winnerConfidence
  );
}

export function verdictFor(card: FlagsmithCardResult, srmWarning: boolean): CardVerdict {
  if (card.identities < LIMITS.minIdentitiesPerCard) return "collecting";
  if (srmWarning) return "too_close";
  return card.chanceToBeatControl >= LIMITS.winnerConfidence ? "result" : "too_close";
}

/** Groups under 10 swipers are hidden and shown as "Other". */
export function groupLabel(label: string, swipers: number): string {
  return swipers < LIMITS.groupMinSize ? LIMITS.otherLabel : label;
}

/** Join rate as a fraction; returns 0 for an empty group. */
export function joinRate(joined: number, swipers: number): number {
  return swipers === 0 ? 0 : joined / swipers;
}
