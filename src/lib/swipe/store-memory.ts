/**
 * Demo-mode swipe store: in-memory, used when MONGODB_URI is unset. State lives on globalThis so it
 * survives hot reloads and is shared by every route handler. It resets on restart.
 */
import { demoDecks } from "./demo";
import { LINK_STATUSES, type ResponseRecord, type SaveResult, type SwipeStore } from "./store";
import type { SwipeDeck } from "./types";

interface MemoryState {
  decks: SwipeDeck[];
  responses: Map<string, ResponseRecord & { id: string }>;
  seq: number;
}

const g = globalThis as unknown as { __pitchswipeSwipeDemo?: MemoryState };
const state = (): MemoryState => (g.__pitchswipeSwipeDemo ??= { decks: demoDecks(), responses: new Map(), seq: 1 });

const voteKey = (deckId: string, swiperKey: string) => `${deckId}|${swiperKey}`;

export const memorySwipeStore: SwipeStore = {
  demo: true,

  async listFeedDecks() {
    return structuredClone(state().decks.filter((d) => d.status === "live" && d.listedInFeed));
  },
  async getDeckBySlug(slug) {
    const deck = state().decks.find((d) => d.slug === slug && (LINK_STATUSES as readonly string[]).includes(d.status));
    return deck ? structuredClone(deck) : null;
  },
  async getDeckById(id) {
    const deck = state().decks.find((d) => d.id === id);
    return deck ? structuredClone(deck) : null;
  },
  async hasResponded(deckId, swiperKey) {
    return state().responses.has(voteKey(deckId, swiperKey));
  },
  async saveResponse(record): Promise<SaveResult> {
    const s = state();
    const key = voteKey(record.deckId, record.swiperKey);
    if (s.responses.has(key)) return { saved: false, duplicate: true };
    const id = `response-${s.seq++}`;
    s.responses.set(key, { ...record, id });
    return { saved: true, id };
  },
  async markExposed(responseId) {
    for (const r of state().responses.values()) if (r.id === responseId) r.exposedToFlagsmith = true;
  },
};
