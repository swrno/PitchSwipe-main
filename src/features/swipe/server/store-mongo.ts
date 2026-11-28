/** MongoDB adapter for the swipe store (server only). Uses the WP0 Mongoose models. */
import { Types } from "mongoose";
import { connectDb } from "@/shared/lib/db";
import type { Industry, Role, State, TestVariable } from "@/shared/lib/lists";
import { Card, Deck, Product, Response as ResponseModel, User } from "@/models";
import type { DeckStatus } from "@/types";
import { swiperIdHex } from "../identity";
import { LINK_STATUSES, type SaveResult, type SwipeStore } from "./store";
import type { Accent, SwipeCardRow, SwipeDeck, SwipeProduct, SwipeShared } from "../types";
import { STARTER_OWNER_UID } from "../starter";

type Row = Record<string, unknown>;

const ACCENTS: Accent[] = ["green", "blue", "purple"];

/** Card accent follows the product (designs: green / blue / purple). Stable per name. */
function accentFor(name: string): Accent {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

/**
 * Mongo `swiperId` is an ObjectId. Only a "u:<user _id>" key (set from a Firebase-verified uid) maps to
 * that user's ObjectId. Every other key (guests, whatever their guid looks like) is hashed into a separate
 * namespace, so a client string can never resolve to a user row.
 */
export function swiperObjectId(swiperKey: string): Types.ObjectId {
  return new Types.ObjectId(swiperIdHex(swiperKey));
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

function toProduct(snapshot: Row | undefined, productRow: Row | null, ownerName?: string): SwipeProduct {
  const src = (snapshot ?? productRow ?? {}) as Row;
  const audience = (src.audience ?? {}) as Row;
  const name = String(src.name ?? "Untitled");
  const showOwnerName = src.showOwnerName === true;
  return {
    name,
    icon: String(src.icon ?? "") || name.slice(0, 1).toUpperCase(),
    category: String(src.category ?? ""),
    industry: src.industry as Industry,
    accent: accentFor(name),
    showOwnerName,
    ownerName: showOwnerName ? ownerName : undefined,
    targetUsers: ((src.targetUsers as Role[]) ?? []).slice(),
    audience: {
      who: (audience.who as SwipeProduct["audience"]["who"]) ?? "everyone",
      states: ((audience.states as State[]) ?? []).slice(),
      interests: ((audience.interests as Industry[]) ?? []).slice(),
    },
  };
}

async function hydrate(rows: Row[]): Promise<SwipeDeck[]> {
  if (rows.length === 0) return [];
  const deckIds = rows.map((r) => r._id);
  const cardRows = (await Card.find({ deckId: { $in: deckIds } })
    .sort({ variantKey: 1 })
    .lean()) as unknown as Row[];
  const productIds = [...new Set(rows.map((r) => String(r.productId)))];
  const productRows = (await Product.find({ _id: { $in: productIds } }).lean()) as unknown as Row[];
  const ownerIds = [...new Set(rows.map((r) => String(r.ownerId)))];
  const owners = (await User.find({ _id: { $in: ownerIds } })
    .select("name firebaseUid")
    .lean()) as unknown as Row[];

  return rows.map((row) => {
    const shared = (row.shared ?? {}) as Row;
    const { product: snapshot, ...locked } = shared;
    const productRow = productRows.find((p) => String(p._id) === String(row.productId)) ?? null;
    const owner = owners.find((o) => String(o._id) === String(row.ownerId));
    const boost = (row.boost ?? {}) as Row;
    const cards: SwipeCardRow[] = cardRows
      .filter((c) => String(c.deckId) === String(row._id))
      .map((c) => ({ id: String(c._id), variantKey: String(c.variantKey), value: c.value }));
    return {
      id: String(row._id),
      slug: String(row.slug),
      flagName: String(row.flagName),
      experimentId: row.experimentId ? String(row.experimentId) : undefined,
      variable: row.variable as TestVariable,
      status: row.status as DeckStatus,
      listedInFeed: row.listedInFeed === true,
      question: String(row.question ?? ""),
      positiveLabel: String(row.positiveLabel ?? ""),
      negativeLabel: String(row.negativeLabel ?? ""),
      shared: locked as SwipeShared,
      cards,
      winnerCardId: row.winnerCardId ? String(row.winnerCardId) : undefined,
      boost: {
        perSwipe: Number(boost.perSwipe ?? 0),
        budget: Number(boost.budget ?? 0),
        spent: Number(boost.spent ?? 0),
      },
      product: toProduct(snapshot as Row | undefined, productRow, owner ? String(owner.name) : undefined),
      starter: owner?.firebaseUid === STARTER_OWNER_UID,
    };
  });
}

export function createMongoSwipeStore(): SwipeStore {
  return {

    async listFeedDecks() {
      await connectDb();
      const rows = (await Deck.find({ status: "live", listedInFeed: true }).lean()) as unknown as Row[];
      return (await hydrate(rows)).filter((d) => d.cards.length > 0);
    },

    async getDeckBySlug(slug) {
      await connectDb();
      const row = (await Deck.findOne({ slug, status: { $in: [...LINK_STATUSES] } }).lean()) as unknown as Row | null;
      if (!row) return null;
      const [deck] = await hydrate([row]);
      return deck && deck.cards.length > 0 ? deck : null;
    },

    async getDeckById(id) {
      await connectDb();
      if (!Types.ObjectId.isValid(id)) return null;
      const row = (await Deck.findById(id).lean()) as unknown as Row | null;
      if (!row) return null;
      const [deck] = await hydrate([row]);
      return deck ?? null;
    },

    async hasResponded(deckId, swiperKey) {
      await connectDb();
      if (!Types.ObjectId.isValid(deckId)) return false;
      return Boolean(await ResponseModel.exists({ deckId, swiperId: swiperObjectId(swiperKey) }));
    },

    async saveResponse(record): Promise<SaveResult> {
      await connectDb();
      const swiperId = swiperObjectId(record.swiperKey);
      // One vote per swiper per deck: insert only if no response exists for the pair. The unique
      // (deckId, swiperId) index makes this atomic; a racing duplicate raises E11000, treated as duplicate.
      let result;
      try {
        result = await ResponseModel.updateOne(
          { deckId: record.deckId, swiperId },
          {
            $setOnInsert: {
              deckId: record.deckId,
              swiperId,
              source: record.source,
              cardId: record.cardId,
              role: record.role,
              isTargetUser: record.isTargetUser,
              answer: record.answer,
              dwellMs: record.dwellMs,
              region: record.region,
              valid: record.valid,
              counted: record.counted,
              createdAt: record.createdAt,
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if (isDuplicateKey(error)) return { saved: false, duplicate: true };
        throw error;
      }
      if (result.upsertedId) return { saved: true, id: String(result.upsertedId) };
      return { saved: false, duplicate: true };
    },

    async markExposed(responseId) {
      await connectDb();
      if (!Types.ObjectId.isValid(responseId)) return;
      await ResponseModel.updateOne({ _id: responseId }, { $set: { exposedToFlagsmith: true } });
    },
  };
}
