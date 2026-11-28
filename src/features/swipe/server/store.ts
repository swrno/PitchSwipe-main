/**
 * Storage port for the swipe feed (server only). The app always uses MongoDB (store-mongo.ts). The in-memory
 * adapter (store-memory.ts) is an empty test double, installed only by tests through setSwipeStoreForTests().
 */
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import type { Role, State } from "@/shared/lib/lists";
import type { Answer } from "@/types";
import { ServiceUnavailableError } from "../errors";
import type { SwipeDeck, SwipeSource } from "../types";

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

let cached: SwipeStore | undefined;

/** The MongoDB store. Throws ServiceUnavailableError (a 503) when MONGODB_URI is not set. */
export async function getSwipeStore(): Promise<SwipeStore> {
  if (cached) return cached;
  if (!process.env.MONGODB_URI) throw new ServiceUnavailableError(NOT_CONFIGURED_MESSAGE);
  const { createMongoSwipeStore } = await import("./store-mongo");
  cached = createMongoSwipeStore();
  return cached;
}

/** Tests only: install a store (usually an empty createMemorySwipeStore()), or pass undefined to reset. */
export function setSwipeStoreForTests(store: SwipeStore | undefined): void {
  cached = store;
}
