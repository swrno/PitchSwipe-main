/** MongoDB adapter for the deck store (server only). Uses the WP0 Mongoose models. */
import { Types, isValidObjectId } from "mongoose";
import { connectDb } from "@/lib/db";
import { AssistantEvent, Card, Claim, Deck, Product, Response } from "@/models";
import type { Industry, Role, State } from "@/lib/lists";
import type { DeckStatus, PriceMode } from "@/types";
import type { SharedFields } from "./fields";
import type { ProductInput } from "./product";
import { EDIT_LOCK_TTL_MS, PUBLISH_CLAIM_TTL_MS, type DeckStats, type NewDeckRecord, type Store } from "./store";
import type { DeckCardInput, DeckRecord } from "./types";
import type { ProductRecord } from "./views";

type Row = Record<string, unknown>;
const str = (v: unknown): string => String(v);

function toProduct(row: Row): ProductRecord {
  const audience = (row.audience ?? {}) as Row;
  return {
    id: str(row._id),
    ownerId: str(row.ownerId),
    name: str(row.name),
    icon: str(row.icon ?? ""),
    category: str(row.category ?? ""),
    industry: row.industry as Industry,
    showOwnerName: row.showOwnerName === true,
    targetUsers: ((row.targetUsers as Role[]) ?? []).slice(),
    audience: {
      who: (audience.who as ProductRecord["audience"]["who"]) ?? "everyone",
      states: ((audience.states as State[]) ?? []).slice(),
      interests: ((audience.interests as Industry[]) ?? []).slice(),
    },
    deckIds: ((row.deckIds as unknown[]) ?? []).map(str),
  };
}

function optionIdsOf(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Row)) if (typeof v === "number") out[k] = v;
  return Object.keys(out).length > 0 ? out : undefined;
}

function toDeck(row: Row, cards: Row[]): DeckRecord {
  const boost = (row.boost ?? {}) as Row;
  return {
    _id: str(row._id),
    ownerId: str(row.ownerId),
    productId: str(row.productId),
    slug: str(row.slug),
    variable: row.variable as DeckRecord["variable"],
    priceMode: row.priceMode as PriceMode | undefined,
    shared: (row.shared ?? {}) as SharedFields,
    question: str(row.question ?? ""),
    positiveLabel: str(row.positiveLabel ?? ""),
    negativeLabel: str(row.negativeLabel ?? ""),
    flagName: str(row.flagName),
    experimentId: row.experimentId ? str(row.experimentId) : undefined,
    featureId: typeof row.featureId === "number" ? row.featureId : undefined,
    optionIds: optionIdsOf(row.optionIds),
    rewardMetricId: row.rewardMetricId ? str(row.rewardMetricId) : undefined,
    flagsmithError: row.flagsmithError ? str(row.flagsmithError) : undefined,
    publishingAt: row.publishingAt instanceof Date ? row.publishingAt : undefined,
    status: row.status as DeckStatus,
    decidedAt: row.decidedAt as Date | undefined,
    shippedAt: row.shippedAt as Date | undefined,
    shippedBy: row.shippedBy ? str(row.shippedBy) : undefined,
    winnerCardId: row.winnerCardId ? str(row.winnerCardId) : undefined,
    listedInFeed: row.listedInFeed === true,
    boost: {
      perSwipe: Number(boost.perSwipe ?? 0),
      budget: Number(boost.budget ?? 0),
      spent: Number(boost.spent ?? 0),
    },
    cards: cards
      .slice()
      .sort((a, b) => str(a.variantKey).localeCompare(str(b.variantKey)))
      .map((c) => ({ variantKey: str(c.variantKey), value: c.value })),
  };
}

const idOk = (id: string) => isValidObjectId(id);

/** Filter: no publish claim, or one older than PUBLISH_CLAIM_TTL_MS (abandoned). `publishingAt: null` also matches a missing field. */
function unclaimed(now: Date) {
  return { $or: [{ publishingAt: null }, { publishingAt: { $lt: new Date(now.getTime() - PUBLISH_CLAIM_TTL_MS) } }] };
}

/** Filter: no card write in flight, or one older than EDIT_LOCK_TTL_MS (a crashed request). */
function notEditing(now: Date) {
  return { $or: [{ editingAt: null }, { editingAt: { $lt: new Date(now.getTime() - EDIT_LOCK_TTL_MS) } }] };
}

/** A draft that no publish holds and no card write is changing: the only state cards may be replaced or deleted in. */
function freeDraft(now: Date) {
  return { status: "draft", $and: [unclaimed(now), notEditing(now)] };
}

async function cardsFor(deckIds: string[]): Promise<Map<string, Row[]>> {
  const rows = (await Card.find({ deckId: { $in: deckIds } }).lean()) as unknown as Row[];
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = str(r.deckId);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return map;
}

async function replaceCards(deckId: string, cards: DeckCardInput[]) {
  await Card.deleteMany({ deckId });
  if (cards.length > 0) await Card.insertMany(cards.map((c) => ({ deckId, variantKey: c.variantKey, value: c.value })));
}

export function createMongoStore(): Store {
  return {
    demo: false,

    async listProducts(ownerId) {
      await connectDb();
      return ((await Product.find({ ownerId }).lean()) as unknown as Row[]).map(toProduct);
    },
    async getProduct(ownerId, id) {
      if (!idOk(id)) return null;
      await connectDb();
      const row = (await Product.findOne({ _id: id, ownerId }).lean()) as unknown as Row | null;
      return row ? toProduct(row) : null;
    },
    async createProduct(ownerId, input: ProductInput) {
      await connectDb();
      const doc = await Product.create({ ...input, ownerId, deckIds: [] });
      return toProduct(doc.toObject() as Row);
    },
    async updateProduct(ownerId, id, input) {
      if (!idOk(id)) return null;
      await connectDb();
      const row = (await Product.findOneAndUpdate({ _id: id, ownerId }, { $set: input }, { new: true }).lean()) as unknown as Row | null;
      return row ? toProduct(row) : null;
    },

    async listDecks(ownerId) {
      await connectDb();
      const rows = (await Deck.find({ ownerId }).lean()) as unknown as Row[];
      const cards = await cardsFor(rows.map((r) => str(r._id)));
      return rows.map((r) => toDeck(r, cards.get(str(r._id)) ?? []));
    },
    async getDeck(ownerId, id) {
      if (!idOk(id)) return null;
      await connectDb();
      const row = (await Deck.findOne({ _id: id, ownerId }).lean()) as unknown as Row | null;
      if (!row) return null;
      return toDeck(row, ((await Card.find({ deckId: id }).lean()) as unknown as Row[]) ?? []);
    },
    async createDeck(ownerId, record: NewDeckRecord) {
      await connectDb();
      const { cards, ...fields } = record;
      const doc = await Deck.create({ ...fields, ownerId });
      const id = str(doc._id);
      await replaceCards(id, cards);
      await Product.updateOne({ _id: record.productId, ownerId }, { $addToSet: { deckIds: id } });
      return toDeck(doc.toObject() as Row, cards.map((c) => ({ ...c })));
    },
    async updateDeck(ownerId, id, patch) {
      if (!idOk(id)) return null;
      await connectDb();
      const before = (await Deck.findOne({ _id: id, ownerId }).lean()) as unknown as Row | null;
      if (!before) return null;
      const { cards, ...fields } = patch;
      let row: Row | null;
      if (cards) {
        // Cards live in their own collection, so replacing them is not atomic with the deck update. The guarded
        // update (a draft no publish has claimed and no other card write is changing) also sets `editingAt`, and
        // claimPublish, deleteDeck and other card writes exclude a fresh `editingAt`: a publish therefore either
        // claims before this write (and this write gets null) or after the new cards are fully in place.
        const editingAt = new Date();
        row = (await Deck.findOneAndUpdate(
          { _id: id, ownerId, ...freeDraft(editingAt) },
          { $set: { ...fields, editingAt } },
          { new: true },
        ).lean()) as unknown as Row | null;
        if (!row) return null;
        try {
          await replaceCards(id, cards);
        } finally {
          // Only this write's own marker (a stale one may have been taken over by a later write).
          row = ((await Deck.findOneAndUpdate({ _id: id, ownerId, editingAt }, { $set: { editingAt: null } }, { new: true }).lean()) ??
            row) as unknown as Row;
        }
      } else {
        row = (await Deck.findOneAndUpdate({ _id: id, ownerId }, { $set: fields }, { new: true }).lean()) as unknown as Row | null;
        if (!row) return null;
      }
      if (patch.productId && patch.productId !== str(before.productId)) {
        await Product.updateOne({ _id: before.productId, ownerId }, { $pull: { deckIds: id } });
        await Product.updateOne({ _id: patch.productId, ownerId }, { $addToSet: { deckIds: id } });
      }
      return toDeck(row, (await Card.find({ deckId: id }).lean()) as unknown as Row[]);
    },
    async claimPublish(ownerId, id, now) {
      if (!idOk(id)) return false;
      await connectDb();
      // One atomic findOneAndUpdate: only one of two racing publishes can match the "no fresh claim" filter, and
      // a claim never lands while a draft save is still replacing the cards (editingAt).
      const row = await Deck.findOneAndUpdate(
        { _id: id, ownerId, ...freeDraft(now) },
        { $set: { publishingAt: now } },
        { new: true },
      ).lean();
      return row !== null;
    },
    async deleteDeck(ownerId, id) {
      if (!idOk(id)) return false;
      await connectDb();
      // Drafts only, and never under a publish claim or a card write: a publish that claimed first keeps its deck.
      const row = (await Deck.findOneAndDelete({ _id: id, ownerId, ...freeDraft(new Date()) }).lean()) as unknown as Row | null;
      if (!row) return false;
      await Card.deleteMany({ deckId: id });
      await Product.updateOne({ _id: row.productId, ownerId }, { $pull: { deckIds: id } });
      return true;
    },
    async deckStats(ownerId, deckIds) {
      const out: Record<string, DeckStats> = {};
      const ids = deckIds.filter(idOk);
      for (const id of deckIds) out[id] = { swipers: 0, waitlist: 0 };
      if (ids.length === 0) return out;
      await connectDb();
      // Only decks the caller owns.
      const owned = ((await Deck.find({ _id: { $in: ids }, ownerId }).select("_id").lean()) as unknown as Row[]).map((r) => str(r._id));
      if (owned.length === 0) return out;
      const [swipers, claims, events] = await Promise.all([
        Response.aggregate([{ $match: { deckId: { $in: owned.map((i) => new Types.ObjectId(i)) }, counted: true } }, { $group: { _id: "$deckId", n: { $sum: 1 } } }]),
        Claim.aggregate([{ $match: { deckId: { $in: owned.map((i) => new Types.ObjectId(i)) } } }, { $group: { _id: "$deckId", n: { $sum: 1 } } }]),
        AssistantEvent.find({ deckId: { $in: owned }, type: "checked" }).sort({ createdAt: -1 }).lean(),
      ]);
      for (const r of swipers as { _id: unknown; n: number }[]) out[str(r._id)].swipers = r.n;
      for (const r of claims as { _id: unknown; n: number }[]) out[str(r._id)].waitlist = r.n;
      for (const e of events as unknown as Row[]) {
        const key = str(e.deckId);
        if (out[key].chance === undefined) {
          const chances = ((e.chanceBest as { chance: number }[]) ?? []).map((c) => c.chance);
          if (chances.length > 0) out[key].chance = Math.max(...chances);
        }
      }
      return out;
    },
  };
}
