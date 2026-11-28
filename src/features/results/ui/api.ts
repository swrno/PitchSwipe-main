"use client";

import { isFirebaseClientConfigured } from "@/features/auth/config";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";

/** Firebase ID token for our API, or null when not signed in. */
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

export interface WaitlistRow {
  email: string;
  card: string;
  claimedAt: string;
}

/** Splits one CSV record into cells (handles quoted cells and doubled quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Every waitlist row, read from the same CSV the download uses (newest first). */
export async function fetchWaitlistRows(deckId: string): Promise<WaitlistRow[]> {
  const res = await authedFetch(`/api/results/${encodeURIComponent(deckId)}?format=csv`);
  if (!res.ok) throw new ResultsApiError("Could not load the waitlist. Try again.", res.status);
  return parseCsv(await res.text())
    .slice(1)
    .map(([email, card, claimedAt]) => ({ email: email ?? "", card: card ?? "", claimedAt: claimedAt ?? "" }));
}
