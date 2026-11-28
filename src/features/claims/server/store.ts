/**
 * Storage port for claims, comments and the wallet (server only). The app always uses MongoDB (store-mongo.ts).
 * The in-memory adapter (store-memory.ts) is an empty test double, installed only by tests.
 * Responses themselves are written by WP3; this port only reads them and attaches comments.
 */
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { ServiceUnavailableError } from "@/features/swipe/errors";
import type { AnswerRecord } from "@/features/claims/history";
import type { SwipeSource } from "@/features/swipe/types";

export interface StoredResponse {
  id: string;
  swiperKey: string;
  deckId: string;
  cardId: string;
  answer: string;
  valid: boolean;
  counted: boolean;
  source: SwipeSource;
  /** Flagsmith accepted this swiper's $flag_exposure (set by the swipe path). reward_claim needs it. */
  exposedToFlagsmith?: boolean;
}

/** commentVoice as stored: the spec 03 5.14 fields plus the 30-day deletion mark. */
export interface VoiceRecord {
  /** Only present when the swiper ticked "Let <founder> play my voice note". */
  audioUrl?: string;
  durationSec: number;
  language: string;
  transcript: string;
  english: string;
  founderCanPlay: boolean;
  /** Set together with audioUrl: the audio is deleted after this moment. */
  deleteAfter?: Date;
}

export interface CommentPatch {
  comment?: string;
  voice?: VoiceRecord;
}

export interface WalletEntryRecord {
  responseId: string;
  deckId: string;
  /** Product name at the time of the swipe. */
  title: string;
  amountRs: number;
  note: string;
  swipeCount: number;
  createdAt: Date;
}

export interface WalletRecord {
  balanceRs: number;
  entries: WalletEntryRecord[];
}

export interface ClaimsStore {
  getResponse(id: string): Promise<StoredResponse | null>;
  /** Whether the response was written by this swiper (guest guid or user id). */
  isOwner(response: StoredResponse, swiperKey: string): boolean;
  /** One claim per email per deck: a repeat returns saved: false. */
  saveClaim(input: { deckId: string; cardId: string; email: string; createdAt: Date }): Promise<{ saved: boolean }>;
  setComment(responseId: string, patch: CommentPatch): Promise<void>;
  /** Idempotent per response: crediting the same response twice returns credited: false. */
  creditWallet(swiperKey: string, entry: WalletEntryRecord): Promise<{ credited: boolean; balanceRs: number }>;
  getWallet(swiperKey: string): Promise<WalletRecord>;
  /** This swiper's answers, newest first: createdAt before `before` (when set), at most `limit` rows. */
  listAnswers(swiperKey: string, opts: { before: Date | null; limit: number }): Promise<AnswerRecord[]>;
  /** Which of these decks the email has claimed a reward on. */
  claimedDeckIds(deckIds: readonly string[], email: string): Promise<Set<string>>;
  /** The playable audio for a response: undefined without consent, without audio, or once deleteAfter has passed. */
  getPlayableAudio(responseId: string, now: Date): Promise<string | undefined>;
  /** Clears audio whose deleteAfter has passed (the 30-day promise). Returns how many responses were cleared. */
  purgeExpiredAudio(now: Date): Promise<number>;
}

let cached: ClaimsStore | undefined;

/** The MongoDB store. Throws ServiceUnavailableError (a 503) when MONGODB_URI is not set. */
export async function getClaimsStore(): Promise<ClaimsStore> {
  if (cached) return cached;
  if (!process.env.MONGODB_URI) throw new ServiceUnavailableError(NOT_CONFIGURED_MESSAGE);
  const { createMongoClaimsStore } = await import("./store-mongo");
  cached = createMongoClaimsStore();
  return cached;
}

/** Tests only: install a store (usually an empty createMemoryClaimsStore()), or pass undefined to reset. */
export function setClaimsStoreForTests(store: ClaimsStore | undefined): void {
  cached = store;
}
