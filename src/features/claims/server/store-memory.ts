/**
 * In-memory claims store: an empty test double (never used by the running app). Responses are read from a
 * memory swipe store passed in; comments and wallets live here.
 */
import { isAudioExpired, playableAudio, roundRs } from "../rules";
import type { ClaimsStore, CommentPatch, StoredResponse, WalletEntryRecord, WalletRecord } from "./store";
import type { ResponseRecord } from "@/features/swipe/server/store";

type ResponseRow = ResponseRecord & { id: string };

export interface MemoryClaimsStore extends ClaimsStore {
  /** Test helper: the comment stored for a response. */
  commentFor(responseId: string): CommentPatch | undefined;
}

export function createMemoryClaimsStore(responses: () => Iterable<ResponseRow> = () => []): MemoryClaimsStore {
  const claims = new Set<string>();
  const comments = new Map<string, CommentPatch>();
  const wallets = new Map<string, { balanceRs: number; entries: WalletEntryRecord[]; credited: Set<string> }>();

  function wallet(key: string) {
    let w = wallets.get(key);
    if (!w) {
      w = { balanceRs: 0, entries: [], credited: new Set() };
      wallets.set(key, w);
    }
    return w;
  }

  return {
    async getResponse(id): Promise<StoredResponse | null> {
      const found = [...responses()].find((r) => r.id === id);
      return found
        ? {
            id: found.id,
            swiperKey: found.swiperKey,
            deckId: found.deckId,
            cardId: found.cardId,
            answer: found.answer,
            valid: found.valid,
            counted: found.counted,
            source: found.source,
            exposedToFlagsmith: found.exposedToFlagsmith === true,
          }
        : null;
    },

    isOwner: (response, swiperKey) => response.swiperKey === swiperKey,

    async saveClaim(input) {
      const key = `${input.deckId}|${input.email}`;
      if (claims.has(key)) return { saved: false };
      claims.add(key);
      return { saved: true };
    },

    async setComment(responseId, patch) {
      comments.set(responseId, { ...comments.get(responseId), ...patch });
    },

    async creditWallet(swiperKey, entry) {
      const w = wallet(swiperKey);
      if (w.credited.has(entry.responseId)) return { credited: false, balanceRs: w.balanceRs };
      w.credited.add(entry.responseId);
      w.entries.unshift(entry);
      w.balanceRs = roundRs(w.balanceRs + entry.amountRs);
      return { credited: true, balanceRs: w.balanceRs };
    },

    async getPlayableAudio(responseId, now) {
      return playableAudio(comments.get(responseId)?.voice, now);
    },

    async purgeExpiredAudio(now) {
      let cleared = 0;
      for (const patch of comments.values()) {
        const voice = patch.voice;
        if (voice?.audioUrl && isAudioExpired(voice.deleteAfter, now)) {
          delete voice.audioUrl;
          delete voice.deleteAfter;
          cleared++;
        }
      }
      return cleared;
    },

    async listAnswers(swiperKey, { before, limit }) {
      return [...responses()]
        .filter((r) => r.swiperKey === swiperKey && (!before || r.createdAt.getTime() < before.getTime()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
        .map((r) => ({
          responseId: r.id,
          deckId: r.deckId,
          cardId: r.cardId,
          answer: r.answer,
          valid: r.valid,
          counted: r.counted,
          createdAt: r.createdAt,
        }));
    },

    async claimedDeckIds(deckIds, email) {
      return new Set(deckIds.filter((id) => claims.has(`${id}|${email}`)));
    },

    async getWallet(swiperKey): Promise<WalletRecord> {
      const w = wallet(swiperKey);
      return { balanceRs: w.balanceRs, entries: structuredClone(w.entries) };
    },

    commentFor: (responseId) => comments.get(responseId),
  };
}
