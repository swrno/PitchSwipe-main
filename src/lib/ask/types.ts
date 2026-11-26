/**
 * Shapes for "Ask your results" (WP13, spec 05 section 6.7). Client-safe: aggregates and comment
 * text only, never names, raw IPs, emails or audio URLs.
 */
import type { FlagsmithExperimentResults } from "@/types";
import type { ResultsPayload } from "@/lib/results/types";

/** The model's component spec: it points at a tool result, code fills every number. */
export interface ComponentSpec {
  component: string;
  /** Tool step id, e.g. "get_segments#1". */
  source?: string;
  /** Row label or card key to emphasise. */
  highlight?: string;
  /** commentQuotes: comment ids from the get_comments result. */
  pick?: string[];
  /** insightCard: wording with {fact.key} placeholders. */
  text?: string;
}

export const COMPONENT_NAMES = [
  "statRow",
  "barList",
  "demandCurve",
  "commentQuotes",
  "insightCard",
  "deckDraft",
  "reviewAndShip",
] as const;
export type ComponentName = (typeof COMPONENT_NAMES)[number];

export interface BarRow {
  label: string;
  /** "22%" */
  valueText: string;
  /** "9 of 41" */
  countText: string;
  /** 0 to 1, bar width. */
  fraction: number;
  highlight: boolean;
}

export type RenderedComponent =
  | { kind: "statRow"; items: { label: string; value: string }[] }
  | { kind: "barList"; title: string; subtitle: string; rows: BarRow[]; footnote: string | null }
  | { kind: "commentQuotes"; quotes: { id: string; text: string; meta: string; voice: boolean }[] }
  | { kind: "insightCard"; tag: string; tagLabel: string; text: string; sourceLine: string }
  | { kind: "deckDraft"; title: string; chips: string[]; published: false }
  | { kind: "reviewAndShip"; deckId: string; label: string; text: string };

export interface ChatStep {
  id: string;
  tool: string;
  /** "Looked up results by state" */
  summary: string;
  /** get_segments(deck="voice-khata-headline", by="state") */
  call: string;
  ok: boolean;
}

export interface AskAnswer {
  text: string;
  steps: ChatStep[];
  components: RenderedComponent[];
  /** Things code hid or fixed, in plain words. Shown small under the answer. */
  notes: string[];
  provider: string;
  model: string;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AskRequest {
  question: string;
  history?: HistoryTurn[];
}

export interface CommentRow {
  id: string;
  cardKey: string;
  cardLabel: string;
  text: string;
  kind: "typed" | "voice";
  /** Voice notes: spoken language, "Hindi". */
  language?: string;
  seconds?: number;
  state?: string;
  role?: string;
}

export interface DeckInContext {
  id: string;
  label: string;
  payload: ResultsPayload;
}

/** Everything the tools read. Built per request for one owner; tools can reach only these decks. */
export interface AskToolCtx {
  currentDeckId: string;
  productName: string;
  decks: Record<string, DeckInContext>;
  comments(deckId: string): Promise<CommentRow[]>;
  experiment(deckId: string): Promise<FlagsmithExperimentResults | null>;
}
