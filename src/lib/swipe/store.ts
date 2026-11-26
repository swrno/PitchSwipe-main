/**
 * Storage port for the swipe feed (server only). Two adapters:
 *  - store-mongo.ts: MongoDB via the WP0 models (when MONGODB_URI is set)
 *  - store-memory.ts: in-memory, seeded from src/fixtures (demo mode)
 */
import type { Role, State } from "@/lib/lists";
import type { Answer } from "@/types";
import { ServiceUnavailableError } from "./errors";
import type { SwipeDeck, SwipeSource } from "./types";

/** Deck statuses that a personal link still serves (a decided or shipped deck shows its winner). */
export const LINK_STATUSES = ["live", "decided", "shipped"] as const;

export interface ResponseRecord {
  deckId: string;
  cardId: string;
  swiperKey: string;
  source: SwipeSource;
  /** Role at swipe time. */
  role?: Role;
  isTargetUser: boolean;
  answer: Answer;
  dwellMs: number;
  /** State estimated from IP. The raw IP is never stored. */
  region?: State;
  valid: boolean;
  counted: boolean;
  createdAt: Date;
  /** Set after save, once Flagsmith accepted this swiper's $flag_exposure (markExposed). Gates reward_claim. */
  exposedToFlagsmith?: boolean;
}

export type SaveResult = { saved: true; id: string } | { saved: false; duplicate: true };

export interface SwipeStore {
  readonly demo: boolean;
  /** Live decks listed in the feed. */
  listFeedDecks(): Promise<SwipeDeck[]>;
  /** Deck for a personal link (live, decided or shipped). */
  getDeckBySlug(slug: string): Promise<SwipeDeck | null>;
  getDeckById(id: string): Promise<SwipeDeck | null>;
  hasResponded(deckId: string, swiperKey: string): Promise<boolean>;
  /** One vote per swiper per deck: a second save for the same pair returns duplicate. */
  saveResponse(record: ResponseRecord): Promise<SaveResult>;
  /**
   * Records that Flagsmith accepted the exposure for this response. reward_claim is sent only for exposed
   * responses, so both conversions cover the same population as the exposures. Both real stores implement it;
   * a store without it means "never exposed" (claims then stay out of Flagsmith).
   */
  markExposed?(responseId: string): Promise<void>;
}

/**
 * Same rule as the decks `isDemoMode()`: demo (in-memory fixtures) only with PITCHSWIPE_DEMO=1, or outside
 * production when MONGODB_URI is unset. Production without MONGODB_URI is NOT demo: it is misconfigured and
 * every swipe/claims route answers 503 instead of serving fixture decks.
 */
export function isSwipeDemoMode(): boolean {
  if (process.env.PITCHSWIPE_DEMO === "1") return true;
  return !process.env.MONGODB_URI && process.env.NODE_ENV !== "production";
}

/** True when real storage is required but not configured. */
export function isSwipeMisconfigured(): boolean {
  return !isSwipeDemoMode() && !process.env.MONGODB_URI;
}

let cached: SwipeStore | undefined;

/** Picks the adapter once per server process. */
export async function getSwipeStore(): Promise<SwipeStore> {
  if (cached) return cached;
  if (isSwipeMisconfigured()) throw new ServiceUnavailableError("The swipe service is not configured.");
  if (isSwipeDemoMode()) {
    const { memorySwipeStore } = await import("./store-memory");
    cached = memorySwipeStore;
  } else {
    const { createMongoSwipeStore } = await import("./store-mongo");
    cached = createMongoSwipeStore();
  }
  return cached;
}
