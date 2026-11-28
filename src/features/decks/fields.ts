/**
 * Field model for a deck (spec/02 §5.1 "One variable per test", spec/06 §8.2).
 *
 * A deck changes exactly ONE variable between cards. Everything else is a
 * "shared" (locked) field, identical on every card. These are pure data and
 * pure functions so server routes and the UI use the same rules.
 */
import type { AudienceWho, PriceMode } from "@/types";
import type { Industry, Role, State, TestVariable } from "@/shared/lib/lists";

/** Locked fields that live in `deck.shared`. */
export const SHARED_KEYS = ["headline", "description", "reward", "price", "productUI", "logo"] as const;
export type SharedKey = (typeof SHARED_KEYS)[number];

export interface LogoValue {
  name: string;
  /** Image data URL or URL; SVG or PNG, square. */
  src: string;
}

/**
 * Product settings copied onto the deck when it is published, so later product
 * edits only affect NEW decks ("Changes apply to new decks only", spec/02 §5.1).
 * Written by the server; never accepted from the browser.
 */
export interface ProductSnapshot {
  name: string;
  icon: string;
  category: string;
  industry: Industry;
  showOwnerName: boolean;
  targetUsers: Role[];
  audience: { who: AudienceWho; states: State[]; interests: Industry[] };
}

export interface SharedFields {
  headline?: string;
  description?: string;
  reward?: string;
  price?: string;
  /** Screenshots of the product, as image data URLs or URLs (up to 5). */
  productUI?: string[];
  /** Deck-level logo; absent means "use the product icon". */
  logo?: LogoValue;
  /** Server-written snapshot of the product at publish time. */
  product?: ProductSnapshot;
}

/** Card languages the Language test supports (spec/08 §13.2a). */
export const CARD_LANGUAGES = ["English", "Hindi", "Bengali"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

/** Card value for the Language test: the whole translated card. */
export interface LanguageValue {
  language: CardLanguage;
  headline: string;
  description: string;
  reward: string;
  question: string;
  positiveLabel: string;
  negativeLabel: string;
}

export const LANGUAGE_TEXT_KEYS = [
  "headline",
  "description",
  "reward",
  "question",
  "positiveLabel",
  "negativeLabel",
] as const;

/**
 * Shared keys that move onto the cards when a variable is tested. The Language
 * test translates headline, description and reward (question and answers are
 * translated on the card too), so those three are not shared.
 */
export const TESTED_SHARED_KEYS: Record<TestVariable, readonly SharedKey[]> = {
  headline: ["headline"],
  description: ["description"],
  reward: ["reward"],
  price: ["price"],
  productUI: ["productUI"],
  logo: ["logo"],
  language: ["headline", "description", "reward"],
};

/** Shared keys a deck of this variable must carry (and may carry). */
export function sharedKeysFor(variable: TestVariable): SharedKey[] {
  const tested = TESTED_SHARED_KEYS[variable];
  return SHARED_KEYS.filter((key) => !tested.includes(key));
}

/** Of those, the ones a publishable deck must have (product UI and logo are optional). */
export function requiredSharedKeysFor(variable: TestVariable): SharedKey[] {
  return sharedKeysFor(variable).filter((key) => key !== "productUI" && key !== "logo");
}

/** Whether question + answers are the same on every card (false for the Language test). */
export function questionIsShared(variable: TestVariable): boolean {
  return variable !== "language";
}

export interface CardCountRange {
  min: number;
  max: number;
}

/** 2 to 3 cards; a "find the best price" test may have 2 to 4 prices (spec §5.13). */
export function cardCountRange(variable: TestVariable, priceMode?: PriceMode): CardCountRange {
  if (variable === "price" && priceMode === "level") return { min: 2, max: 4 };
  if (variable === "language") return { min: 2, max: CARD_LANGUAGES.length };
  return { min: 2, max: 3 };
}

export const VARIANT_KEYS = ["A", "B", "C", "D"] as const;

export const FIELD_LABELS: Record<SharedKey | "question" | "answers", string> = {
  headline: "Headline",
  description: "Description",
  reward: "Launch reward",
  price: "Price",
  productUI: "Product UI",
  logo: "Logo",
  question: "Question",
  answers: "Answers",
};

export const LIMITS = {
  headline: 120,
  description: 300,
  reward: 80,
  price: 40,
  question: 120,
  label: 40,
  logoName: 30,
  productUiMax: 5,
  imageChars: 700_000,
} as const;
