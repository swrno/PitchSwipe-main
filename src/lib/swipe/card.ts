/**
 * Turning a stored deck + the one assigned card into what the swipe screen renders. Pure.
 * Cards hold only the field under test; everything else comes from the deck's locked fields.
 */
import type { SwipeCardRow, SwipeDeck, SwipeLanguageValue, SwipeLogo, SwipeSource, CardView } from "./types";

const LANG_TAGS: Record<string, string> = { English: "en", Hindi: "hi", Bengali: "bn" };

export function isLanguageValue(value: unknown): value is SwipeLanguageValue {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.language === "string" && typeof v.headline === "string" && typeof v.question === "string";
}

function isLogo(value: unknown): value is SwipeLogo {
  return typeof value === "object" && value !== null && typeof (value as SwipeLogo).src === "string";
}

const asText = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** "Speak your sales. The ledger writes itself." -> two lines; the second gets the green underline. */
export function splitHeadline(headline: string): [string, string | null] {
  const match = /^(.+?[.!?।])\s+(.+)$/u.exec(headline.trim());
  return match ? [match[1], match[2]] : [headline.trim(), null];
}

/** "Rs 299 / mo" -> { amount: "Rs 299", unit: "/ mo" }; "2% per load" -> { "2%", "per load" }. */
export function splitPrice(price: string): { amount: string; unit: string | null } {
  const text = price.trim();
  const match = /^(.+?)\s*(\/\s*\S+|per\s+\S+(?:\s+\S+)?)$/iu.exec(text);
  return match ? { amount: match[1].trim(), unit: match[2].trim() } : { amount: text, unit: null };
}

/**
 * Match the value Flagsmith served for this identity to one of the deck's cards.
 * Accepts the card's text value, its JSON, its variant key or (language decks) the language name.
 */
export function matchCard(cards: readonly SwipeCardRow[], served: unknown): SwipeCardRow | undefined {
  if (served === null || served === undefined || served === "") return undefined;
  const asJson = typeof served === "string" ? served : JSON.stringify(served);
  return cards.find((card) => {
    const value = card.value;
    if (typeof value === "string" && value === served) return true;
    if (JSON.stringify(value) === asJson) return true;
    if (card.variantKey === served) return true;
    return isLanguageValue(value) && (value.language === served || value.headline === served);
  });
}

/** Flagsmith's key for the control arm: the flag's own value, i.e. cards[0] (features/constants.py CONTROL_VARIANT_KEY). */
export const CONTROL_VARIANT = "control";

/**
 * The card for the variant Flagsmith served: "control" is the control card (cards[0], control first),
 * any other value is the option key, which is the card's variant key (set at publish).
 */
export function cardForVariant(cards: readonly SwipeCardRow[], variant: string | null | undefined): SwipeCardRow | undefined {
  if (!variant) return undefined;
  if (variant === CONTROL_VARIANT) return cards[0];
  return cards.find((card) => card.variantKey === variant);
}

/** The `$flag_exposure` value for a shown card: "control" for cards[0], else its variant key. */
export function exposureVariant(cards: readonly SwipeCardRow[], card: SwipeCardRow): string {
  return cards[0]?.id === card.id ? CONTROL_VARIANT : card.variantKey;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Stable local assignment (demo mode, Flagsmith errors, and swipers who are not counted, who must
 * not be enrolled in the experiment). Same swiper + deck always gets the same card.
 */
export function localCard(cards: readonly SwipeCardRow[], deckId: string, swiperKey: string): SwipeCardRow {
  return cards[hash(`${deckId}:${swiperKey}`) % cards.length];
}

export interface ComposeContext {
  source: SwipeSource;
  paid: boolean;
  paidRs: number;
  counting: boolean;
}

export function composeCard(deck: SwipeDeck, card: SwipeCardRow, ctx: ComposeContext): CardView {
  const { shared, variable } = deck;
  const lang = variable === "language" && isLanguageValue(card.value) ? card.value : null;

  const headline = lang?.headline ?? (variable === "headline" ? asText(card.value) : shared.headline) ?? "";
  const description =
    lang?.description ?? (variable === "description" ? asText(card.value) : shared.description) ?? "";
  const reward = lang?.reward ?? (variable === "reward" ? asText(card.value) : shared.reward) ?? "";
  const priceText = variable === "price" ? asText(card.value) : shared.price;
  const screens =
    variable === "productUI" && Array.isArray(card.value)
      ? card.value.filter((v): v is string => typeof v === "string")
      : (shared.productUI ?? []);
  const logo = variable === "logo" ? (isLogo(card.value) ? card.value : undefined) : shared.logo;

  const language = lang?.language ?? "English";
  return {
    deckId: deck.id,
    slug: deck.slug,
    cardId: card.id,
    source: ctx.source,
    paid: ctx.paid,
    paidRs: ctx.paidRs,
    counting: ctx.counting,
    product: {
      name: deck.product.name,
      icon: deck.product.icon,
      category: deck.product.category,
      accent: deck.product.accent,
    },
    ownerName: deck.product.showOwnerName ? deck.product.ownerName : undefined,
    logo,
    headline,
    headlineLines: splitHeadline(headline),
    description,
    reward,
    price: priceText ? splitPrice(priceText) : null,
    screens,
    madeFor: deck.product.targetUsers,
    question: lang?.question ?? deck.question,
    positiveLabel: lang?.positiveLabel ?? deck.positiveLabel,
    negativeLabel: lang?.negativeLabel ?? deck.negativeLabel,
    language,
    lang: LANG_TAGS[language] ?? "en",
  };
}
