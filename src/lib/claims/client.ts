/** Browser-side helpers for the claim, comment, voice and wallet screens. Client-safe (no server imports). */
import { MAX_COMMENT_CHARS, type WalletView } from "./rules";

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
}

const errorOf = (data: Record<string, unknown>, fallback: string) => (typeof data.error === "string" ? data.error : fallback);

export async function claimRewardRequest(
  fetcher: Fetcher,
  input: { swiperGuid: string; responseId: string; token: string },
): Promise<{ alreadyClaimed: boolean }> {
  const res = await fetcher("/api/claims", post(input));
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorOf(data, "Could not claim the reward."));
  return { alreadyClaimed: data.alreadyClaimed === true };
}

export interface VoiceDraft {
  durationSec: number;
  language: string;
  transcript: string;
  english: string;
  founderCanPlay: boolean;
  audio?: Blob;
}

export interface TranscriptionResult {
  transcript: string;
  english: string;
  language: string;
}

/** The voice route said no. `status` and `code` (for example 403 "unverified", 429 "rate_limited") say why. */
export class VoiceRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "VoiceRequestError";
    this.status = status;
    this.code = code;
  }
}

export class VoiceUnavailableError extends VoiceRequestError {}

/** Adds spoken words to what the swiper already typed, within the comment limit. */
export function appendComment(typed: string, words: string): string {
  const joined = typed.trim() ? `${typed.trimEnd()} ${words.trim()}` : words.trim();
  return joined.slice(0, MAX_COMMENT_CHARS);
}

/** The part of a Firebase user that voiceIdToken needs (tests pass a fake). */
export interface IdTokenUser {
  emailVerified: boolean;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(): Promise<{ token: string; claims: Record<string, unknown> }>;
}

/**
 * The ID token for the voice route, which reads email_verified from the token. On startup Firebase reloads the
 * user, so emailVerified can already be true while the cached token (up to an hour old) still says false. In that
 * case the token is refreshed first, as founder-gate.tsx does; Firebase keeps the fresh one for later calls too.
 */
export async function voiceIdToken(user: IdTokenUser): Promise<string> {
  const current = await user.getIdTokenResult();
  if (!user.emailVerified || current.claims.email_verified === true) return current.token;
  return user.getIdToken(true);
}

/**
 * Sends what the browser heard (text only, no audio) for an English version. The route needs the Firebase ID
 * token (verified email), so with a token the request carries it directly. `english` is "" when the server has no
 * AI key or the translation failed a check: the swiper then types it. `signal` cancels the request.
 */
export async function transcribeRequest(
  fetcher: Fetcher,
  input: { swiperGuid: string; text: string; languageCode: string; durationSec: number; idToken?: string; signal?: AbortSignal },
): Promise<TranscriptionResult> {
  const init: RequestInit = {
    ...post({
      text: input.text,
      languageCode: input.languageCode,
      durationSec: input.durationSec,
      swiperGuid: input.swiperGuid,
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  };
  const res = input.idToken
    ? await fetch("/api/voice/transcribe", {
        ...init,
        headers: { "content-type": "application/json", authorization: `Bearer ${input.idToken}` },
      })
    : await fetcher("/api/voice/transcribe", init);
  const data = await readJson(res);
  // readJson swallows a body cut short by an abort; do not mistake that for an empty answer.
  input.signal?.throwIfAborted();
  const code = typeof data.code === "string" ? data.code : "";
  if (res.status === 503 && code === "not_configured") {
    throw new VoiceUnavailableError(errorOf(data, "Voice notes are not available. Type your comment instead."), res.status, code);
  }
  if (!res.ok) throw new VoiceRequestError(errorOf(data, "Could not get the English for that voice note."), res.status, code);
  return {
    transcript: String(data.transcript ?? ""),
    english: String(data.english ?? ""),
    language: String(data.language ?? "Unknown language"),
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

export async function saveCommentRequest(
  fetcher: Fetcher,
  input: { swiperGuid: string; responseId: string; token: string; comment?: string; voice?: VoiceDraft | null },
): Promise<void> {
  const { voice } = input;
  const body: Record<string, unknown> = {
    swiperGuid: input.swiperGuid,
    responseId: input.responseId,
    token: input.token,
    comment: input.comment,
  };
  if (voice) {
    body.voice = {
      durationSec: voice.durationSec,
      language: voice.language,
      transcript: voice.transcript,
      english: voice.english,
      founderCanPlay: voice.founderCanPlay,
      // Audio leaves the browser again only when the swiper ticked the consent box.
      ...(voice.founderCanPlay && voice.audio
        ? { audioBase64: await blobToBase64(voice.audio), audioMime: voice.audio.type.split(";")[0] || "audio/webm" }
        : {}),
    };
  }
  const res = await fetcher("/api/claims/comment", post(body));
  if (!res.ok) throw new Error(errorOf(await readJson(res), "Could not save your comment."));
}

/** Credit the demo wallet for one answer (the server decides the amount; repeats are ignored). */
export async function creditWalletRequest(
  fetcher: Fetcher,
  input: { swiperGuid: string; responseId: string; token: string },
): Promise<{ earnedRs: number; balanceRs: number } | null> {
  const res = await fetcher("/api/claims/wallet", post(input)).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await readJson(res);
  return { earnedRs: Number(data.earnedRs ?? 0), balanceRs: Number(data.balanceRs ?? 0) };
}

export async function fetchWallet(fetcher: Fetcher, swiperGuid: string): Promise<WalletView> {
  const res = await fetcher(`/api/claims/wallet?swiperGuid=${encodeURIComponent(swiperGuid)}`);
  const data = await readJson(res);
  if (!res.ok || !data.wallet) throw new Error(errorOf(data, "Could not load your wallet."));
  return data.wallet as WalletView;
}

/** First name for "Arjun will contact you". */
export function founderFirstName(ownerName: string | undefined): string {
  return ownerName?.trim().split(/\s+/)[0] || "the founder";
}
