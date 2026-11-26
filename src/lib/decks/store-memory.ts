/**
 * Demo-mode store: in-memory, seeded from src/fixtures (spec/08 §13.1), used
 * when MONGODB_URI is unset. State lives on globalThis so it survives hot reloads
 * and is shared by every route handler in the process. It resets on restart.
 */
import { DECKS, HEADLINE_TEST, demoDeckStats, LEDGER_FOR_CHEMISTS, QUEUELESS, VOICE_KHATA, type FixtureProduct } from "@/fixtures";
import type { Role } from "@/lib/lists";
import type { ProductInput } from "./product";
import { isPublishClaimed, type DeckStats, type NewDeckRecord, type Store } from "./store";
import type { DeckRecord } from "./types";
import type { ProductRecord } from "./views";

export const DEMO_OWNER_ID = "demo-founder";

interface MemoryState {
  products: ProductRecord[];
  decks: DeckRecord[];
  stats: Record<string, DeckStats>;
  seq: number;
}

const clone = <T,>(value: T): T => structuredClone(value);

function productFrom(f: FixtureProduct, extra: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: f.id,
    ownerId: DEMO_OWNER_ID,
    name: f.name,
    icon: f.name.slice(0, 1),
    category: f.category,
    industry: f.industry,
    showOwnerName: true,
    targetUsers: [],
    audience: { who: "everyone", states: [], interests: [] },
    deckIds: [],
    ...extra,
  };
}

// Swipers and waitlist per deck come from src/fixtures (the single source for My decks, Insights, Ask and Results).

function seed(): MemoryState {
  const products: ProductRecord[] = [
    productFrom(VOICE_KHATA, {
      targetUsers: ["Shop owner", "Wholesaler"] as Role[],
      audience: { who: "targetOnly", states: ["Gujarat", "Maharashtra"], interests: ["Retail", "Finance"] },
    }),
    productFrom(QUEUELESS),
    productFrom(LEDGER_FOR_CHEMISTS),
  ];
  const decks: DeckRecord[] = [];
  const stats: Record<string, DeckStats> = {};

  for (const f of DECKS) {
    const isHeadline = f.id === "voice-khata-headline";
    const finished = f.status === "decided";
    decks.push({
      _id: f.id,
      ownerId: DEMO_OWNER_ID,
      productId: f.productId,
      slug: f.id,
      variable: f.variable,
      priceMode: f.variable === "price" ? "level" : undefined,
      shared: isHeadline
        ? {
            description: "Say who bought on credit and Voice Khata records it, tracks dues and reminds buyers politely.",
            reward: HEADLINE_TEST.reward,
            price: HEADLINE_TEST.price,
          }
        : {},
      question: isHeadline ? HEADLINE_TEST.question : "",
      positiveLabel: isHeadline ? HEADLINE_TEST.positiveLabel : "Yes, I would",
      negativeLabel: isHeadline ? HEADLINE_TEST.negativeLabel : "No, I would not",
      flagName: f.flagName ?? `deck_${f.id}`,
      status: f.status,
      // "Won" decks are the ones whose winner was already approved.
      shippedAt: finished ? new Date("2026-11-10T18:42:00+05:30") : undefined,
      listedInFeed: f.status !== "draft",
      boost: { perSwipe: 0, budget: 0, spent: 0 },
      cards: isHeadline
        ? HEADLINE_TEST.variantKeys.map((k) => ({ variantKey: k, value: HEADLINE_TEST.headlines[k] }))
        : [],
    });
    stats[f.id] = { swipers: demoDeckStats(f.id)?.swipers ?? 0, waitlist: demoDeckStats(f.id)?.waitlist ?? 0, chance: f.chance };
    products.find((p) => p.id === f.productId)?.deckIds.push(f.id);
  }
  return { products, decks, stats, seq: 1 };
}

const g = globalThis as unknown as { __pitchswipeDemoDecks?: MemoryState };
const state = (): MemoryState => (g.__pitchswipeDemoDecks ??= seed());

const owned = <T extends { ownerId: string }>(owner: string, rows: T[]) => rows.filter((r) => r.ownerId === owner);

export const memoryStore: Store = {
  demo: true,

  async listProducts(ownerId) {
    return clone(owned(ownerId, state().products));
  },
  async getProduct(ownerId, id) {
    const p = owned(ownerId, state().products).find((x) => x.id === id);
    return p ? clone(p) : null;
  },
  async createProduct(ownerId, input: ProductInput) {
    const s = state();
    const rec: ProductRecord = { ...clone(input), id: `product-${s.seq++}`, ownerId, deckIds: [] };
    s.products.push(rec);
    return clone(rec);
  },
  async updateProduct(ownerId, id, input) {
    const p = owned(ownerId, state().products).find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, clone(input));
    return clone(p);
  },

  async listDecks(ownerId) {
    return clone(owned(ownerId, state().decks));
  },
  async getDeck(ownerId, id) {
    const d = owned(ownerId, state().decks).find((x) => x._id === id);
    return d ? clone(d) : null;
  },
  async createDeck(ownerId, record: NewDeckRecord) {
    const s = state();
    const rec: DeckRecord = { ...clone(record), _id: `deck-${s.seq++}`, ownerId };
    s.decks.push(rec);
    s.products.find((p) => p.id === rec.productId)?.deckIds.push(rec._id);
    s.stats[rec._id] = { swipers: 0, waitlist: 0 };
    return clone(rec);
  },
  async updateDeck(ownerId, id, patch) {
    const s = state();
    const d = owned(ownerId, s.decks).find((x) => x._id === id);
    if (!d) return null;
    // Same guard as the Mongo store: cards change only on an unclaimed draft.
    if (patch.cards && (d.status !== "draft" || isPublishClaimed(d))) return null;
    if (patch.productId && patch.productId !== d.productId) {
      const from = s.products.find((p) => p.id === d.productId);
      if (from) from.deckIds = from.deckIds.filter((x) => x !== id);
      s.products.find((p) => p.id === patch.productId)?.deckIds.push(id);
    }
    Object.assign(d, clone(patch));
    return clone(d);
  },
  async claimPublish(ownerId, id, now) {
    // Synchronous check-and-set: atomic within the one Node process that holds the demo state.
    const d = owned(ownerId, state().decks).find((x) => x._id === id);
    if (!d || d.status !== "draft" || isPublishClaimed(d, now.getTime())) return false;
    d.publishingAt = new Date(now);
    return true;
  },
  async deleteDeck(ownerId, id) {
    const s = state();
    const d = owned(ownerId, s.decks).find((x) => x._id === id);
    // Same guard as the Mongo store: only a draft that no publish has claimed.
    if (!d || d.status !== "draft" || isPublishClaimed(d)) return false;
    s.decks = s.decks.filter((x) => x._id !== id);
    const p = s.products.find((x) => x.id === d.productId);
    if (p) p.deckIds = p.deckIds.filter((x) => x !== id);
    delete s.stats[id];
    return true;
  },
  async deckStats(ownerId, deckIds) {
    const s = state();
    const out: Record<string, DeckStats> = {};
    for (const id of deckIds) out[id] = s.stats[id] ?? { swipers: 0, waitlist: 0 };
    void ownerId;
    return clone(out);
  },
};
