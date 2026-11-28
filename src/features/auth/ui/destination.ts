"use client";

import { getFirebaseClientAuth } from "@/shared/lib/firebase/client";
import { isFirebaseClientConfigured } from "@/features/auth/config";
import { DEFAULT_NEXT, safeNext, withNext } from "@/features/auth/next";
import type { ProfileStatus } from "@/features/auth/ui/provider";

/** Pages that would bounce a signed-in user straight back here: never use them as a destination. */
const AUTH_ENTRY = /^\/(login|signup|reset)(?:[/?#]|$)/;

/**
 * Contract C2: where a signed-in user goes next.
 * - email not verified -> /verify?next=<next> (or the /verify link itself when next already points there)
 * - GET /api/profile 404 no_profile -> /profile?complete=1&next=<next>
 * - otherwise -> next
 * A missing or rejected `next` is the C1 default (/swipe) here, the /verify hop included. Only the sign-up form's own
 * push to /verify leaves next out, so brand-new swipers continue to practice after verifying.
 * A failed profile check (offline, 5xx) does not strand anyone: it continues to next.
 */
export async function destinationAfterSignIn(
  profileStatus: () => Promise<ProfileStatus>,
  next: string | null,
): Promise<string> {
  const explicit = next && !AUTH_ENTRY.test(next) ? safeNext(next, DEFAULT_NEXT) : null;
  const target = explicit ?? DEFAULT_NEXT;

  const current = isFirebaseClientConfigured() ? getFirebaseClientAuth().currentUser : null;
  if (!current) return withNext("/login", explicit);
  if (!current.emailVerified) {
    // No explicit next: plain /verify, so its own default (practice, for a brand-new swiper) applies. Passing the
    // /swipe default here made a swiper who pressed Back from /verify to /signup skip practice.
    if (!explicit) return "/verify";
    return explicit.startsWith("/verify") ? explicit : withNext("/verify", explicit);
  }
  if ((await profileStatus()) === "missing") return withNext("/profile?complete=1", target);
  return target;
}
