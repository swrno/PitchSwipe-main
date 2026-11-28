/**
 * Swipe feed logic with injected dependencies, so the rules (one card per deck, random order,
 * validity, counted, "only valid AND counted reach Flagsmith") are unit-testable with fakes.
 * Server only. The default dependencies are built in server.ts.
 */
import { ANSWERS, type Answer } from "@/types";
import { INDUSTRIES, type Industry, type State } from "@/shared/lib/lists";
import { cardForVariant, composeCard, exposureVariant, localCard, matchCard } from "../card";
import { feedWeight, isEligibleForFeed, pickNextDeck, type Rng } from "../ordering";
import type { SwipeStore } from "./store";
import { isTargetUser } from "../target";
import type {
  NextCardResponse,
  SubmitInput,
  SubmitOutcome,
  SwipeCardRow,
  SwipeDeck,
  SwipeSource,
  SwiperProfile,
} from "../types";
import {
  PAID_RATE_RS,
  decideCounted,
  earningsFor,
  evaluateSwipe,
  isPaidCard,
  serverDwellMs,
  shouldSendToFlagsmith,
} from "../validity";
import { isValidGuid } from "../identity";
import {
  SERVED_TOKEN_MAX_AGE_MS,
  getSigningSecret,
  signServedToken,
  verifyServedToken,
} from "./token";

export { isValidGuid };

/** What Flagsmith served an identity for the deck flag. */
export interface AssignedVariant {
  /** "control" or the option key (= card variant key). Null when Flagsmith gave none. */
  variant: string | null;
  /** The flag value, used only when `variant` matches no card. */
  value?: unknown;
}

export interface SwipeDeps {
  store: SwipeStore;
  /**
   * The variant Flagsmith serves this swiper for the deck's flag. Only called for decks with an experimentId.
   * Throws / returns null when unavailable.
   */
  assign(deck: SwipeDeck, swiperKey: string, source: SwipeSource): Promise<AssignedVariant | null>;
  /**
   * Sends `$flag_exposure` (value = "control" or the card's variant key). Called at the same gate as the
   * conversions (valid AND counted, live deck with an experimentId), so exposures and conversions count the
   * same population (spec 06: invalid swipes never reach Flagsmith).
   */
  trackExposure(input: { deck: SwipeDeck; swiperKey: string; source: SwipeSource; variant: string }): Promise<void>;
  /** Sends answer_positive to Flagsmith. Only ever called for valid AND counted swipes. */
  trackAnswerPositive(input: { deck: SwipeDeck; swiperKey: string; source: SwipeSource }): Promise<void>;
  /** Platform flag paid_swiping (kill switch for payouts). */
  paidSwiping(): Promise<boolean>;
  now(): number;
  rng?: Rng;
  /** HMAC secret for served-card tokens. Defaults to env SWIPE_SIGNING_SECRET (see token.ts). */
  secret?: string;
}

export interface NextCardInput {
  swiper: SwiperProfile;
  /** Personal link deck, shown first when not yet seen. */
  firstSlug?: string;
  /** Home screen "Show me ideas for" chips. */
  interests: Industry[];
  /** Deck ids already answered in this browser session (the store is the authority). */
  seen: string[];
}

function pickCard(deck: SwipeDeck): SwipeCardRow | undefined {
  // Decided or shipped decks show only the winner (spec/06 lifecycle 6).
  return deck.cards.find((c) => c.id === deck.winnerCardId) ?? deck.cards[0];
}

export async function nextCard(deps: SwipeDeps, input: NextCardInput): Promise<NextCardResponse> {
  const { store, now } = deps;
  const servedAt = now();
  const { swiper } = input;
  const secret = deps.secret ?? getSigningSecret(); // throws ServiceUnavailableError in production without a secret

  const first = input.firstSlug ? await store.getDeckBySlug(input.firstSlug) : null;
  const feed = (await store.listFeedDecks()).filter(
    (d) => d.cards.length > 0 && isEligibleForFeed(d, swiper, input.interests),
  );
  const pool = first && first.cards.length > 0 ? [first, ...feed.filter((d) => d.id !== first.id)] : feed;

  const seenIds = new Set<string>(input.seen);
  await Promise.all(
    pool.map(async (d) => {
      if (!seenIds.has(d.id) && (await store.hasResponded(d.id, swiper.key))) seenIds.add(d.id);
    }),
  );

  const deck = pickNextDeck({
    decks: pool,
    seenDeckIds: seenIds,
    firstDeckId: first?.id,
    rng: deps.rng,
    weight: (d) => feedWeight(d, swiper),
  });
  if (!deck) return { card: null, servedAt, reason: "empty" };

  const source: SwipeSource = first && deck.id === first.id ? "link" : "feed";
  let card: SwipeCardRow | undefined;
  if (deck.status !== "live") {
    card = pickCard(deck);
  } else if (!deck.experimentId || (source === "feed" && !swiper.counting)) {
    // Local split: the deck is not running on Flagsmith, or the swiper is not counted (never enrolled).
    // No Flagsmith identity call for either.
    card = localCard(deck.cards, deck.id, swiper.key);
  } else {
    try {
      const assigned = await deps.assign(deck, swiper.key, source);
      card = cardForVariant(deck.cards, assigned?.variant) ?? (assigned ? matchCard(deck.cards, assigned.value) : undefined);
    } catch {
      card = undefined; // Flagsmith unset or down: local fallback below
    }
    card ??= localCard(deck.cards, deck.id, swiper.key);
  }
  if (!card) return { card: null, servedAt, reason: "empty" };

  const paid = isPaidCard({ source, boost: deck.boost, paidSwipingFlag: await deps.paidSwiping() });
  return {
    card: composeCard(deck, card, { source, paid, paidRs: PAID_RATE_RS, counting: swiper.counting }),
    servedAt,
    token: signServedToken(secret, swiper.key, { deckId: deck.id, cardKey: card.id, servedAt, source }),
  };
}

export interface SubmitContext {
  swiper: SwiperProfile;
  /** State estimated from the request IP (never the IP itself). */
  region?: State;
}

export async function submitResponse(deps: SwipeDeps, input: SubmitInput, ctx: SubmitContext): Promise<SubmitOutcome> {
  const { store } = deps;
  const { swiper } = ctx;
  const now = deps.now();

  // The served token decides the card, the source and the clock. Nothing of these comes from the browser.
  const checked = verifyServedToken(deps.secret ?? getSigningSecret(), swiper.key, input.token, {
    now,
    maxAgeMs: SERVED_TOKEN_MAX_AGE_MS,
  });
  if (!checked.ok) {
    return { ok: false, status: 400, error: "This card is no longer valid. Load the next idea and try again." };
  }
  const { source, servedAt } = checked.claims;
  if (input.deckId !== checked.claims.deckId || input.cardId !== checked.claims.cardKey) {
    return { ok: false, status: 400, error: "That is not the card you were shown." };
  }

  const deck = await store.getDeckById(checked.claims.deckId);
  if (!deck) return { ok: false, status: 404, error: "Test not found." };
  const live = deck.status === "live";
  // Feed answers only on live decks; a link serves live, decided or shipped decks.
  if (source === "feed" ? !live || !deck.listedInFeed : deck.status === "draft" || deck.status === "closed") {
    return { ok: false, status: 404, error: "This test is not taking answers." };
  }
  const card = deck.cards.find((c) => c.id === checked.claims.cardKey);
  if (!card) return { ok: false, status: 400, error: "That card is not part of this test." };

  const dwellMs = serverDwellMs({ servedAt, now });
  const { ignored, valid } = evaluateSwipe(dwellMs);
  if (ignored) return { ok: false, ignored: true, reason: "too_fast" };

  const counted = decideCounted({ valid, source, swiperCounting: swiper.counting, guest: swiper.guest });
  const paid = isPaidCard({
    source,
    boost: deck.boost,
    paidSwipingFlag: await deps.paidSwiping(),
  });

  const saved = await store.saveResponse({
    deckId: deck.id,
    cardId: card.id,
    swiperKey: swiper.key,
    source,
    role: swiper.role, // role at swipe time
    isTargetUser: isTargetUser(swiper.role, deck.product.targetUsers),
    answer: input.answer,
    dwellMs,
    region: ctx.region,
    valid,
    counted,
    createdAt: new Date(now),
  });
  if (!saved.saved) return { ok: false, status: 409, error: "You already answered this test." };

  // The only path to Flagsmith: valid AND counted, on a live deck that runs on Flagsmith. The exposure goes for
  // every such answer (positive or negative), then answer_positive for positive ones: same population for both.
  let sentToFlagsmith = false;
  if (shouldSendToFlagsmith({ valid, counted }) && live && deck.experimentId) {
    let exposed = false;
    try {
      await deps.trackExposure({ deck, swiperKey: swiper.key, source, variant: exposureVariant(deck.cards, card) });
      exposed = true;
    } catch {
      exposed = false; // stored in Mongo; Flagsmith unset or down (no retry queue yet)
    }
    if (exposed) {
      // Persisted so the later reward_claim goes only for swipers Flagsmith has an exposure for.
      try {
        await store.markExposed?.(saved.id);
      } catch (error) {
        console.warn("swipe: could not record the accepted exposure", saved.id, error instanceof Error ? error.message : error);
      }
    }
    // A conversion without its exposure would count the swiper in no variant: send it only after the exposure.
    if (exposed && input.answer === "positive") {
      try {
        await deps.trackAnswerPositive({ deck, swiperKey: swiper.key, source });
        sentToFlagsmith = true;
      } catch {
        sentToFlagsmith = false;
      }
    }
  }

  return {
    ok: true,
    responseId: saved.id,
    valid,
    counted,
    paid,
    earnedRs: earningsFor({ paid, valid, counted }),
    sentToFlagsmith,
    source,
    deckId: deck.id,
    cardId: card.id,
    answer: input.answer,
    servedToken: input.token,
  };
}

/* Request parsing (pure). */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseSubmitBody(body: unknown): { value: SubmitInput; guid: string } | { error: string } {
  if (!isObject(body)) return { error: "Invalid request body." };
  if (!isValidGuid(body.swiperGuid)) return { error: "Missing swiper id." };
  if (typeof body.deckId !== "string" || !body.deckId) return { error: "Missing test." };
  if (typeof body.cardId !== "string" || !body.cardId) return { error: "Missing card." };
  if (!ANSWERS.includes(body.answer as Answer)) return { error: "Answer must be positive or negative." };
  if (typeof body.token !== "string" || !body.token || body.token.length > 600) return { error: "Missing card token." };
  // `source`, `dwellMs` and `servedAt` from the browser are ignored: the signed token decides them.
  return {
    guid: body.swiperGuid,
    value: {
      deckId: body.deckId,
      cardId: body.cardId,
      answer: body.answer as Answer,
      token: body.token,
    },
  };
}

export function parseNextBody(
  body: unknown,
): { guid: string; firstSlug?: string; interests: Industry[]; seen: string[] } | { error: string } {
  if (!isObject(body)) return { error: "Invalid request body." };
  if (!isValidGuid(body.swiperGuid)) return { error: "Missing swiper id." };
  const interests = Array.isArray(body.interests)
    ? body.interests.filter((i): i is Industry => typeof i === "string" && (INDUSTRIES as readonly string[]).includes(i))
    : [];
  const seen = Array.isArray(body.seen) ? body.seen.filter((s): s is string => typeof s === "string").slice(0, 500) : [];
  const firstSlug = typeof body.firstSlug === "string" && body.firstSlug ? body.firstSlug.slice(0, 120) : undefined;
  return { guid: body.swiperGuid, firstSlug, interests, seen };
}
