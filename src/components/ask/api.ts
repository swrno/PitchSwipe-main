"use client";

import { isFirebaseClientConfigured } from "@/lib/auth/config";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import type { AskAnswer, HistoryTurn } from "@/lib/ask/types";
import type { contextHeader } from "@/lib/ask/data";

export type AskHeader = ReturnType<typeof contextHeader>;
export interface AskIntro {
  header: AskHeader;
  suggestions: string[];
}

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

async function call<T>(url: string, init?: { body?: unknown }): Promise<T> {
  const token = await idToken();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, {
    method: init?.body !== undefined ? "POST" : "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not answer that. Try again.");
  return data as T;
}

export const loadAskIntro = (deckId: string) => call<AskIntro>(`/api/ask?deckId=${encodeURIComponent(deckId)}`);

export const askQuestion = (deckId: string, question: string, history: HistoryTurn[]) =>
  call<AskAnswer>("/api/ask", { body: { deckId, question, history } });
