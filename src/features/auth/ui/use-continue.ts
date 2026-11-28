"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/ui/provider";
import { destinationAfterSignIn } from "./destination";

/**
 * One router per page for "you are signed in, move on" (contract C2). The page's own submit handler calls `hold(true)`
 * before it starts: onAuthStateChanged fires mid-submit (for sign-up, before the profile is saved), and the effect
 * must not race the handler then. The handler calls `go()` itself when it is done.
 */
export function useContinueAfterSignIn(next: string | null, enabled = true) {
  const router = useRouter();
  const { user, loading, configured, profileStatus } = useAuth();
  const routing = React.useRef(false);
  const held = React.useRef(false);

  const go = React.useCallback(async () => {
    if (routing.current) return;
    routing.current = true;
    router.replace(await destinationAfterSignIn(profileStatus, next));
  }, [router, profileStatus, next]);

  React.useEffect(() => {
    if (!enabled || !configured || loading || !user || held.current) return;
    void go();
  }, [enabled, configured, loading, user, go]);

  const hold = React.useCallback((value: boolean) => {
    held.current = value;
  }, []);

  /** True when a signed-in visitor is about to be sent on (show a short note instead of the form). */
  const signedIn = enabled && configured && !loading && Boolean(user);
  return { go, hold, signedIn };
}
