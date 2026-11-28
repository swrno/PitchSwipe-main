import { CHECK_CARDS, NORMAL_CARDS } from "./cards";
import { QUALITY } from "./rules";

export type PracticeMode = "initial" | "recheck";

export interface DeckShape {
  size: number;
  checks: number;
  repeats: number;
}

export function deckShape(mode: PracticeMode): DeckShape {
  return mode === "recheck"
    ? { size: QUALITY.recheckCards, checks: QUALITY.checkCards.recheck, repeats: QUALITY.repeatCards.recheck }
    : { size: QUALITY.practiceCards, checks: QUALITY.checkCards.initial, repeats: QUALITY.repeatCards.initial };
}

export function parseMode(value: unknown): PracticeMode {
  return value === "recheck" ? "recheck" : "initial";
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Minimum number of cards between a card and its repeat. */
export const REPEAT_GAP = 3;

/**
 * Card ids in showing order: distinct normal cards and check cards in random order, then each repeat
 * card (a card already shown) inserted at least REPEAT_GAP places after its first showing.
 */
export function buildDeck(mode: PracticeMode, rng: () => number = Math.random): string[] {
  const { size, checks, repeats } = deckShape(mode);
  const normalCount = size - checks - repeats;
  const normals = shuffle(NORMAL_CARDS, rng).slice(0, normalCount).map((c) => c.id);
  const checkIds = shuffle(CHECK_CARDS, rng).slice(0, checks).map((c) => c.id);
  const sequence = shuffle([...normals, ...checkIds], rng);

  const early = sequence
    .slice(0, Math.max(1, sequence.length - REPEAT_GAP - 1))
    .filter((id) => !id.startsWith("c-"));
  for (const id of shuffle(early, rng).slice(0, repeats)) {
    const first = sequence.indexOf(id);
    const min = first + REPEAT_GAP;
    const at = min + Math.floor(rng() * (sequence.length - min + 1));
    sequence.splice(at, 0, id);
  }
  return sequence;
}
