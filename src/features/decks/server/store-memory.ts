/**
 * In-memory deck store: an empty test double (never used by the running app). createMemoryStore() returns a
 * fresh, unseeded store; tests create the products and decks they need.
 */
import type { ProductInput } from "../product";
import { isPublishClaimed, type DeckStats, type NewDeckRecord, type Store } from "./store";
import type { DeckRecord } from "../types";
import type { ProductRecord } from "../views";
import type { MemberRecord, ProductAccess } from "../members";

interface MemoryState {
  products: ProductRecord[];
  decks: DeckRecord[];
  stats: Record<string, DeckStats>;
  members: MemberRecord[];
  seq: number;
}

const clone = <T>(value: T): T => structuredClone(value);


export function createMemoryStore(): Store & { forceRemoveDeck(id: string): void } {
  const root: MemoryState = { products: [], decks: [], stats: {}, members: [], seq: 1 };
  const state = (): MemoryState => root;
  const access = (actor: string, productId: string): ProductAccess => {
    const p = state().products.find((x) => x.id === productId);
    if (!p) return null;
    if (p.ownerId === actor) return "owner";
    return state().members.some((m) => m.productId === productId && m.uid === actor && m.status === "active") ? "cofounder" : null;
  };
  /** Products the actor owns or is an active co-founder of. */
  const visibleProducts = (actor: string) => state().products.filter((p) => access(actor, p.id) !== null);
  const visibleDecks = (actor: string) => state().decks.filter((d) => access(actor, d.productId) !== null || d.ownerId === actor);
  /** The deck if the actor may touch it. Writes then use the deck's own ownerId (the product owner). */
  const deckFor = (actor: string, id: string) => visibleDecks(actor).find((x) => x._id === id);
  return {
    forceRemoveDeck(id) {
      root.decks = root.decks.filter((d) => d._id !== id);
    },

    async listProducts(ownerId) {
      return clone(visibleProducts(ownerId));
    },
    async getProduct(ownerId, id) {
      const p = visibleProducts(ownerId).find((x) => x.id === id);
      return p ? clone(p) : null;
    },
    async createProduct(ownerId, input: ProductInput) {
      const s = state();
      const rec: ProductRecord = { ...clone(input), id: `product-${s.seq++}`, ownerId, deckIds: [] };
      s.products.push(rec);
      return clone(rec);
    },
    async updateProduct(ownerId, id, input) {
      const p = state().products.find((x) => x.id === id && x.ownerId === ownerId);
      if (!p) return null;
      Object.assign(p, clone(input));
      return clone(p);
    },

    async listDecks(ownerId) {
      return clone(visibleDecks(ownerId));
    },
    async getDeck(ownerId, id) {
      const d = deckFor(ownerId, id);
      return d ? clone(d) : null;
    },
    async createDeck(ownerId, record: NewDeckRecord) {
      const s = state();
      const product = s.products.find((p) => p.id === record.productId);
      if (product && access(ownerId, product.id) === null) throw new Error("No access to this product.");
      // Decks belong to the product owner, whoever on the team made them.
      const rec: DeckRecord = { ...clone(record), _id: `deck-${s.seq++}`, ownerId: product?.ownerId ?? ownerId };
      s.decks.push(rec);
      s.products.find((p) => p.id === rec.productId)?.deckIds.push(rec._id);
      s.stats[rec._id] = { swipers: 0, waitlist: 0 };
      return clone(rec);
    },
    async updateDeck(ownerId, id, patch) {
      const s = state();
      const d = deckFor(ownerId, id);
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
      // Synchronous check-and-set: atomic within the one Node process that holds the state.
      const d = deckFor(ownerId, id);
      if (!d || d.status !== "draft" || isPublishClaimed(d, now.getTime())) return false;
      d.publishingAt = new Date(now);
      return true;
    },
    async deleteDeck(ownerId, id) {
      const s = state();
      const d = deckFor(ownerId, id);
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
      for (const id of deckIds) out[id] = deckFor(ownerId, id) ? (s.stats[id] ?? { swipers: 0, waitlist: 0 }) : { swipers: 0, waitlist: 0 };
      return clone(out);
    },

    async productAccess(actorId, productId) {
      return access(actorId, productId);
    },
    async listMembers(productId) {
      return clone(state().members.filter((m) => m.productId === productId));
    },
    async getMember(productId, memberId) {
      const m = state().members.find((x) => x.id === memberId && x.productId === productId);
      return m ? clone(m) : null;
    },
    async inviteMember(record) {
      const s = state();
      const existing = s.members.find((m) => m.productId === record.productId && m.email === record.email);
      if (existing?.status === "active") return null;
      if (existing) {
        existing.tokenHash = record.tokenHash;
        existing.expiresAt = new Date(record.expiresAt);
        existing.invitedBy = record.invitedBy;
        return clone(existing);
      }
      const rec: MemberRecord = { ...clone(record), id: `member-${s.seq++}` };
      s.members.push(rec);
      return clone(rec);
    },
    async findMemberByTokenHash(tokenHash) {
      const m = state().members.find((x) => x.tokenHash === tokenHash);
      return m ? clone(m) : null;
    },
    async acceptMember(memberId, uid, now) {
      const m = state().members.find((x) => x.id === memberId);
      if (!m || m.status !== "invited" || !m.tokenHash || m.expiresAt.getTime() <= now.getTime()) return null;
      m.status = "active";
      m.uid = uid;
      m.acceptedAt = new Date(now);
      delete m.tokenHash;
      return clone(m);
    },
    async removeMember(productId, memberId) {
      const s = state();
      const before = s.members.length;
      s.members = s.members.filter((m) => !(m.id === memberId && m.productId === productId));
      return s.members.length < before;
    },
  };
}
