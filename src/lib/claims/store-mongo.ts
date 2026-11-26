/**
 * MongoDB adapter for claims, comments and the wallet (server only).
 *
 * Some fields are not in the WP0 Mongoose schemas (Claim has no swiper, Wallet entries have no
 * responseId/title/note, commentVoice has no deleteAfter). Mongoose strict mode would drop them, so those
 * writes go through the native collection. Nothing in src/models is changed.
 */
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { swiperObjectId } from "@/lib/swipe/store-mongo";
import { Claim, Response as ResponseModel, Wallet } from "@/models";
import { playableAudio, roundRs } from "./rules";
import type { ClaimsStore, CommentPatch, StoredResponse, WalletEntryRecord, WalletRecord } from "./store";

type Row = Record<string, unknown>;

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export function createMongoClaimsStore(): ClaimsStore {
  return {
    demo: false,

    async getResponse(id): Promise<StoredResponse | null> {
      await connectDb();
      if (!Types.ObjectId.isValid(id)) return null;
      const row = (await ResponseModel.findById(id).lean()) as unknown as Row | null;
      if (!row) return null;
      return {
        id: String(row._id),
        swiperKey: String(row.swiperId),
        deckId: String(row.deckId),
        cardId: String(row.cardId),
        answer: String(row.answer),
        valid: row.valid === true,
        counted: row.counted === true,
        source: row.source === "link" ? "link" : "feed",
        exposedToFlagsmith: row.exposedToFlagsmith === true,
      };
    },

    isOwner: (response, swiperKey) => swiperObjectId(swiperKey).toHexString() === response.swiperKey,

    async saveClaim(input) {
      await connectDb();
      try {
        const result = await Claim.updateOne(
          { deckId: input.deckId, email: input.email },
          { $setOnInsert: { deckId: input.deckId, cardId: input.cardId, email: input.email, createdAt: input.createdAt } },
          { upsert: true },
        );
        return { saved: Boolean(result.upsertedId) };
      } catch (error) {
        // The unique (deckId, email) index: a racing duplicate is an idempotent "already claimed".
        if (isDuplicateKey(error)) return { saved: false };
        throw error;
      }
    },

    async setComment(responseId, patch: CommentPatch) {
      await connectDb();
      const set: Row = {};
      if (patch.comment !== undefined) set.comment = patch.comment;
      if (patch.voice) set.commentVoice = patch.voice;
      if (Object.keys(set).length === 0) return;
      await ResponseModel.collection.updateOne({ _id: new Types.ObjectId(responseId) }, { $set: set });
    },

    async creditWallet(swiperKey, entry: WalletEntryRecord) {
      await connectDb();
      const userId = swiperObjectId(swiperKey);
      const doc = {
        responseId: entry.responseId,
        deckId: Types.ObjectId.isValid(entry.deckId) ? new Types.ObjectId(entry.deckId) : entry.deckId,
        title: entry.title,
        amount: entry.amountRs,
        note: entry.note,
        swipeCount: entry.swipeCount,
        createdAt: entry.createdAt,
      };
      try {
        // Matches only while this response has not been credited; a second attempt tries to upsert and
        // hits the unique userId index, which is how we know it was a duplicate.
        const res = await Wallet.collection.updateOne(
          { userId, "entries.responseId": { $ne: entry.responseId } },
          { $push: { entries: doc } as never, $inc: { balance: entry.amountRs } },
          { upsert: true },
        );
        const balance = ((await Wallet.collection.findOne({ userId })) as Row | null)?.balance;
        return { credited: res.modifiedCount + (res.upsertedCount ?? 0) > 0, balanceRs: roundRs(Number(balance ?? 0)) };
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const balance = ((await Wallet.collection.findOne({ userId })) as Row | null)?.balance;
        return { credited: false, balanceRs: roundRs(Number(balance ?? 0)) };
      }
    },

    async getPlayableAudio(responseId, now) {
      await connectDb();
      if (!Types.ObjectId.isValid(responseId)) return undefined;
      const row = (await ResponseModel.collection.findOne(
        { _id: new Types.ObjectId(responseId) },
        { projection: { commentVoice: 1 } },
      )) as Row | null;
      return playableAudio(row?.commentVoice as Parameters<typeof playableAudio>[0], now);
    },

    async purgeExpiredAudio(now) {
      await connectDb();
      const res = await ResponseModel.collection.updateMany(
        { "commentVoice.deleteAfter": { $lte: now } },
        { $unset: { "commentVoice.audioUrl": "", "commentVoice.deleteAfter": "" } },
      );
      return res.modifiedCount;
    },

    async getWallet(swiperKey): Promise<WalletRecord> {
      await connectDb();
      const row = (await Wallet.collection.findOne({ userId: swiperObjectId(swiperKey) })) as Row | null;
      const entries = ((row?.entries as Row[] | undefined) ?? []).map(
        (e): WalletEntryRecord => ({
          responseId: String(e.responseId ?? ""),
          deckId: String(e.deckId ?? ""),
          title: String(e.title ?? "Deck"),
          amountRs: Number(e.amount ?? 0),
          note: String(e.note ?? "valid"),
          swipeCount: Number(e.swipeCount ?? 1),
          createdAt: new Date(e.createdAt as string),
        }),
      );
      entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { balanceRs: roundRs(Number(row?.balance ?? 0)), entries, weeklyBaseRs: 0, weeklyBaseSwipes: 0, todayBaseRs: 0, todayBaseSwipes: 0 };
    },
  };
}
