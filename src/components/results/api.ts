"use client";

import { isFirebaseClientConfigured } from "@/lib/auth/config";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

/** Firebase ID token for our API, or null in demo mode (the API needs no sign-in there). */
async function idToken(): Promise<string | null> {
  if (!isFirebaseClientConfigured()) return null;
  try {
    const auth = getFirebaseClientAuth();
    await auth.authStateReady();
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

async function authedFetch(url: string): Promise<Response> {
  const token = await idToken();
  return fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : undefined });
}

export class ResultsApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function resultsJson<T>(url: string): Promise<T> {
  const res = await authedFetch(url);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ResultsApiError(data.error ?? "Could not load the results. Try again.", res.status);
  return data as T;
}

/** Downloads the deck's waitlist CSV (sends the sign-in token, so a plain link would not work). */
export async function downloadWaitlistCsv(deckId: string): Promise<void> {
  const res = await authedFetch(`/api/results/${encodeURIComponent(deckId)}?format=csv`);
  if (!res.ok) throw new ResultsApiError("Could not download the waitlist. Try again.", res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `waitlist-${deckId}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
