/**
 * Shared types for the "Test decided, ship the winner" assistant (WP8, spec 05 6.6).
 * Type-only: safe to import from client components.
 */
import type { FlagsmithExperimentResults } from "@/types";

export const SNOOZE_HOURS = 24;

export interface CardChance {
  key: string;
  cardId: string;
  /** Flagsmith's chance, 0 to 1. Never computed here. */
  chance: number;
  identities: number;
}

export type Assessment =
  | { decided: true; winnerKey: string; chances: CardChance[]; swipers: number | null; checksPassed: true }
  | { decided: false; reason: "collecting" | "too_close" | "no_results"; chances: CardChance[]; swipers: number | null; checksPassed: boolean };

export type AlertStatus = "active" | "snoozed" | "withdrawn" | "shipped";

export interface AlertRecord {
  deckId: string;
  ownerId: string;
  status: AlertStatus;
  winnerKey: string;
  chances: CardChance[];
  swipers: number | null;
  createdAt: string;
  updatedAt: string;
  snoozedUntil?: string;
  emailedAt?: string;
  /** In-app notification read flag. */
  read?: boolean;
}

export interface ShipRecord {
  deckId: string;
  ownerId: string;
  winnerKey: string;
  approvedBy: string;
  approvedAt: string;
  chances: CardChance[];
  weights: Record<string, number>;
  /** Flag state before shipping; undo writes it back. */
  previousSnapshot: unknown;
  /** Raw Flagsmith response of `complete` (kept for the record). */
  completeResponse: unknown;
  completeConfirmed: boolean;
  completeError?: string;
  /** The rollout decision sent with `complete`. */
  rolloutDecision?: { rollout_decision: string; rollout_variant?: number };
  /** Set when complete succeeded but writing the winning text to the flag failed (e.g. v2 feature versioning). */
  valueWriteError?: string;
  afterCompleteSnapshot?: unknown;
  undoneAt?: string;
  simulated: boolean;
}

export type EventType = "checked" | "decided" | "approved" | "shipped" | "undone";

export interface EventRow {
  deckId: string;
  type: EventType;
  chances: { cardId: string; key: string; chance: number }[];
  swipers: number;
  checksPassed: boolean;
  at: string;
  detail?: unknown;
}

/** One deck the watcher looks at. */
export interface WatchedDeck {
  deckId: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName: string;
  productName: string;
  /** "Headline test" */
  title: string;
  noun: string;
  flagName: string;
  experimentId?: string;
  /** Flagsmith option id per challenger key (stored at publish); the ship call's rollout_variant. */
  optionIds?: Record<string, number>;
  /** reward_claim metric id in Flagsmith's results payload (stored at publish). */
  rewardMetricId?: string;
  controlKey: string;
  cards: { key: string; cardId: string; text: string }[];
  /** Waitlist emails so far (display only). */
  waitlist: number;
}

export interface ResultsSnapshot {
  results: FlagsmithExperimentResults | null;
  /** Counted swipes (spec 5.9), for display. */
  swipers: number | null;
}

/** What My decks shows (dark card) and what /api/notifications returns. */
export interface AlertView {
  deckId: string;
  productName: string;
  title: string;
  headline: string;
  body: string;
  winnerKey: string;
  chancePercent: number;
  swipers: number | null;
  status: AlertStatus;
  /** "2 min ago" is computed in the UI from this. */
  raisedAt: string;
  read: boolean;
}

export interface ReviewCard {
  key: string;
  text: string;
  chancePercent: number;
  isWinner: boolean;
}

export interface ReviewView {
  deckId: string;
  productName: string;
  title: string;
  noun: string;
  flagName: string;
  decided: boolean;
  /** Why not, when not decided. */
  notDecidedText?: string;
  winnerKey: string | null;
  winnerText: string | null;
  headline: string;
  fromLine: string;
  cards: ReviewCard[];
  swipers: number | null;
  waitlist: number;
  steps: string[];
  /** One insight; code-filled, never decides anything. Null when none. */
  insight: string | null;
  alreadyShipped: boolean;
  /** Demo mode only: why this sheet's numbers differ from the Results page (the designs show both). */
  demoNote?: string;
}

export interface ShippedView {
  deckId: string;
  winnerKey: string;
  winnerText: string;
  headline: string;
  approvedLine: string;
  ticks: { title: string; detail: string; ok: boolean }[];
  next: { text: string; variable: "price" } | null;
  undoAvailable: boolean;
  /** What undo does, shown next to the button: it serves the control card; the test does not restart. */
  undoNote?: string;
  simulated: boolean;
}
