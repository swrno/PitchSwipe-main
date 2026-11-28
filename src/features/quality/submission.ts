import { getLibraryCard } from "./cards";
import { deckShape, type PracticeMode } from "./deck";
import type { Answer, ScoredSwipe } from "./rules";

export interface SubmittedSwipe {
  cardId: string;
  answer: Answer;
  dwellMs: number;
}

export type SubmissionCheck = { ok: true; swipes: ScoredSwipe[] } | { ok: false; error: string };

/** Longest dwell kept; anything above is clamped (a tab left open is not 40 minutes of reading). */
export const MAX_DWELL_MS = 120_000;

/**
 * Validates a submitted practice run against the server-side library and attaches the answer key to
 * check cards. The browser never sees `expected`, so a client cannot choose which cards count as checks.
 */
export function prepareSubmission(mode: PracticeMode, body: unknown): SubmissionCheck {
  if (!Array.isArray(body)) return { ok: false, error: "Send the list of swipes." };
  const shape = deckShape(mode);
  if (body.length !== shape.size) return { ok: false, error: `Expected ${shape.size} swipes.` };

  const swipes: ScoredSwipe[] = [];
  const counts = new Map<string, number>();
  for (const raw of body) {
    const s = raw as Partial<SubmittedSwipe> | null;
    if (!s || typeof s.cardId !== "string") return { ok: false, error: "Each swipe needs a cardId." };
    if (s.answer !== "yes" && s.answer !== "no") return { ok: false, error: "Answers are yes or no." };
    if (typeof s.dwellMs !== "number" || !Number.isFinite(s.dwellMs) || s.dwellMs < 0) {
      return { ok: false, error: "Each swipe needs a reading time." };
    }
    const lib = getLibraryCard(s.cardId);
    if (!lib) return { ok: false, error: "Unknown card." };
    const n = (counts.get(s.cardId) ?? 0) + 1;
    counts.set(s.cardId, n);
    if (n > (lib.expected ? 1 : 2)) return { ok: false, error: "A card repeats too often." };
    swipes.push({
      cardId: s.cardId,
      answer: s.answer,
      dwellMs: Math.min(Math.round(s.dwellMs), MAX_DWELL_MS),
      expected: lib.expected,
    });
  }

  const checks = swipes.filter((s) => s.expected).length;
  const repeats = [...counts.entries()].filter(([id, n]) => n === 2 && !getLibraryCard(id)?.expected).length;
  if (checks !== shape.checks || repeats !== shape.repeats) {
    return { ok: false, error: "That is not a practice set we issued." };
  }
  return { ok: true, swipes };
}
