/** Feed ordering and eligibility (spec/03 §5.2 "Swipe feed"). Pure; pass `rng` to make it testable. */
import type { Industry } from "@/shared/lib/lists";
import { STARTER_FEED_WEIGHT } from "./starter";
import { isTargetUser } from "./target";
import type { SwipeDeck, SwiperProfile } from "./types";

export type Rng = () => number;

/** Fisher-Yates, returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Can this swiper be shown this deck in the feed?
 * - Product audience "target users only": the swiper's role must be in the target roles.
 * - Audience states / interests (when set): the swiper's declared state / interests must match.
 * - Home screen "Show me ideas for": when chips are selected the product industry must be one of them.
 * Link visitors skip this (they follow the founder's link).
 */
export function isEligibleForFeed(
  deck: Pick<SwipeDeck, "product">,
  swiper: Pick<SwiperProfile, "role" | "state" | "interests">,
  chosenInterests: readonly Industry[] = [],
): boolean {
  const { audience, targetUsers, industry } = deck.product;
  if (chosenInterests.length > 0 && !chosenInterests.includes(industry)) return false;
  if (audience.who === "targetOnly" && !isTargetUser(swiper.role, targetUsers)) return false;
  if (audience.states.length > 0 && (!swiper.state || !audience.states.includes(swiper.state))) return false;
  if (audience.interests.length > 0 && !swiper.interests.some((i) => audience.interests.includes(i))) return false;
  return true;
}

/**
 * How likely the feed is to pick this deck next, relative to other decks (rules, no model):
 * - x2 when the swiper's role is one of the product's target users (their answer is the one the founder needs);
 * - x1.5 when the product's industry is one of the swiper's interests;
 * - x0.25 for a starter deck from `npm run seed:feed`, so founders' decks get most of the traffic.
 * It only chooses WHICH deck a swiper sees. Which version of that deck they see is Flagsmith's call (or the local
 * split), never this. Every eligible deck keeps a chance, so no deck is starved.
 */
export function feedWeight(
  deck: Pick<SwipeDeck, "product" | "starter">,
  swiper: Pick<SwiperProfile, "role" | "interests">,
): number {
  let w = deck.starter ? STARTER_FEED_WEIGHT : 1;
  if (isTargetUser(swiper.role, deck.product.targetUsers)) w *= 2;
  if (swiper.interests.includes(deck.product.industry)) w *= 1.5;
  return w;
}

/**
 * Pick the next deck: the link deck first (if given and not yet seen), otherwise a random deck among those not yet
 * seen, uniformly or in proportion to `weight` (see feedWeight). Each deck is shown once, so `seen` decks never return.
 */
export function pickNextDeck<T extends { id: string }>(input: {
  decks: readonly T[];
  seenDeckIds: ReadonlySet<string>;
  firstDeckId?: string;
  rng?: Rng;
  weight?: (deck: T) => number;
}): T | null {
  const unseen = input.decks.filter((d) => !input.seenDeckIds.has(d.id));
  if (input.firstDeckId) {
    const first = unseen.find((d) => d.id === input.firstDeckId);
    if (first) return first;
  }
  if (unseen.length === 0) return null;
  const rng = input.rng ?? Math.random;
  if (!input.weight) return unseen[Math.floor(rng() * unseen.length)] ?? null;
  const weights = unseen.map((d) => {
    const w = input.weight!(d);
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return unseen[Math.floor(rng() * unseen.length)] ?? null;
  let r = rng() * total;
  for (let i = 0; i < unseen.length; i++) {
    r -= weights[i];
    if (r < 0) return unseen[i];
  }
  return unseen[unseen.length - 1];
}
