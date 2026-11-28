"use client";

import { isFirebaseClientConfigured } from "@/features/auth/config";
import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";

export interface AskPageInfo {
  page: string;
  productName: string | null;
  testLabel: string | null;
  tab: string | null;
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

/** The page the user is on, with the product and test in view (null when the request fails: the header just shows the title). */
export async function loadAskPage(pathname: string): Promise<AskPageInfo | null> {
  const res = await askFetch(`/api/ask?pathname=${encodeURIComponent(pathname)}`);
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { page?: AskPageInfo };
  return data.page ?? null;
}
