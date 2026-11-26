/**
 * Swipe validity rules (spec/04 §5.4, §5.8, §5.9). Pure.
 *
 * - The answer buttons are locked for the first 2 s (ANSWER_LOCK_MS).
 * - A swipe is valid when the card was on screen for at least 2 s.
 * - Answers faster than 300 ms (INTERACTION_FLOOR_MS) are ignored: not stored at all.
 * - Only valid AND counted swipes reach Flagsmith; only valid, counted feed swipes on paid cards pay.
 */
import type { SwipeSource } from "./types";

export const MIN_READ_MS = 2000;
export const ANSWER_LOCK_MS = 2000;
export const INTERACTION_FLOOR_MS = 300;
export const PAID_RATE_RS = 0.25;

/**
 * Dwell is computed by the server from the signed servedAt only; the browser's own dwellMs is never used.
 * Callers have already verified the token (not in the future, not older than its max age).
 */
export function serverDwellMs(input: { servedAt: number; now: number }): number {
  return Math.max(0, Math.round(input.now - input.servedAt));
}

export interface SwipeEvaluation {
  /** Under the 300 ms floor: do not store. */
  ignored: boolean;
  /** Card on screen at least 2 s and past the floor. */
  valid: boolean;
}

export function evaluateSwipe(dwellMs: number): SwipeEvaluation {
  if (dwellMs < INTERACTION_FLOOR_MS) return { ignored: true, valid: false };
  return { ignored: false, valid: dwellMs >= MIN_READ_MS };
}

/**
 * Whether a swipe counts in results. The source is decided by the server (signed into the served token),
 * never by the browser.
 *  - A signed-in swiper (not a guest) always follows their quality flag (70+), whatever the source.
 *  - A guest on a personal link skips the quality check (their valid swipes count, tagged "Your link
 *    (not verified)", never paid); a guest on the feed follows the guest profile (not counting in production).
 */
export function decideCounted(input: {
  valid: boolean;
  source: SwipeSource;
  swiperCounting: boolean;
  guest?: boolean;
}): boolean {
  if (!input.valid) return false;
  if (input.guest === false) return input.swiperCounting;
  return input.source === "link" ? true : input.swiperCounting;
}

/** Only valid AND counted swipes are sent to Flagsmith. */
export function shouldSendToFlagsmith(input: { valid: boolean; counted: boolean }): boolean {
  return input.valid && input.counted;
}

/** A deck is paid while it has boost budget left (Boost, spec/01) and the paid_swiping kill switch is on. */
export function isPaidDeck(input: { boost: { budget: number; spent: number }; paidSwipingFlag: boolean }): boolean {
  return input.paidSwipingFlag && input.boost.budget - input.boost.spent > 0;
}

/** Link visitors are never paid. */
export function isPaidCard(input: {
  source: SwipeSource;
  boost: { budget: number; spent: number };
  paidSwipingFlag: boolean;
}): boolean {
  return input.source === "feed" && isPaidDeck(input);
}

export function earningsFor(input: { paid: boolean; valid: boolean; counted: boolean }): number {
  return input.paid && input.valid && input.counted ? PAID_RATE_RS : 0;
}
