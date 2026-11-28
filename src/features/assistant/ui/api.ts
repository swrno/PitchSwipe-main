"use client";

import { isFirebaseClientConfigured } from "@/features/auth/config";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";

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

export class AssistantApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** JSON call to our own API with the Firebase token (none when signed out). */
export async function assistantJson<T>(method: "GET" | "POST" | "DELETE", url: string, body?: unknown): Promise<T> {
  const token = await idToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new AssistantApiError(data.error ?? "Something went wrong. Try again.", res.status);
  return data as T;
}

export const deckApi = (deckId: string) => `/api/decks/${encodeURIComponent(deckId)}/ship`;
