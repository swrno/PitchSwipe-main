"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { useAuth } from "@/features/auth/ui/provider";
import { cn } from "@/shared/lib/utils";

/**
 * Signed-in-only screens (/wallet, /profile, /decks/**, /products/**).
 *
 * While Firebase reports the sign-in state a skeleton shows. Signed out shows a simple sign-in card that links to
 * /login?next=<this page>, and the children never mount, so nothing is loaded. With `verified` (founder routes,
 * contract C5) a signed-in user with an unverified email is sent to /verify?next=<this page>.
 *
 * This is the UX gate. The API routes check the Bearer ID token on every call, so it is not the only check.
 * Needs an <AuthProvider> above it: the (shell) layout provides one.
 */
export function SignInGate({
  verified = false,
  what = "this page",
  children,
}: {
  /** Also require a verified email (founder routes). */
  verified?: boolean;
  /** Said on the sign-in card: "Sign in to see <what>." */
  what?: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/swipe";
  // The APIs read email_verified from the ID token, not from user.emailVerified. A user who just verified in another
  // tab can hold a token minted before that, which the deck APIs answer with 403. Refresh it once before letting
  // them in, so the page and its API calls agree. Keyed by uid so a different account is checked again.
  const [freshFor, setFreshFor] = React.useState<string | null>(null);
  const needsTokenCheck = verified && !loading && !!user && user.emailVerified && freshFor !== user.uid;

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

  const unverified = verified && !!user && !user.emailVerified;

  React.useEffect(() => {
    if (!unverified || loading) return;
    // Read the live URL so query strings such as /decks/new?product=... survive the round trip.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    router.replace(`/verify?next=${next}`);
  }, [unverified, loading, router]);

  if (loading || needsTokenCheck) return <GateSkeleton />;
  if (!user) return <SignInCard what={what} href={`/login?next=${encodeURIComponent(pathname)}`} />;
  if (unverified) return <GateSkeleton note="Taking you to verify your email…" />;
  return <>{children}</>;
}

function SignInCard({ what, href }: { what: string; href: string }) {
  return (
    <section aria-label="Sign in" className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center md:mt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to see {what}</h1>
      <p className="mt-2 text-muted-foreground">It is tied to your account, so nothing is shown until you sign in.</p>
      <Link href={href} className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-5 w-full justify-center gap-2")}>
        <LogIn aria-hidden strokeWidth={2} />
        Sign in
      </Link>
    </section>
  );
}

function GateSkeleton({ note }: { note?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">{note ?? "Checking your sign-in…"}</span>
      <div aria-hidden className="space-y-5 motion-safe:animate-pulse">
        <div className="h-4 w-32 rounded-full bg-muted" />
        <div className="h-10 w-3/4 max-w-md rounded-2xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="hidden h-40 rounded-xl bg-muted md:block" />
          <div className="hidden h-40 rounded-xl bg-muted md:block" />
        </div>
        <div className="h-24 rounded-xl bg-muted" />
      </div>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
    </div>
  );
}
