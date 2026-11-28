/**
 * Every-swipe CSV and waitlist CSV. Pure.
 *
 * Every-swipe privacy rules: no name, email, IP or person id column; free-text comments are
 * scrubbed of anything that looks like an email or IP address; the time is cut to the minute;
 * and state, source and interest groups under 10 swipers (per deck) are grouped as "Other",
 * the same rule as on screen.
 */
import { LIMITS } from "@/shared/lib/limits";

import { toCsv } from "./csv";
import { minuteIso, stampLabel } from "./stamp";
import type { ExportClaimant, ExportDeckData, ExportSwipe } from "./types";

const OTHER = LIMITS.otherLabel;
const MIN = LIMITS.groupMinSize;

const EMAIL_RE = /[^\s@<>()"',;:]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+/g;
const IPV4_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6_RE = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
/** A run of 7 or more digits, allowing spaces, dots, dashes and brackets between them (phone numbers). */
const PHONE_RE = /\+?\d(?:[\s().-]?\d){6,}/g;
const HANDLE_RE = /(^|[\s(])@\w{2,}/g;

/** A comment is the swiper's own words; strip anything that could identify them directly. */
export function scrubComment(text: string): string {
  return text
    .replace(EMAIL_RE, "[removed]")
    .replace(IPV4_RE, "[removed]")
    .replace(IPV6_RE, "[removed]")
    .replace(URL_RE, "[removed]")
    .replace(PHONE_RE, "[removed]")
    .replace(HANDLE_RE, "$1[removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * Maps each value of a single-valued split (state, source) to itself or to "Other".
 * Values under 10 swipers, and swipes with no value, go to Other. When Other would itself be
 * under 10, the smallest shown group joins it, so subtracting from the total cannot reveal a group.
 */
export function otherMap(values: readonly (string | null)[]): Map<string, string> {
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const v of values) {
    if (v === null || v === "") unknown += 1;
    else counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const hidden = new Set<string>();
  let otherTotal = unknown;
  for (const [v, n] of counts) {
    if (n < MIN) {
      hidden.add(v);
      otherTotal += n;
    }
  }
  if (otherTotal > 0 && otherTotal < MIN) {
    const shown = [...counts].filter(([v]) => !hidden.has(v)).sort((a, b) => a[1] - b[1]);
    if (shown.length > 0) hidden.add(shown[0][0]);
  }
  const map = new Map<string, string>();
  for (const v of counts.keys()) map.set(v, hidden.has(v) ? OTHER : v);
  return map;
}

/** Interests overlap (one person, several interests), so each is hidden on its own count. */
export function otherInterests(swipes: readonly ExportSwipe[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const s of swipes) for (const i of new Set(s.interests)) counts.set(i, (counts.get(i) ?? 0) + 1);
  return new Map([...counts].map(([i, n]) => [i, n < MIN ? OTHER : i]));
}

export const SWIPE_HEADER = ["deck", "time_utc", "version", "answer", "comment", "state", "source", "interest", "numbers_as_of"] as const;

const SOURCE_LABEL: Record<string, string> = { feed: "Swipe feed", link: "Your link" };

export function swipeRows(deck: ExportDeckData): string[][] {
  const swipes = deck.swipes;
  const state = otherMap(swipes.map((s) => s.region));
  const source = otherMap(swipes.map((s) => s.source));
  const interest = otherInterests(swipes);
  return [...swipes]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((s) => {
      const interests = [...new Set(s.interests.map((i) => interest.get(i) ?? OTHER))].sort();
      return [
        deck.payload.deck.label,
        minuteIso(s.at),
        s.cardLabel,
        s.answer,
        scrubComment(s.comment),
        s.region ? (state.get(s.region) ?? OTHER) : OTHER,
        SOURCE_LABEL[source.get(s.source) ?? OTHER] ?? OTHER,
        interests.join("; "),
      ];
    });
}

export function swipesCsv(decks: readonly ExportDeckData[], now: Date): string {
  const stamp = stampLabel(now);
  const rows = decks.flatMap((d) => swipeRows(d).map((r) => [...r, stamp]));
  return toCsv([[...SWIPE_HEADER], ...rows]);
}

export const WAITLIST_HEADER = ["deck", "email", "version", "claimed_at_utc", "numbers_as_of"] as const;

/** The waitlist: people who explicitly tapped to claim the reward. Nothing else is exported. */
export function waitlistCsv(decks: readonly ExportDeckData[], now: Date): string {
  const stamp = stampLabel(now);
  const byTime = (a: ExportClaimant, b: ExportClaimant) => b.claimedAt.getTime() - a.claimedAt.getTime();
  const rows = decks.flatMap((d) =>
    [...d.claimants].sort(byTime).map((c) => [d.payload.deck.label, c.email, c.cardLabel, c.claimedAt.toISOString(), stamp]),
  );
  return toCsv([[...WAITLIST_HEADER], ...rows]);
}
