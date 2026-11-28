/**
 * Shapes for the product insights page (WP15, spec 05 section 6.3). Client-safe: aggregates and short
 * text only, never names, emails, raw IPs or audio URLs.
 */
import type { SaidYesVsActed } from "@/features/results/types";
import type { DeckStatus } from "@/types";

/** What the builder needs to know about one deck. Numbers are real counts; the builder never invents any. */
export interface DeckFacts {
  id: string;
  /** 1-based position on the page ("Deck 3"). */
  index: number;
  /** "Headline", "Price", "Launch reward". */
  label: string;
  /** "headline", "price", "product screens": used in "before you lock a price". */
  noun: string;
  variable: string;
  status: DeckStatus;
  /** Flagsmith said "decided", or the founder already approved the winner. */
  finished: boolean;
  swipers: number;
  saidYes: number;
  joined: number;
  waitlist: number;
  comments: number;
  /** Text of the winning (or leading) card: "Stop chasing payments.", "Rs 199 / mo". */
  leaderText: string | null;
  /** Flagsmith chance the leader is best, 0 to 100, as reported. */
  leaderChancePct: number | null;
  /** Per card, as Flagsmith reports it (chance 0 to 100). Empty until Flagsmith has data. */
  cards: { id: string; chancePct: number; identities: number }[];
  srmWarning: boolean;
  /** Swipers whose role is in the target list (a segment). Null when unknown. */
  targetSwipers: number | null;
  /** Best state group by join rate, with its size (a segment). */
  topState: { label: string; swipers: number; joined: number } | null;
}

export type RowTone = "won" | "leading" | "muted";

export interface WinnerRow {
  deckId: string;
  index: number;
  label: string;
  text: string;
  /** Product UI decks show three screen tiles under the title. */
  screens: boolean;
  /** "Won · 96% sure", "Leading · 88% sure", "Too close to call", "Collecting data". */
  statusText: string;
  tone: RowTone;
  chancePct: number | null;
}

export type InsightTag = "Result" | "Lead";

export interface InsightCardView {
  id: string;
  tag: InsightTag;
  /** "Result" or "Lead · confirm with a test". */
  tagLabel: string;
  title: string;
  body: string;
  /** "Decks 1 and 2 · 438 swipers · Flagsmith: 96% and 95% chance best · 41 comments". */
  sourceLine: string;
  /** True when the model wrote the words; false when code's template did (model off or its text failed the check). */
  worded: "model" | "template";
}

export interface ThemeRow {
  label: string;
  count: number;
  /** "3 of 7 comments". */
  countText: string;
}

export interface ThemeGroup {
  deckId: string;
  deckLabel: string;
  commentTotal: number;
  themes: ThemeRow[];
}

/** Persona pre-test: always Simulated and Unproven, never counted, never mixed with real counts. */
export interface PersonaInput {
  personasPerCard: number;
  totalPersonas: number;
  picks: { key: string; count: number }[];
  /** Finished real decks where the AI pick matched the real winner. */
  right: number;
  finished: number;
}

export interface PersonaCardView {
  tags: ["Simulated", "Unproven"];
  title: string;
  text: string;
  trackRecord: string;
  footnote: string;
}

export interface SuggestionView {
  /** "SUGGESTED NEXT TEST" body: "Description: ..." */
  text: string;
  variable: string;
  /** Opens the New deck screen for this product. Pre-fill is the founder's call; nothing is created. */
  href: string;
}

export interface InsightsPayload {
  productId: string;
  productName: string;
  productIcon: string;
  accent: "green" | "blue" | "purple";
  /** A deck of this product to anchor Download results and Ask about results. Null when no deck has run. */
  anchorDeckId: string | null;
  deckCount: number;
  /** Distinct people when known (a swiper can answer several decks), otherwise the sum of the decks' counted swipes. */
  swipers: number;
  /** True when `swipers` counts distinct people, false when it is a sum of swipes across decks. */
  swipersAreDistinct: boolean;
  waitlist: number;
  /** Decks with a clear winner (passed the Flagsmith rules). */
  winnerCount: number;
  winners: WinnerRow[];
  insights: InsightCardView[];
  saidYesVsActed: SaidYesVsActed | null;
  themes: ThemeGroup[];
  persona: PersonaCardView | null;
  suggestion: SuggestionView | null;
  /** Things code hid, in plain words. */
  notes: string[];
  provider: string;
  generatedAt: string;
}
