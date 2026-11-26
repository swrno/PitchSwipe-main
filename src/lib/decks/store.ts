/**
 * Storage port for products and decks (server only). Two adapters:
 *  - store-mongo.ts: MongoDB via the WP0 models (when MONGODB_URI is set)
 *  - store-memory.ts: in-memory, seeded from src/fixtures (demo mode)
 */
import type { DeckRecord } from "./types";
import type { ProductInput } from "./product";
import type { ProductRecord } from "./views";

export interface DeckStats {
  swipers: number;
  waitlist: number;
  /** Chance the leading card is best, 0 to 1, when known. */
  chance?: number;
}

export type NewDeckRecord = Omit<DeckRecord, "_id">;

/**
 * A publish claim older than this is treated as abandoned (a crashed or killed request). Publishing makes about
 * a dozen sequential Flagsmith calls with a 15 s timeout each, so a live publish always finishes well inside it.
 */
export const PUBLISH_CLAIM_TTL_MS = 5 * 60_000;

/**
 * Mongo only: a draft save that replaces cards marks the deck (`editingAt`) until the new cards are written, and
 * a marker older than this is treated as abandoned (a crashed request). Replacing a few cards takes milliseconds.
 */
export const EDIT_LOCK_TTL_MS = 30_000;

/** True while a publish holds the deck (claimed less than PUBLISH_CLAIM_TTL_MS ago). */
export function isPublishClaimed(deck: { publishingAt?: Date | string | null }, now: number = Date.now()): boolean {
  if (!deck.publishingAt) return false;
  const at = new Date(deck.publishingAt).getTime();
  return Number.isFinite(at) && now - at < PUBLISH_CLAIM_TTL_MS;
}

export interface Store {
  readonly demo: boolean;
  listProducts(ownerId: string): Promise<ProductRecord[]>;
  getProduct(ownerId: string, id: string): Promise<ProductRecord | null>;
  createProduct(ownerId: string, input: ProductInput): Promise<ProductRecord>;
  updateProduct(ownerId: string, id: string, input: ProductInput): Promise<ProductRecord | null>;

  listDecks(ownerId: string): Promise<DeckRecord[]>;
  getDeck(ownerId: string, id: string): Promise<DeckRecord | null>;
  createDeck(ownerId: string, record: NewDeckRecord): Promise<DeckRecord>;
  /**
   * Merges `patch` into the deck; when `patch.cards` is present the cards are replaced (only while the deck is a
   * draft that no publish has claimed and no other card write is changing, decided atomically; null otherwise).
   * A publish claim never lands between the guarded update and the card write.
   */
  updateDeck(ownerId: string, id: string, patch: Partial<NewDeckRecord>): Promise<DeckRecord | null>;
  /**
   * Atomically claims a draft for publishing: sets `publishingAt = now` only if the deck is a draft and no fresh
   * claim exists (none, or older than PUBLISH_CLAIM_TTL_MS). False when another publish holds it.
   * The publish's final save clears the claim (publishingAt: null).
   */
  claimPublish(ownerId: string, id: string, now: Date): Promise<boolean>;
  /** Deletes a draft that no publish has claimed (decided atomically). False when nothing matched. */
  deleteDeck(ownerId: string, id: string): Promise<boolean>;
  deckStats(ownerId: string, deckIds: string[]): Promise<Record<string, DeckStats>>;
}

/**
 * Demo mode (in-memory fixtures, no sign-in) only when explicitly asked for with PITCHSWIPE_DEMO=1, or
 * implicitly outside production when there is no MONGODB_URI. A production deployment that loses its
 * MONGODB_URI does NOT silently fall open as the demo founder; routes answer 503 instead.
 */
export function isDemoMode(): boolean {
  if (process.env.PITCHSWIPE_DEMO === "1") return true;
  return !process.env.MONGODB_URI && process.env.NODE_ENV !== "production";
}

/** True when real storage is required but not configured (production without MONGODB_URI, no explicit demo). */
export function isMisconfigured(): boolean {
  return !isDemoMode() && !process.env.MONGODB_URI;
}

let cached: Store | undefined;

/** Picks the adapter once per server process. */
export async function getStore(): Promise<Store> {
  if (cached) return cached;
  if (isDemoMode()) {
    const { memoryStore } = await import("./store-memory");
    cached = memoryStore;
  } else {
    const { createMongoStore } = await import("./store-mongo");
    cached = createMongoStore();
  }
  return cached;
}
