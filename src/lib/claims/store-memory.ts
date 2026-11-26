/**
 * Demo-mode claims store: in-memory (MONGODB_URI unset). State lives on globalThis so every route shares it.
 * Responses are read from the WP3 demo store's state (read only); comments live here.
 */
import { SWIPE_HOME, WALLET } from "@/fixtures";
import { isAudioExpired, playableAudio, roundRs } from "./rules";
import type { ClaimsStore, CommentPatch, StoredResponse, WalletEntryRecord, WalletRecord } from "./store";

interface SwipeDemoResponse {
  id: string;
  swiperKey: string;
  deckId: string;
  cardId: string;
  answer: string;
  valid: boolean;
  counted: boolean;
  source: "feed" | "link";
  exposedToFlagsmith?: boolean;
}

interface ClaimsState {
  claims: Set<string>;
  comments: Map<string, CommentPatch>;
  wallets: Map<string, { balanceRs: number; entries: WalletEntryRecord[]; credited: Set<string> }>;
}

const g = globalThis as unknown as {
  __pitchswipeClaimsDemo?: ClaimsState;
  __pitchswipeSwipeDemo?: { responses: Map<string, SwipeDemoResponse> };
};
const state = (): ClaimsState =>
  (g.__pitchswipeClaimsDemo ??= { claims: new Set(), comments: new Map(), wallets: new Map() });

/** History rows shown in the designs (phone 41, web 36), shown under the swiper's own new swipes. */
function seededEntries(now: Date): WalletEntryRecord[] {
  const row = (title: string, amountRs: number, note: string, daysAgo: number): WalletEntryRecord => ({
    responseId: `seed-${title}`,
    deckId: `seed-${title}`,
    title,
    amountRs,
    note,
    swipeCount: 1,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000),
  });
  return [
    row("Voice Khata", 0.25, "valid", 0),
    row("QueueLess", 0.25, "valid", 0),
    // Design phone 41: LoadMate "Too fast to count", StitchUp "Not boosted - unpaid".
    row("LoadMate", 0, "too_fast", 0),
    row("StitchUp", 0, "unpaid", 1),
  ];
}

function wallet(key: string) {
  const s = state();
  let w = s.wallets.get(key);
  if (!w) {
    w = { balanceRs: WALLET.balanceRs, entries: seededEntries(new Date()), credited: new Set() };
    s.wallets.set(key, w);
  }
  return w;
}

export const memoryClaimsStore: ClaimsStore = {
  demo: true,

  async getResponse(id): Promise<StoredResponse | null> {
    const found = [...(g.__pitchswipeSwipeDemo?.responses.values() ?? [])].find((r) => r.id === id);
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
    const s = state();
    if (s.claims.has(key)) return { saved: false };
    s.claims.add(key);
    return { saved: true };
  },

  async setComment(responseId, patch) {
    const s = state();
    s.comments.set(responseId, { ...s.comments.get(responseId), ...patch });
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
    return playableAudio(state().comments.get(responseId)?.voice, now);
  },

  async purgeExpiredAudio(now) {
    let cleared = 0;
    for (const patch of state().comments.values()) {
      const voice = patch.voice;
      if (voice?.audioUrl && isAudioExpired(voice.deleteAfter, now)) {
        delete voice.audioUrl;
        delete voice.deleteAfter;
        cleared++;
      }
    }
    return cleared;
  },

  async getWallet(swiperKey): Promise<WalletRecord> {
    const w = wallet(swiperKey);
    return {
      balanceRs: w.balanceRs,
      entries: structuredClone(w.entries),
      weeklyBaseRs: WALLET.weeklyRs,
      weeklyBaseSwipes: WALLET.weeklyValidSwipes,
      todayBaseRs: SWIPE_HOME.earnedTodayRs,
      todayBaseSwipes: SWIPE_HOME.validSwipesToday,
    };
  },
};

/** Test helper: comment stored for a response in demo mode. */
export function demoCommentFor(responseId: string): CommentPatch | undefined {
  return state().comments.get(responseId);
}
