/** MongoDB store for saved chats (server only). Every query includes the uid, so one user can never read another's chat. */
import type { UIMessage } from "ai";

import type { ChatDoc, ChatStore, ChatSummary } from "./history";

async function model() {
  const [{ connectDb }, { AskChat }] = await Promise.all([import("@/shared/lib/db"), import("@/models")]);
  await connectDb();
  return AskChat;
}

type Row = { chatId: string; title?: string; updatedAt: Date; messages?: UIMessage[] };
const summary = (r: Row): ChatSummary => ({ chatId: r.chatId, title: r.title || "New chat", updatedAt: new Date(r.updatedAt).toISOString() });

export function createMongoChatStore(): ChatStore {
  return {
    async list(uid, limit) {
      const rows = (await (await model()).find({ uid }).select("chatId title updatedAt").sort({ updatedAt: -1 }).limit(limit).lean()) as unknown as Row[];
      return rows.map(summary);
    },
    async get(uid, chatId) {
      const r = (await (await model()).findOne({ uid, chatId }).select("chatId title updatedAt messages").lean()) as unknown as Row | null;
      return r ? ({ ...summary(r), messages: Array.isArray(r.messages) ? r.messages : [] } satisfies ChatDoc) : null;
    },
    async ownerOf(chatId) {
      const r = (await (await model()).findOne({ chatId }).select("uid").lean()) as unknown as { uid: unknown } | null;
      return r ? String(r.uid) : null;
    },
    async upsert(uid, chatId, data) {
      const now = new Date();
      try {
        await (await model()).findOneAndUpdate(
          { uid, chatId },
          { $set: { messages: data.messages, updatedAt: now }, $setOnInsert: { title: data.title, createdAt: now } },
          { upsert: true },
        );
        return "ok";
      } catch (error) {
        // The unique chatId index: someone else owns it.
        if ((error as { code?: number }).code === 11000) return "foreign";
        throw error;
      }
    },
    async remove(uid, chatId) {
      return ((await (await model()).deleteOne({ uid, chatId })).deletedCount ?? 0) > 0;
    },
  };
}
