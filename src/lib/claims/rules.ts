/**
 * Pure rules for claims, comments, voice notes and the demo wallet (WP4). Client-safe: no server imports.
 * The swipe rules themselves (valid, counted, paid) live in src/lib/swipe/validity.ts and are reused, not copied.
 */
import { shouldSendToFlagsmith } from "@/lib/swipe/validity";

export const MAX_COMMENT_CHARS = 500;
export const MAX_VOICE_SECONDS = 30;
export const AUDIO_RETENTION_DAYS = 30;
/** Largest audio upload we accept (30 s of compressed audio is far below this). */
export const MAX_AUDIO_BYTES = 2_000_000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the server waits for Claude's English for a voice note (one try, no retries). */
export const VOICE_TRANSLATE_LLM_TIMEOUT_MS = 11_000;
/**
 * How long the browser waits for the English, from the moment it asks for the ID token. The margin over the LLM
 * timeout covers the token refresh, the network both ways, token verification and a cold start, so the browser
 * does not give up on an answer the server already paid for.
 */
export const VOICE_TRANSLATE_CLIENT_TIMEOUT_MS = VOICE_TRANSLATE_LLM_TIMEOUT_MS + 5_000;

/** A claim is stored only for a valid, counted, positive swipe. */
export function canClaim(input: { answer: string; valid: boolean; counted: boolean }): boolean {
  return input.answer === "positive" && input.valid && input.counted;
}

/**
 * reward_claim reaches Flagsmith only for valid AND counted swipes on a live deck (same gate as
 * answer_positive in WP3, via shouldSendToFlagsmith), and only when the deck runs on Flagsmith
 * (`onFlagsmith`: it has an experimentId; a local-split deck never sends events), and only when Flagsmith accepted
 * this swiper's exposure (`exposed`), so reward_claim covers the same population as answer_positive (which the
 * swipe path also sends only after an accepted exposure). Omitted means true.
 */
export function shouldSendClaimToFlagsmith(input: {
  valid: boolean;
  counted: boolean;
  deckLive: boolean;
  onFlagsmith?: boolean;
  exposed?: boolean;
}): boolean {
  return input.deckLive && input.onFlagsmith !== false && input.exposed !== false && shouldSendToFlagsmith(input);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Audio is deleted this many days after it was recorded. */
export function deleteAfterFor(recordedAt: Date): Date {
  return new Date(recordedAt.getTime() + AUDIO_RETENTION_DAYS * DAY_MS);
}

export function isAudioExpired(deleteAfter: Date | string | number | undefined, now: Date | number = Date.now()): boolean {
  if (deleteAfter === undefined) return false;
  const at = new Date(deleteAfter).getTime();
  const current = typeof now === "number" ? now : now.getTime();
  return Number.isFinite(at) && at <= current;
}

/**
 * The audio a founder may play: only with consent and only before deleteAfter. Every read path of
 * stored audio goes through this (the retention promise: 30 days).
 */
export function playableAudio(
  voice: { audioUrl?: string; founderCanPlay?: boolean; deleteAfter?: Date | string | number } | undefined,
  now: Date | number = Date.now(),
): string | undefined {
  if (!voice?.audioUrl || voice.founderCanPlay !== true) return undefined;
  return isAudioExpired(voice.deleteAfter, now) ? undefined : voice.audioUrl;
}

export function clampVoiceSeconds(seconds: unknown): number {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_VOICE_SECONDS, Math.round(n * 10) / 10);
}

export function cleanComment(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, MAX_COMMENT_CHARS);
  return trimmed || undefined;
}

/** "0:12" for a number of seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* Demo wallet. */

export const WITHDRAW_MIN_RS = 100;

export function roundRs(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function withdrawProgress(balanceRs: number): { fraction: number; remainingRs: number } {
  const remainingRs = Math.max(0, roundRs(WITHDRAW_MIN_RS - balanceRs));
  return { fraction: Math.min(1, Math.max(0, balanceRs / WITHDRAW_MIN_RS)), remainingRs };
}

export type WalletNote = "valid" | "unpaid" | "too_fast" | "not_counted";

/** Why a swipe earned what it did; the wallet history label. Unpaid decks and not-counted swipes earn nothing. */
export function walletNoteFor(input: { paid: boolean; valid: boolean; counted: boolean }): WalletNote {
  if (!input.valid) return "too_fast";
  if (!input.counted) return "not_counted";
  return input.paid ? "valid" : "unpaid";
}

export function walletNoteLabel(note: string, swipeCount = 1): string {
  switch (note) {
    case "valid":
      return `${swipeCount} valid swipe${swipeCount === 1 ? "" : "s"}`;
    case "unpaid":
      return "Unpaid card";
    case "too_fast":
      return "Too fast to count";
    case "not_counted":
      return "Not counted yet";
    default:
      return note;
  }
}

/** Swipers are in India: "today" for earnings runs from midnight India time (UTC+5:30), whatever the server clock. */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function startOfDayIst(now: number): number {
  return Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export function relativeDay(at: Date | string | number, now: Date | number = Date.now()): string {
  const t = new Date(at).getTime();
  const current = typeof now === "number" ? now : now.getTime();
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOfDay(current) - startOfDay(t)) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export interface WalletEntryView {
  id: string;
  title: string;
  /** "1 valid swipe · today". */
  detail: string;
  amountRs: number;
}

export interface WalletView {
  label: "Demo earnings";
  balanceRs: number;
  weeklyRs: number;
  weeklyValidSwipes: number;
  /** Credited today (India time), computed from the wallet entries. */
  todayRs: number;
  /** Valid, counted, paid swipes today, computed from the wallet entries. */
  todayValidSwipes: number;
  entries: WalletEntryView[];
  qualityScore?: number;
  counting: boolean;
  demo: boolean;
}
