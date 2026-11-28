/** My decks status labels, filters and tones (designs F1/F1b; spec/02 §5.1 "Status"). Pure. */
import type { DeckStatus } from "@/types";

export type StatusTone = "won" | "leading" | "live" | "ready" | "draft" | "finished";

export interface DeckStatusInput {
  status: DeckStatus;
  /** Chance this deck's best card is best, 0 to 1, when known. */
  chance?: number;
  shippedAt?: Date | string | null;
}

export interface DeckStatusView {
  label: string;
  tone: StatusTone;
}

export function chancePercent(chance: number): number {
  return Math.round(chance * 100);
}

/**
 * - draft: "Draft"
 * - live: "Leading · 88% sure" once Flagsmith reports a chance, else "Live"
 * - decided (95% reached) and not yet shipped: "Ready to ship"
 * - decided and shipped, or shipped: "Won"
 * - closed: "Archived"
 */
export function deckStatusView(deck: DeckStatusInput): DeckStatusView {
  switch (deck.status) {
    case "draft":
      return { label: "Draft", tone: "draft" };
    case "live":
      return deck.chance !== undefined
        ? { label: `Leading · ${chancePercent(deck.chance)}% sure`, tone: "leading" }
        : { label: "Live", tone: "live" };
    case "decided":
      return deck.shippedAt ? { label: "Won", tone: "won" } : { label: "Ready to ship", tone: "ready" };
    case "shipped":
      return { label: "Won", tone: "won" };
    case "closed":
      return { label: "Archived", tone: "finished" };
  }
}

export const DECK_FILTERS = ["all", "live", "drafts", "finished", "archived"] as const;
export type DeckFilter = (typeof DECK_FILTERS)[number];

export const DECK_FILTER_LABELS: Record<DeckFilter, string> = {
  all: "All",
  live: "Live",
  drafts: "Drafts",
  finished: "Finished",
  archived: "Archived",
};

/** All hides archived decks; Finished = decided or shipped. */
export function matchesFilter(status: DeckStatus, filter: DeckFilter): boolean {
  switch (filter) {
    case "all":
      return status !== "closed";
    case "live":
      return status === "live";
    case "drafts":
      return status === "draft";
    case "finished":
      return status === "decided" || status === "shipped";
    case "archived":
      return status === "closed";
  }
}
