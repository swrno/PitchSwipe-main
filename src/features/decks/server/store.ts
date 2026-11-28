/**
 * Storage port for products and decks (server only). The app always uses MongoDB (store-mongo.ts). The in-memory
 * adapter (store-memory.ts) is an empty test double, installed only by tests through setStoreForTests().
 */
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { ServiceUnavailableError } from "@/features/swipe/errors";
import type { DeckRecord } from "../types";
import type { ProductInput } from "../product";
import type { ProductRecord } from "../views";
import type { MemberRecord, ProductAccess } from "../members";

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

export type NewMemberRecord = Omit<MemberRecord, "id">;

/**
 * Every read and write below takes `actorId`, the signed-in founder, never an owner id from a request. The store
 * decides what the actor may touch: their own products and decks, plus those of products they are an ACTIVE
 * co-founder of (an invite that was not accepted gives nothing). Decks keep the product owner's `ownerId`.
 * Product settings (updateProduct) stay owner-only; member management is the member methods at the end.
 */
export interface Store {
  /** "owner", "cofounder" (active member), or null. The one rule every read and write above builds on. */
  productAccess(actorId: string, productId: string): Promise<ProductAccess>;
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

  listMembers(productId: string): Promise<MemberRecord[]>;
  getMember(productId: string, memberId: string): Promise<MemberRecord | null>;
  /** Creates the invite, or (same product and email, still "invited") replaces its token and expiry. Null when that email is already an active member. */
  inviteMember(record: NewMemberRecord): Promise<MemberRecord | null>;
  findMemberByTokenHash(tokenHash: string): Promise<MemberRecord | null>;
  /** Atomic and single use: only an "invited" row whose token has not expired becomes active; the token hash is removed. Null otherwise. */
  acceptMember(memberId: string, uid: string, now: Date): Promise<MemberRecord | null>;
  removeMember(productId: string, memberId: string): Promise<boolean>;
}

let cached: Store | undefined;

/** The MongoDB store. Throws ServiceUnavailableError (a 503) when MONGODB_URI is not set. */
export async function getStore(): Promise<Store> {
  if (cached) return cached;
  if (!process.env.MONGODB_URI) throw new ServiceUnavailableError(NOT_CONFIGURED_MESSAGE);
  const { createMongoStore } = await import("./store-mongo");
  cached = createMongoStore();
  return cached;
}

/** Tests only: install a store (usually an empty createMemoryStore()), or pass undefined to reset. */
export function setStoreForTests(store: Store | undefined): void {
  cached = store;
}
