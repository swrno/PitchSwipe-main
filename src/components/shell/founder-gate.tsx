"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";

/**
 * Founder routes (/decks/**, /products/**) need a signed-in founder with a verified email (contract C5).
 *
 * - Demo mode (`demo` from the server layout, isDemoMode()): children render directly, no auth involved.
 * - Real mode: while Firebase reports the sign-in state a skeleton shows. Signed out goes to
 *   /login?next=<this page>; signed in but unverified goes to /verify?next=<this page>. The page itself
 *   renders only for a verified user.
 *
 * This is the UX gate. The API routes check the Bearer ID token on every call, so it is not the only check.
 * Needs an <AuthProvider> above it: the (shell) layout provides one.
 */
export function FounderGate({ demo, children }: { demo: boolean; children: React.ReactNode }) {
  if (demo) return <>{children}</>;
  return <RealGate>{children}</RealGate>;
}

type GateState = "loading" | "signed-out" | "unverified" | "allowed";

function RealGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // The APIs read email_verified from the ID token, not from user.emailVerified. A user who just verified in another
  // tab can hold a token minted before that, which the deck APIs answer with 403. Refresh it once before letting
  // them in, so the page and its API calls agree. Keyed by uid so a different account is checked again.
  const [freshFor, setFreshFor] = React.useState<string | null>(null);
  const needsTokenCheck = !loading && !!user && user.emailVerified && freshFor !== user.uid;

  React.useEffect(() => {
    if (!needsTokenCheck || !user) return;
    let live = true;
    (async () => {
      try {
        const claims = (await user.getIdTokenResult()).claims;
        if (claims.email_verified !== true) await user.getIdToken(true);
      } catch {
        // Offline or a token error: the APIs will answer 401 and the page shows its own error. Do not block here.
      }
      if (live) setFreshFor(user.uid);
    })();
    return () => {
      live = false;
    };
  }, [needsTokenCheck, user]);

  const state: GateState =
    loading || needsTokenCheck ? "loading" : !user ? "signed-out" : !user.emailVerified ? "unverified" : "allowed";

  React.useEffect(() => {
    if (state !== "signed-out" && state !== "unverified") return;
    // Read the live URL so query strings such as /decks/new?product=... survive the round trip.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(state === "signed-out" ? `/login?next=${next}` : `/verify?next=${next}`);
  }, [state, router]);

  if (state === "allowed") return <>{children}</>;
  return <GateSkeleton state={state} />;
}

const STATUS_TEXT: Record<Exclude<GateState, "allowed">, string> = {
  loading: "Checking your sign-in…",
  "signed-out": "Taking you to sign in…",
  unverified: "Taking you to verify your email…",
};

function GateSkeleton({ state }: { state: Exclude<GateState, "allowed"> }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      {state === "loading" ? <span className="sr-only">{STATUS_TEXT[state]}</span> : null}
      <div aria-hidden className="space-y-5 motion-safe:animate-pulse">
        <div className="h-4 w-32 rounded-full bg-muted" />
        <div className="h-10 w-3/4 max-w-md rounded-2xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-[24px] bg-muted" />
          <div className="hidden h-40 rounded-[24px] bg-muted md:block" />
          <div className="hidden h-40 rounded-[24px] bg-muted md:block" />
        </div>
        <div className="h-24 rounded-[24px] bg-muted" />
      </div>
      {state !== "loading" ? <p className="text-sm text-muted-foreground">{STATUS_TEXT[state]}</p> : null}
    </div>
  );
}
