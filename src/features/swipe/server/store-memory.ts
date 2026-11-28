/**
 * In-memory swipe store: an empty test double (never used by the running app). Tests pass the decks they need.
 */
import { LINK_STATUSES, type ResponseRecord, type SaveResult, type SwipeStore } from "./store";
import type { SwipeDeck } from "../types";

type ResponseRow = ResponseRecord & { id: string };

export interface MemorySwipeStore extends SwipeStore {
  /** Saved responses, for tests and the memory claims store. */
  responses(): Iterable<ResponseRow>;
  /** Adds a response row as is (with its own id), for tests that need a stored answer. */
  insertResponse(row: ResponseRow): void;
}

export function createMemorySwipeStore(initialDecks: SwipeDeck[] = []): MemorySwipeStore {
  const decks = initialDecks;
  const responses = new Map<string, ResponseRow>();
  let seq = 1;
  const voteKey = (deckId: string, swiperKey: string) => `${deckId}|${swiperKey}`;

  return {
    async listFeedDecks() {
      return structuredClone(decks.filter((d) => d.status === "live" && d.listedInFeed));
    },
    async getDeckBySlug(slug) {
      const deck = decks.find((d) => d.slug === slug && (LINK_STATUSES as readonly string[]).includes(d.status));
      return deck ? structuredClone(deck) : null;
    },
    async getDeckById(id) {
      const deck = decks.find((d) => d.id === id);
      return deck ? structuredClone(deck) : null;
    },
    async hasResponded(deckId, swiperKey) {
      return responses.has(voteKey(deckId, swiperKey));
    },
    async saveResponse(record): Promise<SaveResult> {
      const key = voteKey(record.deckId, record.swiperKey);
      if (responses.has(key)) return { saved: false, duplicate: true };
      const id = `response-${seq++}`;
      responses.set(key, { ...record, id });
      return { saved: true, id };
    },
    async markExposed(responseId) {
      for (const r of responses.values()) if (r.id === responseId) r.exposedToFlagsmith = true;
    },
    responses: () => responses.values(),
    insertResponse: (row) => void responses.set(voteKey(row.deckId, row.id), row),
  };
}
