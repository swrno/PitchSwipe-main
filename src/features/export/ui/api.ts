"use client";

import { isFirebaseClientConfigured } from "@/features/auth/config";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";
import type { ExportPreview } from "@/features/export/preview";
import type { ExportFile, ExportScope } from "@/features/export/types";

export interface ExportOptions {
  deckLabel: string;
  /** Decks the "Whole product" choice covers. */
  productDecks: number;
  waitlistCount: number;
  emailAvailable: boolean;
}

export class ExportApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

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

async function authed(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await idToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function fail(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new ExportApiError(data.error ?? fallback, res.status);
}

export async function fetchExportOptions(deckId: string): Promise<ExportOptions> {
  const res = await authed(`/api/export?options=1&deckId=${encodeURIComponent(deckId)}`);
  if (!res.ok) return fail(res, "Could not load the download options. Try again.");
  return (await res.json()) as ExportOptions;
}

export interface ExportChoice {
  deckId: string;
  scope: ExportScope;
  files: ExportFile[];
  /** Summary table as just the .xlsx or just the .csv. */
  format?: "xlsx" | "csv";
}

function fileNameFrom(res: Response): string {
  const m = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
  return m?.[1] ?? "pitchswipe-results.zip";
}

/** Fetches the files with the sign-in token (a plain link would not carry it) and saves them. */
export async function downloadExport(choice: ExportChoice): Promise<string> {
  const query = new URLSearchParams({ deckId: choice.deckId, scope: choice.scope, files: choice.files.join(",") });
  if (choice.format) query.set("format", choice.format);
  const res = await authed(`/api/export?${query}`);
  if (!res.ok) return fail(res, "Could not make the files. Try again.");
  const name = fileNameFrom(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

export async function emailExport(choice: ExportChoice): Promise<{ to: string }> {
  const res = await authed("/api/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...choice, delivery: "email" }),
  });
  if (!res.ok) return fail(res, "Could not email the files. Try again.");
  return (await res.json()) as { to: string };
}

export async function fetchExportPreview(deckId: string, scope: ExportScope): Promise<ExportPreview> {
  const res = await authed(`/api/export?preview=1&deckId=${encodeURIComponent(deckId)}&scope=${scope}`);
  if (!res.ok) return fail(res, "Could not load the preview.");
  return (await res.json()) as ExportPreview;
}
