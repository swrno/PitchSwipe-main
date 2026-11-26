/**
 * Where the assistant reads decks and Flagsmith results (server only). Behind small
 * interfaces so the watcher and ship service can be tested with fakes.
 * Demo mode (no MONGODB_URI) serves the "decided" state from fixtures.
 */
import { DECIDED_HEADLINE_TEST, FOUNDER, HEADLINE_FLAGSMITH_RESULTS, HEADLINE_RESULTS_TOTAL, decidedIdentitiesByVariant } from "@/fixtures";
import { getStore } from "@/lib/decks/store";
import { deckTitle, VARIABLE_NOUN, cardMetas } from "@/lib/results/cards";
import { demoDeckData } from "@/lib/results/demo";
import type { FlagsmithExperimentResults } from "@/types";

import { percent } from "./decided";
import type { ResultsSnapshot, WatchedDeck } from "./types";

export const DEMO_DECIDED_DECK_ID = "voice-khata-headline";

/**
 * Demo mode, headline deck only. The designs show two moments of this one test: the Results page at "Leading, not
 * decided yet" (web 16, phone 14) and the assistant's later "Test decided" check (web 19 and 20, phone 17 and 18).
 * spec/08 13.1 gives both (91% on Results, 96% decided). Both come from src/fixtures; this line says so on screen.
 */
export function demoReviewNote(deck: Pick<WatchedDeck, "flagName">): string | undefined {
  if (deck.flagName !== HEADLINE_FLAGSMITH_RESULTS.flagName) return undefined;
  const b = HEADLINE_FLAGSMITH_RESULTS.cards.find((c) => c.variantKey === "B");
  const earlier = b
    ? `${HEADLINE_RESULTS_TOTAL.swipers} swipers, ${percent(b.chanceToBeatControl)}% chance best`
    : `${HEADLINE_RESULTS_TOTAL.swipers} swipers`;
  return `A later check of the same test. The Results page still shows the earlier snapshot (${earlier}).`;
}

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

async function ownerInfo(ownerId: string, demo: boolean): Promise<{ name: string; email?: string }> {
  if (demo) return { name: FOUNDER.name };
  try {
    const { connectDb } = await import("@/lib/db");
    const { User } = await import("@/models");
    await connectDb();
    const u = (await User.findById(ownerId).select("name email").lean()) as unknown as Row | null;
    return { name: u?.name ? str(u.name) : "You", email: u?.email ? str(u.email) : undefined };
  } catch {
    return { name: "You" };
  }
}

async function mongoCardIds(deckId: string): Promise<Record<string, string>> {
  const { connectDb } = await import("@/lib/db");
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
  const owner = await ownerInfo(ownerId, store.demo);
  const demo = store.demo ? demoDeckData(deck._id, new Date()) : null;
  const metas = demo ? demo.cards : cardMetas(deck.variable, deck.priceMode, deck.cards);
  const ids = store.demo ? {} : await mongoCardIds(deck._id);
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
      const store = await getStore();
      if (store.demo) {
        const { DEMO_OWNER_ID } = await import("@/lib/decks/store-memory");
        const decks = await store.listDecks(DEMO_OWNER_ID);
        const out: WatchedDeck[] = [];
        for (const d of decks) {
          // Fixtures mark finished decks as already shipped; only the headline deck is the demo "decided" state.
          if (d._id !== DEMO_DECIDED_DECK_ID && (d.status === "draft" || d.status === "closed" || d.status === "shipped" || d.shippedAt)) continue;
          if (d.status === "draft" || d.status === "closed") continue;
          const w = await build(DEMO_OWNER_ID, d._id);
          if (w) out.push(w);
        }
        return out;
      }
      const { connectDb } = await import("@/lib/db");
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

/** Demo results: the headline deck is in the "decided" state of spec/08 (B 96%, A 3%, C 1%, 256 swipers). */
export function demoDecidedResults(): FlagsmithExperimentResults {
  const per = decidedIdentitiesByVariant();
  return {
    ...HEADLINE_FLAGSMITH_RESULTS,
    cards: HEADLINE_FLAGSMITH_RESULTS.cards.map((c) => ({
      ...c,
      identities: per[c.variantKey as "A" | "B" | "C"],
      chanceToBeatControl: DECIDED_HEADLINE_TEST.chanceByVariant[c.variantKey as "A" | "B" | "C"],
    })),
    srmWarning: false,
  };
}

export function createResultsSource(): ResultsSource {
  return {
    async get(deck, opts) {
      const store = await getStore();
      if (store.demo) {
        if (deck.deckId === DEMO_DECIDED_DECK_ID) {
          return { results: demoDecidedResults(), swipers: DECIDED_HEADLINE_TEST.validSwipers };
        }
        const d = demoDeckData(deck.deckId, opts?.now ?? new Date());
        return { results: d?.flagsmith ?? null, swipers: d ? d.aggregates.total.swipers : null };
      }
      if (!deck.experimentId) return { results: null, swipers: null };
      const flagsmith = await import("@/lib/flagsmith");
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
        const { connectDb } = await import("@/lib/db");
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
