/** Card labels and the deck switcher text. Pure, client-safe. */
import { TEST_VARIABLE_LABELS, type TestVariable } from "@/lib/lists";
import { chancePercent, deckStatusView, type DeckStatusInput } from "@/lib/decks/status";
import { deckLabel } from "@/lib/decks/views";
import type { PriceMode } from "@/types";

import type { CardMeta } from "./leaderboard";

/** "Which X is winning" wording per test type. */
export const VARIABLE_NOUN: Record<TestVariable, string> = {
  headline: "headline",
  description: "description",
  reward: "reward",
  price: "price",
  productUI: "product screens",
  logo: "logo",
  language: "language",
};

/** "Headline test", "Launch reward test", "Product UI test". */
export function deckTitle(variable: TestVariable): string {
  return `${deckLabel(variable)} test`;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string") return o.name; // logo
    if (typeof o.headline === "string") return o.headline; // language version
    if (Array.isArray(value)) return `${value.length} screens`; // product UI
  }
  return "";
}

export interface CardSource {
  variantKey: string;
  value: unknown;
}

/** One entry per card, control (first) card first. Price level decks are labelled by their price. */
export function cardMetas(variable: TestVariable, priceMode: PriceMode | undefined, cards: readonly CardSource[]): CardMeta[] {
  return cards.map((c) => {
    const text = textOf(c.value);
    const byPrice = variable === "price" && priceMode === "level" && text !== "";
    return {
      key: c.variantKey,
      label: byPrice ? text : `${TEST_VARIABLE_LABELS[variable]} ${c.variantKey}`,
      valueText: text,
    };
  });
}

/**
 * Status line in the deck switcher: "Won · 95% sure", "Leading · 88% sure"; the deck on screen
 * says "chance best" instead, as in designs 22 and 24.
 */
export function switcherStatusText(deck: DeckStatusInput, current: boolean): string {
  const view = deckStatusView(deck);
  const base = view.label.split(" · ")[0];
  if (deck.chance === undefined || deck.status === "draft" || deck.status === "closed") return base;
  return `${base} · ${chancePercent(deck.chance)}% ${current ? "chance best" : "sure"}`;
}
