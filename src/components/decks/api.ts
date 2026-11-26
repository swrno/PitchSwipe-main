"use client";

import { isFirebaseClientConfigured } from "@/lib/auth/config";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import type { FieldError } from "@/lib/decks/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: FieldError[] = [],
  ) {
    super(message);
  }
}

async function idToken(): Promise<string | null> {
  if (!isFirebaseClientConfigured()) return null; // demo mode: the API needs no sign-in
  try {
    const auth = getFirebaseClientAuth();
    await auth.authStateReady();
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

/** JSON call to our own API. Adds the Firebase ID token when there is one. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await idToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; errors?: FieldError[] };
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong. Try again.", res.status, data.errors);
  return data as T;
}

/** First error message for a path (or any path starting with it). */
export function errorFor(errors: FieldError[], path: string): string | undefined {
  return errors.find((e) => e.path === path || e.path.startsWith(`${path}.`))?.message;
}
