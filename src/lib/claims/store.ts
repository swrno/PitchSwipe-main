/**
 * Storage port for claims, comments and the demo wallet (server only). Two adapters:
 *  - store-mongo.ts: MongoDB (when MONGODB_URI is set)
 *  - store-memory.ts: in-memory, seeded from src/fixtures (demo mode)
 * Responses themselves are written by WP3; this port only reads them and attaches comments.
 */
import { ServiceUnavailableError } from "@/lib/swipe/errors";
import { isSwipeDemoMode, isSwipeMisconfigured } from "@/lib/swipe/store";
import type { SwipeSource } from "@/lib/swipe/types";

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
  /** Demo seed so the wallet matches the designs; 0 in production. */
  weeklyBaseRs: number;
  weeklyBaseSwipes: number;
  /** Demo seed for the swipe-home "earned today" tiles (design phone 33); 0 in production. */
  todayBaseRs: number;
  todayBaseSwipes: number;
}

export interface ClaimsStore {
  readonly demo: boolean;
  getResponse(id: string): Promise<StoredResponse | null>;
  /** Whether the response was written by this swiper (guest guid or user id). */
  isOwner(response: StoredResponse, swiperKey: string): boolean;
  /** One claim per email per deck: a repeat returns saved: false. */
  saveClaim(input: { deckId: string; cardId: string; email: string; createdAt: Date }): Promise<{ saved: boolean }>;
  setComment(responseId: string, patch: CommentPatch): Promise<void>;
  /** Idempotent per response: crediting the same response twice returns credited: false. */
  creditWallet(swiperKey: string, entry: WalletEntryRecord): Promise<{ credited: boolean; balanceRs: number }>;
  getWallet(swiperKey: string): Promise<WalletRecord>;
  /** The playable audio for a response: undefined without consent, without audio, or once deleteAfter has passed. */
  getPlayableAudio(responseId: string, now: Date): Promise<string | undefined>;
  /** Clears audio whose deleteAfter has passed (the 30-day promise). Returns how many responses were cleared. */
  purgeExpiredAudio(now: Date): Promise<number>;
}

/** Same rule as the swipe store (production guard included), so both stores always agree. */
export function isClaimsDemoMode(): boolean {
  return isSwipeDemoMode();
}

let cached: ClaimsStore | undefined;

export async function getClaimsStore(): Promise<ClaimsStore> {
  if (cached) return cached;
  if (isSwipeMisconfigured()) throw new ServiceUnavailableError("The claims service is not configured.");
  if (isClaimsDemoMode()) {
    const { memoryClaimsStore } = await import("./store-memory");
    cached = memoryClaimsStore;
  } else {
    const { createMongoClaimsStore } = await import("./store-mongo");
    cached = createMongoClaimsStore();
  }
  return cached;
}
