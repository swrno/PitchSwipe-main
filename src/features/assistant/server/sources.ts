/**
 * Where the assistant reads decks and Flagsmith results (server only). Behind small
 * interfaces so the watcher and ship service can be tested with fakes.
 */
import { getStore } from "@/features/decks/server/store";
import { deckTitle, VARIABLE_NOUN, cardMetas } from "@/features/results/cards";
import type { FlagsmithExperimentResults } from "@/types";

import type { ResultsSnapshot, WatchedDeck } from "../types";

export interface DeckSource {
  /** Decks the watcher should check: live (or decided, not yet shipped). */
  listWatchable(): Promise<WatchedDeck[]>;
  /** One deck the caller owns, or null. */
  getForOwner(ownerId: string, deckId: string): Promise<WatchedDeck | null>;
  setStatus(ownerId: string, deckId: string, status: "live" | "decided" | "shipped" | "unshipped"): Promise<void>;
}

export interface ResultsSource {
  get(deck: WatchedDeck, opts?: { now?: Date }): Promise<ResultsSnapshot>;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => String(v);

async function ownerInfo(ownerId: string): Promise<{ name: string; email?: string }> {
  try {
    const { connectDb } = await import("@/shared/lib/db");
    const { User } = await import("@/models");
    await connectDb();
    const u = (await User.findById(ownerId).select("name email").lean()) as unknown as Row | null;
    return { name: u?.name ? str(u.name) : "You", email: u?.email ? str(u.email) : undefined };
  } catch {
    return { name: "You" };
  }
}

async function mongoCardIds(deckId: string): Promise<Record<string, string>> {
  const { connectDb } = await import("@/shared/lib/db");
  const { Card } = await import("@/models");
  await connectDb();
  const rows = (await Card.find({ deckId }).select("variantKey").lean()) as unknown as Row[];
  return Object.fromEntries(rows.map((r) => [str(r.variantKey), str(r._id)]));
}

async function build(ownerId: string, deckId: string): Promise<WatchedDeck | null> {
  const store = await getStore();
  const deck = await store.getDeck(ownerId, deckId);
  if (!deck) return null;
  const product = await store.getProduct(ownerId, deck.productId);
  const stats = (await store.deckStats(ownerId, [deck._id]))[deck._id];
  const owner = await ownerInfo(ownerId);
  const metas = cardMetas(deck.variable, deck.priceMode, deck.cards);
  const ids = await mongoCardIds(deck._id);
  return {
    deckId: deck._id,
    ownerId,
    ownerEmail: owner.email,
    ownerName: owner.name,
    productName: product?.name ?? "",
    title: deckTitle(deck.variable),
    noun: VARIABLE_NOUN[deck.variable],
    flagName: deck.flagName,
    experimentId: deck.experimentId,
    optionIds: deck.optionIds,
    rewardMetricId: deck.rewardMetricId,
    controlKey: metas[0]?.key ?? "A",
    cards: metas.map((m) => ({ key: m.key, cardId: ids[m.key] ?? `card-${deck._id}-${m.key}`, text: m.valueText })),
    waitlist: stats?.waitlist ?? 0,
  };
}

export function createDeckSource(): DeckSource {
  return {
    async listWatchable() {
      const { connectDb } = await import("@/shared/lib/db");
      const { Deck } = await import("@/models");
      await connectDb();
      const rows = (await Deck.find({ status: { $in: ["live", "decided"] }, shippedAt: null })
        .select("_id ownerId")
        .lean()) as unknown as Row[];
      const out: WatchedDeck[] = [];
      for (const r of rows) {
        const w = await build(str(r.ownerId), str(r._id));
        if (w?.experimentId) out.push(w);
      }
      return out;
    },
    getForOwner: build,
    async setStatus(ownerId, deckId, status) {
      const store = await getStore();
      const now = new Date();
      if (status === "shipped") {
        await store.updateDeck(ownerId, deckId, { status: "shipped", shippedAt: now, decidedAt: now });
      } else if (status === "decided") {
        await store.updateDeck(ownerId, deckId, { status: "decided", decidedAt: now });
      } else if (status === "unshipped") {
        // Undo: the experiment stays completed, the flag is back, the deck is no longer "Won".
        await store.updateDeck(ownerId, deckId, { status: "decided", shippedAt: null as unknown as undefined });
      } else {
        await store.updateDeck(ownerId, deckId, { status: "live" });
      }
    },
  };
}

export function createResultsSource(): ResultsSource {
  return {
    async get(deck) {
      if (!deck.experimentId) return { results: null, swipers: null };
      const flagsmith = await import("@/features/flagsmith");
      const cardIds = Object.fromEntries(deck.cards.map((c) => [c.key, c.cardId]));
      let results: FlagsmithExperimentResults | null = null;
      try {
        results = (
          await flagsmith.getExperimentResults(deck.experimentId, {
            flagName: deck.flagName,
            cardIds,
            controlKey: deck.controlKey,
            rewardMetricId: deck.rewardMetricId,
          })
        ).results;
      } catch (error) {
        if (!flagsmith.isNotConfigured(error)) {
          console.error("assistant: could not read Flagsmith", error instanceof Error ? error.message : error);
        }
      }
      let swipers: number | null = null;
      try {
        const { connectDb } = await import("@/shared/lib/db");
        const { Response } = await import("@/models");
        await connectDb();
        // Counted swipes only (spec 5.9): uncounted swipers never reach the number.
        swipers = ((await Response.distinct("swiperId", { deckId: deck.deckId, counted: true, valid: true })) as unknown[]).length;
      } catch {
        swipers = null;
      }
      return { results, swipers };
    },
  };
}
