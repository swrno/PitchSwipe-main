/** Browser-side helpers for the swipe screens. Client-safe (no server imports). */
import type { Answer } from "@/types";
import type { Industry } from "@/shared/lib/lists";
import type { NextCardResponse, SubmitSuccess } from "../types";

const GUID_KEY = "pitchswipe.swiper";

function randomGuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Random per-browser id used for the Flagsmith identity of guests (signed-in swipers use their user id). */
export function getSwiperGuid(): string {
  try {
    const existing = window.localStorage.getItem(GUID_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const fresh = randomGuid();
    window.localStorage.setItem(GUID_KEY, fresh);
    return fresh;
  } catch {
    return randomGuid();
  }
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function fetchNextCard(
  fetcher: Fetcher,
  input: { swiperGuid: string; firstSlug?: string; interests: Industry[]; seen: string[] },
): Promise<NextCardResponse> {
  const res = await fetcher("/api/responses/next", json(input));
  const data = (await res.json().catch(() => null)) as (NextCardResponse & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? "Could not load the next idea.");
  return data;
}

export type AnswerResult =
  | { kind: "saved"; result: SubmitSuccess }
  | { kind: "ignored" }
  | { kind: "duplicate" };

export async function sendAnswer(
  fetcher: Fetcher,
  input: {
    swiperGuid: string;
    deckId: string;
    cardId: string;
    answer: Answer;
    /** The signed token from fetchNextCard. The server derives source, card and dwell from it. */
    token: string;
  },
): Promise<AnswerResult> {
  const res = await fetcher("/api/responses", json(input));
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 409) return { kind: "duplicate" };
  if (res.ok && data?.ignored) return { kind: "ignored" };
  if (res.status === 201 && data) return { kind: "saved", result: data as unknown as SubmitSuccess };
  throw new Error(typeof data?.error === "string" ? data.error : "Could not save your answer.");
}
