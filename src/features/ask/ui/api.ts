"use client";

import { isFirebaseClientConfigured } from "@/features/auth/config";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";
import type { AskHeader } from "../types";

export type { AskHeader };
export interface AskIntro {
  header: AskHeader | null;
  suggestions: string[];
}

/**
 * fetch with the founder's Firebase ID token (what useAuth().authFetch adds). Without a Firebase user the request
 * goes out as is and the API answers 401, instead of throwing.
 */
export async function askFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (isFirebaseClientConfigured()) {
    try {
      const auth = getFirebaseClientAuth();
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (token) headers.set("authorization", `Bearer ${token}`);
    } catch {
      // Not signed in: the API answers 401 and the panel shows the error.
    }
  }
  return fetch(input, { ...init, headers });
}

/** Header numbers and suggested questions. No deckId: the server uses the founder's newest deck. */
export async function loadAskIntro(deckId?: string | null): Promise<AskIntro> {
  const res = await askFetch(`/api/ask${deckId ? `?deckId=${encodeURIComponent(deckId)}` : ""}`);
  const data = (await res.json().catch(() => ({}))) as Partial<AskIntro> & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not load the chat.");
  return { header: data.header ?? null, suggestions: data.suggestions ?? [] };
}
