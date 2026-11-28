/**
 * Claim, comment and wallet logic with injected dependencies, so the rules are unit-testable with fakes.
 * Server only. Default dependencies are built in server.ts.
 *
 * Everything is derived from the stored response (valid, counted, paid, answer): the browser never says
 * what was earned or whether a swipe counted.
 */
import { earningsFor, isPaidCard } from "@/features/swipe/validity";
import type { SwipeStore } from "@/features/swipe/server/store";
import { CLAIM_TOKEN_MAX_AGE_MS, getSigningSecret, verifyServedToken } from "@/features/swipe/server/token";
import type { SwipeDeck, SwipeSource } from "@/features/swipe/types";
import { HISTORY_PAGE_SIZE, buildHistoryPage, type HistoryPage } from "@/features/claims/history";
import { buildWalletView } from "@/features/claims/wallet-view";
import {
  MAX_AUDIO_BYTES,
  canClaim,
  clampVoiceSeconds,
  cleanComment,
  deleteAfterFor,
  normalizeEmail,
  shouldSendClaimToFlagsmith,
  walletNoteFor,
  type WalletView,
} from "../rules";
import type { ClaimsStore, CommentPatch, StoredResponse, VoiceRecord } from "./store";

export interface ClaimsDeps {
  store: ClaimsStore;
  swipeStore: SwipeStore;
  /** Sends reward_claim to Flagsmith via the wrapper. Only ever called for valid AND counted swipes. */
  trackRewardClaim(input: { deck: SwipeDeck; swiperKey: string; source: SwipeSource }): Promise<void>;
  paidSwiping(): Promise<boolean>;
  now(): number;
  /** HMAC secret for served-card tokens. Defaults to env SWIPE_SIGNING_SECRET. */
  secret?: string;
}

export type ClaimOutcome =
  | { ok: true; claimed: true; alreadyClaimed: boolean; sentToFlagsmith: boolean; founderName?: string; email: string }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/**
 * The response must exist, be the swiper's own, and the caller must present the served-card token that
 * produced it: signed for this swiper, not older than a day, and for the same deck and card as the stored
 * answer. A response row exists once per (deck, swiper), so a token cannot be replayed onto another answer.
 */
async function ownedResponse(
  deps: ClaimsDeps,
  responseId: string,
  swiperKey: string,
  token: unknown,
): Promise<{ response: StoredResponse } | { error: { status: 403 | 404; error: string } }> {
  const response = await deps.store.getResponse(responseId);
  if (!response) return { error: { status: 404, error: "Answer not found." } };
  if (!deps.store.isOwner(response, swiperKey)) return { error: { status: 403, error: "That answer is not yours." } };
  const checked = verifyServedToken(deps.secret ?? getSigningSecret(), swiperKey, token, {
    now: deps.now(),
    maxAgeMs: CLAIM_TOKEN_MAX_AGE_MS,
  });
  if (!checked.ok || checked.claims.deckId !== response.deckId || checked.claims.cardKey !== response.cardId) {
    return { error: { status: 403, error: "That answer could not be verified." } };
  }
  return { response };
}

export interface ClaimContext {
  swiperKey: string;
  /** Verified email from the signed-in profile Undefined for guests. */
  email?: string;
  emailVerified: boolean;
}

export async function claimReward(deps: ClaimsDeps, input: { responseId: string; token?: unknown }, ctx: ClaimContext): Promise<ClaimOutcome> {
  if (!ctx.email || !ctx.emailVerified) {
    return { ok: false, status: 401, error: "Sign in and verify your email to claim a reward." };
  }
  const found = await ownedResponse(deps, input.responseId, ctx.swiperKey, input.token);
  if ("error" in found) return { ok: false, ...found.error };
  const { response } = found;
  if (!canClaim(response)) {
    return { ok: false, status: 400, error: "Only a counted yes answer can claim the reward." };
  }
  const deck = await deps.swipeStore.getDeckById(response.deckId);
  if (!deck) return { ok: false, status: 404, error: "Deck not found." };

  const email = normalizeEmail(ctx.email);
  const saved = await deps.store.saveClaim({
    deckId: response.deckId,
    cardId: response.cardId,
    email,
    createdAt: new Date(deps.now()),
  });

  let sentToFlagsmith = false;
  if (saved.saved && shouldSendClaimToFlagsmith({
      valid: response.valid,
      counted: response.counted,
      deckLive: deck.status === "live",
      onFlagsmith: Boolean(deck.experimentId),
      exposed: response.exposedToFlagsmith === true,
    })) {
    try {
      await deps.trackRewardClaim({ deck, swiperKey: ctx.swiperKey, source: response.source });
      sentToFlagsmith = true;
    } catch {
      sentToFlagsmith = false; // stored in Mongo; Flagsmith unset or down
    }
  }
  return {
    ok: true,
    claimed: true,
    alreadyClaimed: !saved.saved,
    sentToFlagsmith,
    founderName: deck.product.ownerName,
    email,
  };
}

/* Comments (typed and voice). */

export interface VoiceInput {
  durationSec: unknown;
  language: unknown;
  transcript: unknown;
  english: unknown;
  /** The "Let <founder> play my voice note" tick: also the consent to keep the audio. */
  founderCanPlay: unknown;
  audioBase64?: unknown;
  audioMime?: unknown;
}

const AUDIO_MIME = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)(;.*)?$/i;

/** Pure: the commentVoice record to store. Audio is kept only with consent and carries deleteAfter. */
export function buildVoiceRecord(input: VoiceInput, now: Date): VoiceRecord | { error: string } {
  const transcript = cleanComment(input.transcript) ?? "";
  const english = cleanComment(input.english) ?? "";
  if (!transcript && !english) return { error: "The voice note has no text to keep." };
  const consent = input.founderCanPlay === true;
  const record: VoiceRecord = {
    durationSec: clampVoiceSeconds(input.durationSec),
    language: typeof input.language === "string" ? input.language.slice(0, 40) : "Unknown language",
    transcript,
    english,
    founderCanPlay: consent,
  };
  if (consent && typeof input.audioBase64 === "string" && input.audioBase64) {
    const mime = typeof input.audioMime === "string" ? input.audioMime : "";
    const approxBytes = Math.floor((input.audioBase64.length * 3) / 4);
    if (!AUDIO_MIME.test(mime)) return { error: "Unsupported audio type." };
    if (!/^[A-Za-z0-9+/=]+$/.test(input.audioBase64) || approxBytes > MAX_AUDIO_BYTES) {
      return { error: "That audio could not be kept." };
    }
    record.audioUrl = `data:${mime};base64,${input.audioBase64}`;
    record.deleteAfter = deleteAfterFor(now);
  }
  return record;
}

export type CommentOutcome = { ok: true; hasText: boolean } | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * Saves a typed comment and/or a voice note on the swiper's own response. Voice notes (and so their audio) are for
 * signed-in swipers with a verified email only, as the voice route requires; a typed comment needs neither.
 */
export async function saveComment(
  deps: ClaimsDeps,
  input: { responseId: string; token?: unknown; comment?: unknown; voice?: VoiceInput | null },
  swiperKey: string,
  claimant: { emailVerified: boolean },
): Promise<CommentOutcome> {
  const found = await ownedResponse(deps, input.responseId, swiperKey, input.token);
  if ("error" in found) return { ok: false, ...found.error };

  const patch: CommentPatch = {};
  const comment = cleanComment(input.comment);
  if (comment) patch.comment = comment;
  if (input.voice) {
    if (claimant.emailVerified !== true) {
      return { ok: false, status: 403, error: "Verify your email to leave a voice note." };
    }
    const voice = buildVoiceRecord(input.voice, new Date(deps.now()));
    if ("error" in voice) return { ok: false, status: 400, error: voice.error };
    patch.voice = voice;
    // The English line also joins the typed comments the insights read (spec 03 5.14 step 5).
    patch.comment ??= voice.english || voice.transcript;
  }
  if (!patch.comment && !patch.voice) return { ok: false, status: 400, error: "Nothing to save." };
  await deps.store.setComment(input.responseId, patch);
  return { ok: true, hasText: true };
}

/* Wallet. */

export type CreditOutcome =
  | { ok: true; credited: boolean; earnedRs: number; balanceRs: number; note: string }
  | { ok: false; status: 403 | 404; error: string };

/**
 * Credits the wallet for one swipe, once. Earns Rs 0.25 only for a valid, counted swipe on a paid
 * (boosted, feed) card; everything else is recorded at Rs 0 with the reason.
 */
export async function creditSwipe(
  deps: ClaimsDeps,
  responseId: string,
  swiperKey: string,
  token: unknown,
): Promise<CreditOutcome> {
  const found = await ownedResponse(deps, responseId, swiperKey, token);
  if ("error" in found) return { ok: false, ...found.error };
  const { response } = found;
  const deck = await deps.swipeStore.getDeckById(response.deckId);
  if (!deck) return { ok: false, status: 404, error: "Deck not found." };
  const paid = isPaidCard({ source: response.source, boost: deck.boost, paidSwipingFlag: await deps.paidSwiping() });
  const earnedRs = earningsFor({ paid, valid: response.valid, counted: response.counted });
  const note = walletNoteFor({ paid, valid: response.valid, counted: response.counted });
  const result = await deps.store.creditWallet(swiperKey, {
    responseId: response.id,
    deckId: response.deckId,
    title: deck.product.name,
    amountRs: earnedRs,
    note,
    swipeCount: 1,
    createdAt: new Date(deps.now()),
  });
  return { ok: true, credited: result.credited, earnedRs, balanceRs: result.balanceRs, note };
}

export async function walletFor(
  deps: ClaimsDeps,
  swiperKey: string,
  profile: { counting: boolean; qualityScore?: number },
): Promise<WalletView> {
  const record = await deps.store.getWallet(swiperKey);
  return buildWalletView(record, { now: deps.now(), ...profile });
}

/* Request parsing (pure). */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseResponseRef(body: unknown): { responseId: string; token: string } | { error: string } {
  if (!isObject(body)) return { error: "Invalid request body." };
  if (typeof body.responseId !== "string" || !body.responseId || body.responseId.length > 64) {
    return { error: "Missing answer." };
  }
  if (typeof body.token !== "string" || !body.token || body.token.length > 600) return { error: "Missing card token." };
  return { responseId: body.responseId, token: body.token };
}

export function parseCommentBody(
  body: unknown,
): { responseId: string; token: string; comment?: unknown; voice: VoiceInput | null } | { error: string } {
  const ref = parseResponseRef(body);
  if ("error" in ref) return ref;
  const b = body as Record<string, unknown>;
  return { responseId: ref.responseId, token: ref.token, comment: b.comment, voice: isObject(b.voice) ? (b.voice as unknown as VoiceInput) : null };
}

/** One page of a swiper's answers with product, headline, earnings and claim status. Newest first. */
export async function historyFor(
  deps: ClaimsDeps,
  swiperKey: string,
  opts: { before: Date | null; email?: string },
): Promise<HistoryPage> {
  const rows = await deps.store.listAnswers(swiperKey, { before: opts.before, limit: HISTORY_PAGE_SIZE + 1 });
  const deckIds = [...new Set(rows.map((r) => r.deckId))];
  const decks = new Map<string, SwipeDeck>();
  await Promise.all(
    deckIds.map(async (id) => {
      const deck = await deps.swipeStore.getDeckById(id);
      if (deck) decks.set(id, deck);
    }),
  );
  const wallet = await deps.store.getWallet(swiperKey);
  const entries = new Map(wallet.entries.map((e) => [e.responseId, { responseId: e.responseId, amountRs: e.amountRs, note: e.note }]));
  const claimed = opts.email ? await deps.store.claimedDeckIds(deckIds, normalizeEmail(opts.email)) : new Set<string>();
  return buildHistoryPage(rows, decks, entries, claimed);
}
