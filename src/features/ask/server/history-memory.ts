/** In-memory chat store for tests (same rules as the MongoDB one). */
import type { ChatStore } from "./history";

export function createMemoryChatStore(): ChatStore {
  const rows = new Map<string, { uid: string; title: string; messages: unknown[]; updatedAt: Date }>();
  const view = (chatId: string, r: { title: string; updatedAt: Date }) => ({ chatId, title: r.title, updatedAt: r.updatedAt.toISOString() });
  return {
    async list(uid, limit) {
      return [...rows.entries()].filter(([, r]) => r.uid === uid).sort((a, b) => b[1].updatedAt.getTime() - a[1].updatedAt.getTime()).slice(0, limit).map(([id, r]) => view(id, r));
    },
    async get(uid, chatId) {
      const r = rows.get(chatId);
      return r && r.uid === uid ? ({ ...view(chatId, r), messages: structuredClone(r.messages) } as never) : null;
    },
    async ownerOf(chatId) {
      return rows.get(chatId)?.uid ?? null;
    },
    async upsert(uid, chatId, data) {
      const r = rows.get(chatId);
      if (r && r.uid !== uid) return "foreign";
      rows.set(chatId, { uid, title: r?.title ?? data.title, messages: structuredClone(data.messages), updatedAt: new Date() });
      return "ok";
    },
    async remove(uid, chatId) {
      const r = rows.get(chatId);
      if (!r || r.uid !== uid) return false;
      return rows.delete(chatId);
    },
  };
}
