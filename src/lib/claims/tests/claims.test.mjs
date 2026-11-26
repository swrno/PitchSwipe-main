// Run: node --import ./scripts/register-ts.mjs --test src/lib/claims/tests/claims.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUDIO_RETENTION_DAYS,
  canClaim,
  cleanComment,
  clampVoiceSeconds,
  deleteAfterFor,
  isAudioExpired,
  playableAudio,
  shouldSendClaimToFlagsmith,
  walletNoteFor,
  withdrawProgress,
} from "../rules.ts";
import { buildVoiceRecord, claimReward, creditSwipe, saveComment } from "../service.ts";
import { memoryClaimsStore } from "../store-memory.ts";
import { VoiceUnavailableError, transcribeRequest } from "../client.ts";
import { memorySwipeStore } from "../../swipe/store-memory.ts";
import { signServedToken } from "../../swipe/token.ts";
import { demoDecks } from "../../swipe/demo.ts";
import { buildWalletView } from "../../wallet/view.ts";

describe("rules", () => {
  it("claims need a valid counted yes", () => {
    assert.equal(canClaim({ answer: "positive", valid: true, counted: true }), true);
    assert.equal(canClaim({ answer: "negative", valid: true, counted: true }), false);
    assert.equal(canClaim({ answer: "positive", valid: false, counted: false }), false);
    assert.equal(canClaim({ answer: "positive", valid: true, counted: false }), false);
  });
  it("reward_claim reaches Flagsmith only for valid + counted on a live deck", () => {
    assert.equal(shouldSendClaimToFlagsmith({ valid: true, counted: true, deckLive: true }), true);
    assert.equal(shouldSendClaimToFlagsmith({ valid: true, counted: false, deckLive: true }), false);
    assert.equal(shouldSendClaimToFlagsmith({ valid: false, counted: true, deckLive: true }), false);
    assert.equal(shouldSendClaimToFlagsmith({ valid: true, counted: true, deckLive: false }), false);
    // A local-split deck (no experimentId) never sends events.
    assert.equal(shouldSendClaimToFlagsmith({ valid: true, counted: true, deckLive: true, onFlagsmith: false }), false);
    assert.equal(shouldSendClaimToFlagsmith({ valid: true, counted: true, deckLive: true, exposed: false }), false);
  });
  it("audio is marked for deletion 30 days after recording", () => {
    const at = new Date("2026-11-15T10:00:00Z");
    const del = deleteAfterFor(at);
    assert.equal(AUDIO_RETENTION_DAYS, 30);
    assert.equal(del.toISOString(), "2026-12-15T10:00:00.000Z");
    assert.equal(isAudioExpired(del, new Date("2026-12-15T09:59:59Z")), false);
    assert.equal(isAudioExpired(del, new Date("2026-12-15T10:00:00Z")), true);
    assert.equal(isAudioExpired(undefined), false);
  });
  it("cleans comments and caps voice length", () => {
    assert.equal(cleanComment("   "), undefined);
    assert.equal(cleanComment("  hi   there "), "hi there");
    assert.equal(cleanComment("x".repeat(900)).length, 500);
    assert.equal(clampVoiceSeconds(45), 30);
    assert.equal(clampVoiceSeconds(-3), 0);
  });
  it("wallet notes and withdraw progress", () => {
    assert.equal(walletNoteFor({ paid: true, valid: true, counted: true }), "valid");
    assert.equal(walletNoteFor({ paid: false, valid: true, counted: true }), "unpaid");
    assert.equal(walletNoteFor({ paid: true, valid: false, counted: false }), "too_fast");
    assert.equal(walletNoteFor({ paid: true, valid: true, counted: false }), "not_counted");
    assert.deepEqual(withdrawProgress(46.75), { fraction: 0.4675, remainingRs: 53.25 });
  });
});

describe("voice record", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  const base = { durationSec: 12, language: "Bengali", transcript: "bn", english: "en" };
  it("keeps no audio without consent", () => {
    const r = buildVoiceRecord({ ...base, founderCanPlay: false, audioBase64: "QUJD", audioMime: "audio/webm" }, now);
    assert.equal(r.audioUrl, undefined);
    assert.equal(r.deleteAfter, undefined);
    assert.equal(r.founderCanPlay, false);
  });
  it("keeps audio with consent and marks deleteAfter", () => {
    const r = buildVoiceRecord({ ...base, founderCanPlay: true, audioBase64: "QUJD", audioMime: "audio/webm;codecs=opus" }, now);
    assert.equal(r.audioUrl, "data:audio/webm;codecs=opus;base64,QUJD");
    assert.equal(r.deleteAfter.toISOString(), "2026-12-15T00:00:00.000Z");
  });
  it("rejects bad mime and empty text", () => {
    assert.ok("error" in buildVoiceRecord({ ...base, founderCanPlay: true, audioBase64: "QUJD", audioMime: "text/html" }, now));
    assert.ok("error" in buildVoiceRecord({ ...base, transcript: "", english: "", founderCanPlay: false }, now));
  });
});

/* End to end with the in-memory stores. */

const g = globalThis;
function seedResponse(over) {
  g.__pitchswipeSwipeDemo ??= { decks: demoDecks(), responses: new Map(), seq: 1 };
  const deck = g.__pitchswipeSwipeDemo.decks.find((d) => d.status === "live");
  const id = `r-${Math.random().toString(36).slice(2)}`;
  const rec = {
    id,
    deckId: deck.id,
    cardId: deck.cards[0].id,
    swiperKey: "swiper-1",
    source: "feed",
    answer: "positive",
    valid: true,
    counted: true,
    exposedToFlagsmith: true,
    ...over,
  };
  g.__pitchswipeSwipeDemo.responses.set(`${rec.deckId}|${id}`, rec);
  return { rec, deck, token: tokenFor(rec) };
}

const SECRET = "test-secret-0123456789abcdef";
const NOW = Date.parse("2026-11-15T00:00:00Z");
/** The token the swipe route would have issued for this stored response. */
const tokenFor = (rec, over = {}) =>
  signServedToken(SECRET, over.key ?? rec.swiperKey, {
    deckId: rec.deckId,
    cardKey: rec.cardId,
    servedAt: NOW - 60_000,
    source: rec.source,
  });

/** The demo swipe store with decks marked as running on Flagsmith (experimentId), unless `experimentId` is null. */
function swipeStoreWith(experimentId) {
  const tag = (deck) => (deck && experimentId ? { ...deck, experimentId } : deck);
  return {
    ...memorySwipeStore,
    getDeckById: async (id) => tag(await memorySwipeStore.getDeckById(id)),
    getDeckBySlug: async (slug) => tag(await memorySwipeStore.getDeckBySlug(slug)),
  };
}

function deps(over = {}, experimentId = "42") {
  const tracked = [];
  return {
    tracked,
    deps: {
      store: memoryClaimsStore,
      swipeStore: swipeStoreWith(experimentId),
      trackRewardClaim: async (i) => void tracked.push(i),
      paidSwiping: async () => true,
      now: () => NOW,
      secret: SECRET,
      ...over,
    },
  };
}

const ctx = { swiperKey: "swiper-1", email: "Priya.N@Example.com", emailVerified: true };

describe("claimReward", () => {
  it("a local-split deck (no experimentId) stores the claim but sends nothing to Flagsmith", async () => {
    const { rec, token } = seedResponse({});
    const { deps: d, tracked } = deps({}, null);
    const out = await claimReward(d, { responseId: rec.id, token }, { ...ctx, email: "local.split@example.com" });
    assert.equal(out.ok, true);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(tracked.length, 0);
  });

  it("no reward_claim when Flagsmith never accepted the swiper's exposure (same population as answer_positive)", async () => {
    const { rec, token } = seedResponse({ exposedToFlagsmith: undefined });
    const { deps: d, tracked } = deps();
    const out = await claimReward(d, { responseId: rec.id, token }, { ...ctx, email: "not.exposed@example.com" });
    assert.equal(out.ok, true);
    assert.equal(out.sentToFlagsmith, false);
    assert.equal(tracked.length, 0);
  });

  it("stores the claim and sends reward_claim for a valid counted swipe", async () => {
    const { rec, token } = seedResponse({});
    const { deps: d, tracked } = deps();
    const out = await claimReward(d, { responseId: rec.id, token }, ctx);
    assert.equal(out.ok, true);
    assert.equal(out.email, "priya.n@example.com");
    assert.equal(out.sentToFlagsmith, true);
    assert.equal(tracked.length, 1);
    // a repeat does not double-send
    const again = await claimReward(d, { responseId: rec.id, token }, ctx);
    assert.equal(again.alreadyClaimed, true);
    assert.equal(tracked.length, 1);
  });
  it("refuses not-counted, invalid, negative, foreign and unverified claims without calling Flagsmith", async () => {
    const { deps: d, tracked } = deps();
    for (const over of [{ counted: false }, { valid: false, counted: false }, { answer: "negative" }]) {
      const { rec, token } = seedResponse(over);
      const out = await claimReward(d, { responseId: rec.id, token }, ctx);
      assert.equal(out.ok, false);
      assert.equal(out.status, 400);
    }
    const { rec, token } = seedResponse({});
    assert.equal((await claimReward(d, { responseId: rec.id, token }, { ...ctx, swiperKey: "someone-else" })).status, 403);
    assert.equal((await claimReward(d, { responseId: rec.id, token }, { swiperKey: "swiper-1", emailVerified: false })).status, 401);
    assert.equal((await claimReward(d, { responseId: "nope", token }, ctx)).status, 404);
    assert.equal(tracked.length, 0);
  });
  it("H3: claims need a valid served token for this swiper, deck and card", async () => {
    const { rec } = seedResponse({});
    const other = seedResponse({});
    const { deps: d, tracked } = deps();
    const stale = signServedToken(SECRET, "swiper-1", {
      deckId: rec.deckId,
      cardKey: rec.cardId,
      servedAt: NOW - 25 * 3_600_000,
      source: "feed",
    });
    const wrongCard = signServedToken(SECRET, "swiper-1", { deckId: rec.deckId, cardKey: "not-the-card", servedAt: NOW - 1000, source: "feed" });
    const cases = [undefined, "", "junk", stale, wrongCard, tokenFor(rec, { key: "someone-else" })];
    for (const token of cases) {
      const out = await claimReward(d, { responseId: rec.id, token }, ctx);
      assert.equal(out.ok, false);
      assert.equal(out.status, 403);
    }
    assert.equal(tracked.length, 0);
    // a token minted for another response (different card) is not accepted either
    other.rec.cardId = "something-else";
    assert.equal((await claimReward(d, { responseId: other.rec.id, token: other.token }, ctx)).status, 403);
  });
});

describe("saveComment", () => {
  it("stores a typed comment and a voice note, only for the owner", async () => {
    const { rec, token } = seedResponse({});
    const { deps: d } = deps();
    const verified = { emailVerified: true };
    const bad = await saveComment(d, { responseId: rec.id, token, comment: "hi" }, "intruder", verified);
    assert.equal(bad.status, 403);
    assert.equal((await saveComment(d, { responseId: rec.id, comment: "hi" }, "swiper-1", verified)).status, 403, "no token");
    const ok = await saveComment(
      d,
      { responseId: rec.id, token, voice: { durationSec: 12, language: "Bengali", transcript: "bn", english: "Reminders", founderCanPlay: false } },
      "swiper-1",
      verified,
    );
    assert.equal(ok.ok, true);
    const { demoCommentFor } = await import("../store-memory.ts");
    const stored = demoCommentFor(rec.id);
    assert.equal(stored.comment, "Reminders");
    assert.equal(stored.voice.english, "Reminders");
    assert.equal((await saveComment(d, { responseId: rec.id, token }, "swiper-1", verified)).status, 400);
  });

  it("keeps voice notes for verified emails only; a typed comment needs no verification", async () => {
    const { rec, token } = seedResponse({});
    const { deps: d } = deps();
    const unverified = { emailVerified: false };
    const voice = { durationSec: 5, language: "Hindi", transcript: "hi", english: "Hello", founderCanPlay: true, audioBase64: "AAAA", audioMime: "audio/webm" };
    const refused = await saveComment(d, { responseId: rec.id, token, voice }, "swiper-1", unverified);
    assert.equal(refused.ok, false);
    assert.equal(refused.status, 403);
    assert.match(refused.error, /Verify your email/);
    const typed = await saveComment(d, { responseId: rec.id, token, comment: "Add UPI" }, "swiper-1", unverified);
    assert.equal(typed.ok, true);
    const { demoCommentFor } = await import("../store-memory.ts");
    assert.equal(demoCommentFor(rec.id).voice, undefined);
  });
});

describe("wallet", () => {
  it("credits Rs 0.25 once for a valid counted swipe on a paid deck", async () => {
    const { rec, deck, token } = seedResponse({});
    deck.boost = { perSwipe: 0.25, budget: 100, spent: 0 };
    const { deps: d } = deps();
    assert.equal((await creditSwipe(d, rec.id, "swiper-1", undefined)).status, 403, "token required");
    const first = await creditSwipe(d, rec.id, "swiper-1", token);
    assert.equal(first.earnedRs, 0.25);
    assert.equal(first.credited, true);
    const second = await creditSwipe(d, rec.id, "swiper-1", token);
    assert.equal(second.credited, false);
    assert.equal(second.balanceRs, first.balanceRs);
  });
  it("earns nothing on unpaid decks, link swipes, not-counted and invalid swipes", async () => {
    const { rec, deck, token } = seedResponse({});
    deck.boost = { perSwipe: 0, budget: 0, spent: 0 };
    const { deps: d } = deps();
    const cases = [
      [{}, "unpaid"],
      [{ counted: false }, "not_counted"],
      [{ valid: false, counted: false }, "too_fast"],
    ];
    assert.equal((await creditSwipe(d, rec.id, "swiper-1", token)).earnedRs, 0);
    for (const [over, note] of cases.slice(1)) {
      const r = seedResponse(over);
      r.deck.boost = { perSwipe: 0.25, budget: 100, spent: 0 };
      const out = await creditSwipe(d, r.rec.id, "swiper-1", r.token);
      assert.equal(out.earnedRs, 0);
      assert.equal(out.note, note);
    }
    const link = seedResponse({ source: "link" });
    link.deck.boost = { perSwipe: 0.25, budget: 100, spent: 0 };
    assert.equal((await creditSwipe(d, link.rec.id, "swiper-1", link.token)).earnedRs, 0);
    // paid_swiping kill switch off
    const killed = seedResponse({});
    killed.deck.boost = { perSwipe: 0.25, budget: 100, spent: 0 };
    assert.equal((await creditSwipe(deps({ paidSwiping: async () => false }).deps, killed.rec.id, "swiper-1", killed.token)).earnedRs, 0);
  });
  it("builds the demo wallet view labelled Demo earnings", async () => {
    const record = await memoryClaimsStore.getWallet("view-test");
    const view = buildWalletView(record, { now: Date.now(), counting: true, qualityScore: 82, demo: true });
    assert.equal(view.label, "Demo earnings");
    assert.equal(view.balanceRs, 46.75);
    assert.equal(view.entries[0].title, "Voice Khata");
    assert.match(view.entries[0].detail, /1 valid swipe · today/);
  });
});

describe("wallet view: today and history (real data only)", () => {
  const NOW = Date.parse("2026-11-16T10:00:00Z"); // 15:30 IST on 16 Nov
  const entry = (id, amountRs, note, at) => ({
    responseId: id, deckId: id, title: id, amountRs, note, swipeCount: 1, createdAt: new Date(at),
  });
  const base = { balanceRs: 0, weeklyBaseRs: 0, weeklyBaseSwipes: 0, todayBaseRs: 0, todayBaseSwipes: 0 };
  const opts = { now: NOW, counting: true, demo: false };

  it("real mode with no entries is exactly zero, never a fixture number", () => {
    const view = buildWalletView({ ...base, entries: [] }, opts);
    assert.equal(view.todayRs, 0);
    assert.equal(view.todayValidSwipes, 0);
    assert.equal(view.balanceRs, 0);
    assert.equal(view.entries.length, 0);
  });
  it("counts only today's (India time) credited entries", () => {
    const entries = [
      entry("a", 0.25, "valid", "2026-11-16T09:00:00Z"),
      entry("b", 0.25, "valid", "2026-11-15T19:00:00Z"), // 00:30 IST on the 16th: today
      entry("c", 0.25, "valid", "2026-11-15T18:00:00Z"), // 23:30 IST on the 15th: yesterday
      entry("d", 0, "too_fast", "2026-11-16T09:30:00Z"),
      entry("e", 0, "unpaid", "2026-11-16T09:31:00Z"),
    ];
    const view = buildWalletView({ ...base, balanceRs: 0.75, entries }, opts);
    assert.equal(view.todayRs, 0.5);
    assert.equal(view.todayValidSwipes, 2);
    assert.equal(view.weeklyRs, 0.75);
    assert.equal(view.weeklyValidSwipes, 3);
  });
  it("demo bases (design phone 33) are added to live swipes", () => {
    const entries = [entry("a", 0.25, "valid", "2026-11-16T09:00:00Z")];
    const view = buildWalletView({ ...base, todayBaseRs: 6.25, todayBaseSwipes: 25, entries }, { ...opts, demo: true });
    assert.equal(view.todayRs, 6.5);
    assert.equal(view.todayValidSwipes, 26);
  });
  it("demo history matches design phone 41 (LoadMate too fast, StitchUp unpaid)", async () => {
    const record = await memoryClaimsStore.getWallet("history-test");
    assert.equal(record.todayBaseRs, 6.25);
    assert.equal(record.todayBaseSwipes, 25);
    const byTitle = Object.fromEntries(record.entries.map((e) => [e.title, e.note]));
    assert.equal(byTitle.LoadMate, "too_fast");
    assert.equal(byTitle.StitchUp, "unpaid");
  });
});

describe("audio retention (M2)", () => {
  const past = new Date("2026-11-01T00:00:00Z");
  const future = new Date("2026-12-01T00:00:00Z");
  const now = new Date("2026-11-15T00:00:00Z");

  it("playableAudio needs consent and an unexpired deleteAfter", () => {
    const base = { audioUrl: "data:audio/webm;base64,QUJD", founderCanPlay: true };
    assert.equal(playableAudio({ ...base, deleteAfter: future }, now), base.audioUrl);
    assert.equal(playableAudio({ ...base, deleteAfter: past }, now), undefined, "expired");
    assert.equal(playableAudio({ ...base, deleteAfter: now }, now), undefined, "expires at the mark");
    assert.equal(playableAudio({ ...base, founderCanPlay: false, deleteAfter: future }, now), undefined, "no consent");
    assert.equal(playableAudio({ founderCanPlay: true }, now), undefined);
    assert.equal(playableAudio(undefined, now), undefined);
  });

  it("the store read path hides expired audio and the purge clears it", async () => {
    const { rec } = seedResponse({});
    const { deps: d } = deps();
    const voice = (deleteAfter) => ({ durationSec: 5, language: "Hindi", transcript: "a", english: "b", founderCanPlay: true, audioUrl: "data:audio/webm;base64,QUJD", deleteAfter });
    await d.store.setComment(rec.id, { voice: voice(past) });
    assert.equal(await d.store.getPlayableAudio(rec.id, now), undefined);
    const live = seedResponse({});
    await d.store.setComment(live.rec.id, { voice: voice(future) });
    assert.ok(await d.store.getPlayableAudio(live.rec.id, now));
    const cleared = await d.store.purgeExpiredAudio(now);
    assert.ok(cleared >= 1);
    const { demoCommentFor } = await import("../store-memory.ts");
    assert.equal(demoCommentFor(rec.id).voice.audioUrl, undefined);
    assert.equal(demoCommentFor(rec.id).voice.deleteAfter, undefined);
    assert.equal(demoCommentFor(rec.id).voice.english, "b", "the text stays");
    assert.ok(demoCommentFor(live.rec.id).voice.audioUrl, "unexpired audio is kept");
  });

  it("the cron guard is closed without CRON_SECRET and needs the exact bearer secret", async () => {
    const { cronAuth } = await import("../cron.ts");
    assert.equal(cronAuth("Bearer anything", undefined), "unconfigured");
    assert.equal(cronAuth(null, "cron-secret-123"), "unauthorized");
    assert.equal(cronAuth("Bearer cron-secret-124", "cron-secret-123"), "unauthorized");
    assert.equal(cronAuth("cron-secret-123", "cron-secret-123"), "unauthorized");
    assert.equal(cronAuth("Bearer cron-secret-123", "cron-secret-123"), "ok");
  });

  it("M1: a duplicate claim is an idempotent already-claimed (memory store)", async () => {
    const first = await memoryClaimsStore.saveClaim({ deckId: "dup-deck", cardId: "c", email: "a@b.co", createdAt: new Date() });
    const second = await memoryClaimsStore.saveClaim({ deckId: "dup-deck", cardId: "c", email: "a@b.co", createdAt: new Date() });
    assert.equal(first.saved, true);
    assert.equal(second.saved, false);
  });
});

describe("transcribeRequest", () => {
  const input = { swiperGuid: "abcdefgh12", text: "namaste", languageCode: "hi-IN", durationSec: 3 };
  it("sends the text as JSON with the Firebase ID token as a bearer header, and no audio", async () => {
    const realFetch = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url, init) => {
      seen.push({ url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ transcript: "a", english: "b", language: "Hindi" }), { status: 200 });
    };
    let out;
    try {
      const never = async () => assert.fail("with a token the request goes out directly");
      out = await transcribeRequest(never, { ...input, idToken: "tok-1" });
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.equal(seen[0].url, "/api/voice/transcribe");
    assert.equal(seen[0].headers.get("authorization"), "Bearer tok-1");
    assert.equal(seen[0].headers.get("content-type"), "application/json");
    assert.deepEqual(seen[0].body, { text: "namaste", languageCode: "hi-IN", durationSec: 3, swiperGuid: "abcdefgh12" });
    assert.deepEqual(out, { transcript: "a", english: "b", language: "Hindi" });
  });
  it("maps 503 not_configured to VoiceUnavailableError and other failures to an Error", async () => {
    const answer = (status, body) => async () => new Response(JSON.stringify(body), { status });
    await assert.rejects(
      transcribeRequest(answer(503, { code: "not_configured", error: "Not set up." }), input),
      (e) => e instanceof VoiceUnavailableError && e.message === "Not set up.",
    );
    await assert.rejects(transcribeRequest(answer(429, { error: "Too many voice notes." }), input), /Too many voice notes/);
  });
});
