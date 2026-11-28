/**
 * Server-only loaders for the founder Results screens and GET /api/results/[deckId].
 *
 * Counted swipes from MongoDB, claims as the waitlist, Flagsmith results through the wrapper (never directly).
 *
 * Every read goes through the deck store, which is scoped to the owner, so a founder can
 * only ever load their own deck. Raw IPs are never selected; swiper emails are used only to
 * match a claim to a swipe and never leave this module.
 */
import { accentFor } from "@/features/decks/product";
import { getStore, type Store } from "@/features/decks/server/store";
import { deckStatusView } from "@/features/decks/status";
import type { DeckRecord } from "@/features/decks/types";
import type { Industry, State } from "@/shared/lib/lists";
import type { Answer, FlagsmithExperimentResults, ResponseSource } from "@/types";

import { aggregateSwipes, toSwipeRows, type DeckAggregates, type ResponseInput } from "../aggregate";
import { VARIABLE_NOUN, cardMetas, deckTitle, switcherStatusText } from "../cards";
import { buildVerdict, waitlistCsv, type CardMeta, type ClaimantInput } from "../leaderboard";
import { buildResultsPayload } from "../payload";
import type { DeckMeta, ResultsPayload, SwitcherView } from "../types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => String(v);

interface LoadedDeck {
  deck: DeckRecord;
  meta: DeckMeta;
  cards: CardMeta[];
  controlKey: string;
  reward: string | null;
  targetRoles: string[];
  productName: string;
}

async function loadDeck(store: Store, ownerId: string, deckId: string): Promise<LoadedDeck | null> {
  const deck = await store.getDeck(ownerId, deckId);
  if (!deck) return null;
  const product = await store.getProduct(ownerId, deck.productId);
  const cards = cardMetas(deck.variable, deck.priceMode, deck.cards);
  const stats = (await store.deckStats(ownerId, [deck._id]))[deck._id];
  const statusLabel = deckStatusView({ status: deck.status, chance: stats?.chance, shippedAt: deck.shippedAt }).label;
  const reward = typeof deck.shared.reward === "string" ? deck.shared.reward : null;
  return {
    deck,
    cards,
    controlKey: cards[0]?.key ?? "A",
    reward,
    targetRoles: product?.targetUsers ?? [],
    productName: product?.name ?? "",
    meta: {
      id: deck._id,
      productId: deck.productId,
      productName: product?.name ?? "",
      label: deckTitle(deck.variable),
      variable: deck.variable,
      noun: VARIABLE_NOUN[deck.variable],
      flagName: deck.flagName,
      status: deck.status,
      priceMode: deck.priceMode,
      statusLabel,
      ...(deck.status !== "draft" && !deck.experimentId ? { localSplitReason: deck.flagsmithError ?? "" } : {}),
    },
  };
}

/** Flagsmith results through the wrapper. Null when not configured, not started, or unreachable. */
async function loadFlagsmith(
  deck: DeckRecord,
  cardIds: Record<string, string>,
  controlKey: string,
): Promise<FlagsmithExperimentResults | null> {
  // A local-split deck (no experimentId, e.g. publish to Flagsmith failed) never gets a winner call.
  if (!deck.experimentId) return null;
  try {
    const flagsmith = await import("@/features/flagsmith");
    const out = await flagsmith.getExperimentResults(deck.experimentId, {
      flagName: deck.flagName,
      cardIds,
      controlKey,
      rewardMetricId: deck.rewardMetricId,
    });
    return out.results;
  } catch (error) {
    // Not configured is the normal state until WP6 env vars are set; anything else is worth a log line.
    if (!(error instanceof Error && error.name === "FlagsmithNotConfigured")) {
      console.error("results: could not read Flagsmith", error instanceof Error ? error.message : error);
    }
    return null;
  }
}

interface MongoData {
  aggregates: DeckAggregates;
  claimants: ClaimantInput[];
  cardIds: Record<string, string>;
}

/** Mongo helpers are imported lazily so this module loads without mongoose. */
async function mongo() {
  const [{ Types, isValidObjectId }, { connectDb }, models] = await Promise.all([
    import("mongoose"),
    import("@/shared/lib/db"),
    import("@/models"),
  ]);
  return { Types, isValidObjectId, connectDb, ...models };
}

async function cardIdMap(deckId: string): Promise<{ byId: Map<string, string>; byKey: Record<string, string> }> {
  const { Card } = await mongo();
  const rows = (await Card.find({ deckId }).select("variantKey").lean()) as unknown as Row[];
  const byId = new Map<string, string>();
  const byKey: Record<string, string> = {};
  for (const r of rows) {
    byId.set(str(r._id), str(r.variantKey));
    byKey[str(r.variantKey)] = str(r._id);
  }
  return { byId, byKey };
}

async function loadMongo(deckId: string, cards: CardMeta[]): Promise<MongoData> {
  const { Types, isValidObjectId, connectDb, Claim, Response, User } = await mongo();
  await connectDb();
  const { byId, byKey } = await cardIdMap(deckId);

  // Only counted swipes count; `ip` is never selected.
  const responses = (await Response.find({ deckId, counted: true, valid: true })
    .select("swiperId cardId source isTargetUser answer region valid counted")
    .lean()) as unknown as Row[];
  const claims = (await Claim.find({ deckId }).select("cardId email createdAt").lean()) as unknown as Row[];

  const swiperIds = [...new Set(responses.map((r) => str(r.swiperId)))].filter((id) => isValidObjectId(id));
  const users = swiperIds.length
    ? ((await User.find({ _id: { $in: swiperIds.map((i) => new Types.ObjectId(i)) } })
        .select("interests email")
        .lean()) as unknown as Row[])
    : [];
  const userById = new Map(users.map((u) => [str(u._id), u]));
  // A claim has no swiper id (spec/06 §8.2), so a swipe counts as "joined" when its swiper's
  // account email is one of the deck's claim emails.
  const claimEmails = new Set(claims.map((c) => str(c.email).toLowerCase()));

  const inputs: ResponseInput[] = responses.flatMap((r) => {
    const cardKey = byId.get(str(r.cardId));
    if (!cardKey) return [];
    const user = userById.get(str(r.swiperId));
    return [
      {
        cardKey,
        source: r.source as ResponseSource,
        isTargetUser: r.isTargetUser === true,
        answer: r.answer as Answer,
        region: r.region as State | undefined,
        interests: ((user?.interests as Industry[]) ?? []).slice(),
        joined: user ? claimEmails.has(str(user.email).toLowerCase()) : false,
        valid: r.valid === true,
        counted: r.counted === true,
      },
    ];
  });

  const claimants: ClaimantInput[] = claims.map((c) => ({
    email: str(c.email),
    cardKey: byId.get(str(c.cardId)) ?? str(c.cardId),
    createdAt: new Date(c.createdAt as Date),
  }));

  return {
    aggregates: aggregateSwipes(toSwipeRows(inputs), cards.map((c) => c.key)),
    claimants,
    cardIds: byKey,
  };
}

/** The whole Results payload for one deck, or null when the deck is not the caller's. */
export async function loadResults(ownerId: string, deckId: string, now: Date = new Date()): Promise<ResultsPayload | null> {
  const store = await getStore();
  const loaded = await loadDeck(store, ownerId, deckId);
  if (!loaded) return null;
  const { meta, cards, controlKey, reward, targetRoles } = loaded;

  const data = await loadMongo(deckId, cards);
  const aggregates: DeckAggregates = data.aggregates;
  const claimants: ClaimantInput[] = data.claimants;
  const flagsmith: FlagsmithExperimentResults | null = await loadFlagsmith(loaded.deck, data.cardIds, controlKey);

  return buildResultsPayload({
    deck: meta,
    cards,
    controlKey,
    aggregates,
    flagsmith,
    claimants,
    reward,
    targetRoles,
    now,
  });
}

/** Waitlist CSV for the deck owner: email, card, claimed time. Nothing else. */
export async function loadWaitlistCsv(ownerId: string, deckId: string): Promise<string | null> {
  const store = await getStore();
  const loaded = await loadDeck(store, ownerId, deckId);
  if (!loaded) return null;
  const { connectDb, Claim } = await mongo();
  await connectDb();
  const { byId } = await cardIdMap(deckId);
  const claims = (await Claim.find({ deckId }).select("cardId email createdAt").lean()) as unknown as Row[];
  return waitlistCsv(
    claims.map((c) => ({ email: str(c.email), cardKey: byId.get(str(c.cardId)) ?? str(c.cardId), createdAt: new Date(c.createdAt as Date) })),
    loaded.cards,
  );
}

/** Deck switcher: every deck of the product with its status and Flagsmith chance. */
export async function loadSwitcher(ownerId: string, deckId: string): Promise<SwitcherView | null> {
  const store = await getStore();
  const loaded = await loadDeck(store, ownerId, deckId);
  if (!loaded) return null;
  const product = await store.getProduct(ownerId, loaded.deck.productId);
  if (!product) return null;

  const siblings = (await store.listDecks(ownerId)).filter(
    (d) => d.productId === product.id && d.status !== "draft" && d.status !== "closed",
  );
  const stats = await store.deckStats(ownerId, siblings.map((d) => d._id));

  // The deck on screen uses the same verdict as its page (Flagsmith decision), so the two never disagree.
  const flagsmith = await loadFlagsmith(loaded.deck, (await cardIdMap(deckId)).byKey, loaded.controlKey);
  const verdict = buildVerdict(loaded.cards, loaded.controlKey, flagsmith);

  const items = siblings.map((d) => {
    const current = d._id === deckId;
    let input = { status: d.status, chance: stats[d._id]?.chance, shippedAt: d.shippedAt };
    if (current && verdict.chance !== null) {
      input = verdict.kind === "decided" ? { ...input, status: "decided", chance: verdict.chance } : { ...input, status: "live", chance: verdict.chance };
    }
    return { id: d._id, label: deckTitle(d.variable), statusText: switcherStatusText(input, current), current };
  });
  // A deck still in draft or archived can be opened by link; keep it in the list so the menu is never empty.
  if (!items.some((i) => i.current)) {
    items.unshift({ id: deckId, label: loaded.meta.label, statusText: loaded.meta.statusLabel, current: true });
  }

  return {
    productId: product.id,
    productName: product.name,
    productIcon: product.icon || product.name.slice(0, 1),
    accent: accentFor(product.name),
    currentId: deckId,
    currentLabel: loaded.meta.label,
    items,
  };
}
