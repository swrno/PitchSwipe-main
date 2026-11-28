import type { TestVariable } from "@/shared/lib/lists";
import type { Deck, PriceMode } from "@/types";
import type { SharedFields } from "./fields";

export interface DeckCardInput {
  /** "A", "B", "C" (and "D" for a 4-price test). */
  variantKey: string;
  /** Only the field under test. */
  value: unknown;
}

/** What the New deck screen sends. */
export interface DeckInput {
  productId: string;
  variable: TestVariable;
  /** Price decks only. */
  priceMode?: PriceMode;
  cards: DeckCardInput[];
  /** Locked fields, identical on every card. Must not contain the tested field. */
  shared: SharedFields;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
}

export interface FieldError {
  /** Dot path, e.g. "cards.1.value" or "shared.price". */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldError[];
}

/** A stored deck with its cards. */
export interface DeckRecord extends Omit<Deck, "shared"> {
  shared: SharedFields;
  cards: DeckCardInput[];
}
