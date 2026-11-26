/**
 * Server-only data for the chat: the founder's decks (through the WP7 loaders, so the owner scoping
 * and the 10-swiper rule are the same as the Results screens), comments, and Flagsmith results.
 *
 *  - Demo mode (no MONGODB_URI): fixtures only. Demo comments below match the web design (screen 26).
 *  - Otherwise: counted, valid swipes from MongoDB. Raw IPs, swiper ids, emails and audio URLs are
 *    never selected or returned.
 */
import { PRODUCT_TOTALS } from "@/fixtures";
import { getStore } from "@/lib/decks/store";
import { demoDeckData } from "@/lib/results/demo";
import { loadResults, loadSwitcher } from "@/lib/results/load";
import type { FlagsmithExperimentResults } from "@/types";

import type { AskToolCtx, CommentRow, DeckInContext } from "./types";

const MAX_COMMENTS_LOADED = 200;

/* Demo comments ------------------------------------------------------------------ */

const DEMO_COMMENTS: Record<string, CommentRow[]> = {
  "voice-khata-headline": [
    { id: "c1", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "Rs 10 a day sounds cheap, but I do not know what I get.", state: "Uttar Pradesh", role: "Shop owner" },
    { id: "c2", cardKey: "C", cardLabel: "Headline C", kind: "voice", language: "Hindi", seconds: 9, text: "Ledger I already keep in a notebook. Why pay for that?", state: "Gujarat", role: "Shop owner" },
    { id: "c3", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "The price is fine, but it is not clear what you get for it.", state: "Maharashtra", role: "Wholesaler" },
    { id: "c4", cardKey: "C", cardLabel: "Headline C", kind: "typed", text: "Sounds like another app. Does it work in Hindi?", state: "Delhi", role: "Salaried" },
    { id: "c5", cardKey: "B", cardLabel: "Headline B", kind: "typed", text: "Getting paid on time is the whole problem for me.", state: "Gujarat", role: "Shop owner" },
    { id: "c6", cardKey: "B", cardLabel: "Headline B", kind: "voice", language: "Hindi", seconds: 12, text: "I spend my evenings calling people for money. This is for me.", state: "Maharashtra", role: "Wholesaler" },
    { id: "c7", cardKey: "A", cardLabel: "Headline A", kind: "typed", text: "Clear, but I have heard this promise before.", state: "West Bengal", role: "Shop owner" },
  ],
};

/* Context ------------------------------------------------------------------------- */

type Row = Record<string, unknown>;
const str = (v: unknown): string => String(v);

async function mongo() {
  const [{ isValidObjectId }, { connectDb }, models] = await Promise.all([
    import("mongoose"),
    import("@/lib/db"),
    import("@/models"),
  ]);
  return { isValidObjectId, connectDb, ...models };
}

async function liveComments(deckId: string, cardLabels: Record<string, string>): Promise<CommentRow[]> {
  const { isValidObjectId, connectDb, Card, Response } = await mongo();
  if (!isValidObjectId(deckId)) return [];
  await connectDb();
  const cards = (await Card.find({ deckId }).select("variantKey").lean()) as unknown as Row[];
  const keyById = new Map(cards.map((c) => [str(c._id), str(c.variantKey)]));
  // `ip`, `swiperId` and `audioUrl` are not selected.
  const rows = (await Response.find({
    deckId,
    counted: true,
    valid: true,
    $or: [{ comment: { $exists: true, $ne: "" } }, { "commentVoice.english": { $exists: true, $ne: "" } }],
  })
    .select("cardId comment commentVoice.english commentVoice.transcript commentVoice.language commentVoice.durationSec region role createdAt")
    .sort({ createdAt: -1 })
    .limit(MAX_COMMENTS_LOADED)
    .lean()) as unknown as Row[];

  const out: CommentRow[] = [];
  for (const r of rows) {
    const cardKey = keyById.get(str(r.cardId));
    if (!cardKey) continue;
    const voice = r.commentVoice as { english?: string; transcript?: string; language?: string; durationSec?: number } | undefined;
    const typed = typeof r.comment === "string" ? r.comment.trim() : "";
    const spoken = (voice?.english || voice?.transcript || "").trim();
    const base = { cardKey, cardLabel: cardLabels[cardKey] ?? cardKey, state: r.region ? str(r.region) : undefined, role: r.role ? str(r.role) : undefined };
    if (typed) out.push({ ...base, id: `${str(r._id)}:t`, kind: "typed", text: typed });
    if (spoken) out.push({ ...base, id: `${str(r._id)}:v`, kind: "voice", text: spoken, language: voice?.language, seconds: voice?.durationSec });
  }
  return out;
}

async function liveExperiment(ownerId: string, deckId: string): Promise<FlagsmithExperimentResults | null> {
  const store = await getStore();
  const deck = await store.getDeck(ownerId, deckId);
  if (!deck?.experimentId) return null;
  try {
    const { Card, connectDb } = await mongo();
    await connectDb();
    const rows = (await Card.find({ deckId }).select("variantKey").lean()) as unknown as Row[];
    const cardIds: Record<string, string> = {};
    for (const r of rows) cardIds[str(r.variantKey)] = str(r._id);
    const flagsmith = await import("@/lib/flagsmith");
    // Control = the first card by variant key (cards are stored control first); Flagsmith's "control" maps to it.
    const controlKey = deck.cards.map((c) => c.variantKey).sort()[0];
    return (
      await flagsmith.getExperimentResults(deck.experimentId, {
        flagName: deck.flagName,
        cardIds,
        controlKey,
        rewardMetricId: deck.rewardMetricId,
      })
    ).results;
  } catch (error) {
    if (!(error instanceof Error && error.name === "FlagsmithNotConfigured")) {
      console.error("ask: could not read Flagsmith", error instanceof Error ? error.message : error);
    }
    return null;
  }
}

/**
 * Everything the tools may read for one founder, or null when the deck is not theirs.
 * Only decks of the same product that the deck switcher lists are reachable, so a model-chosen deck id
 * can never reach another founder's data.
 */
export async function buildAskContext(ownerId: string, deckId: string, now: Date = new Date()): Promise<AskToolCtx | null> {
  const switcher = await loadSwitcher(ownerId, deckId, now);
  if (!switcher) return null;
  const loaded = await Promise.all(switcher.items.map((i) => loadResults(ownerId, i.id, now)));
  const decks: Record<string, DeckInContext> = {};
  switcher.items.forEach((item, i) => {
    const payload = loaded[i];
    if (payload) decks[item.id] = { id: item.id, label: item.label, payload };
  });
  if (!decks[deckId]) return null;
  const demo = (await getStore()).demo;

  const cardLabels = (id: string): Record<string, string> =>
    Object.fromEntries(decks[id].payload.leaderboard.everyone.map((r) => [r.key, r.label]));

  return {
    currentDeckId: deckId,
    productName: switcher.productName,
    decks,
    comments: async (id) => {
      if (!decks[id]) return [];
      return demo ? (DEMO_COMMENTS[id] ?? []) : liveComments(id, cardLabels(id));
    },
    experiment: async (id) => {
      if (!decks[id]) return null;
      return demo ? (demoDeckData(id, now)?.flagsmith ?? null) : liveExperiment(ownerId, id);
    },
  };
}

/** Header line numbers: "4 decks · 612 swipers · updated 2 min ago". */
export function contextHeader(ctx: AskToolCtx): {
  productName: string;
  decks: number;
  swipers: number;
  /** "swipers" (distinct people, demo product total) or "swipes" (sum of counted swipes across decks, real mode). */
  swipersLabel: "swipers" | "swipes";
  /** Demo decks: every number in the chat is fixture data and the screen says so. */
  demo: boolean;
  updated: string | null;
} {
  const all = Object.values(ctx.decks);
  const minutes = ctx.decks[ctx.currentDeckId].payload.assistant.minutesAgo;
  const demoProduct = all.length === PRODUCT_TOTALS.voiceKhataDecks && all.every((d) => d.payload.demo);
  const anyDemo = all.some((d) => d.payload.demo);
  return {
    productName: ctx.productName,
    decks: all.length,
    // Demo: the product total of distinct swipers (612, spec/08 §13.1; the deck rows add up to more because a swiper can
    // answer several decks), the same number Insights shows. Real mode: the sum of each deck's counted swipes, labelled "swipes"
    // because the same person can be counted once per deck.
    swipers: demoProduct ? PRODUCT_TOTALS.voiceKhataSwipers : all.reduce((n, d) => n + d.payload.totals.swipers, 0),
    swipersLabel: demoProduct ? "swipers" : "swipes",
    demo: anyDemo,
    updated: minutes === null ? null : minutes < 1 ? "just now" : `${minutes} min ago`,
  };
}
