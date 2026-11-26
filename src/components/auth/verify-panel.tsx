"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowChip } from "@/components/ui/mascot";
import { AuthShell } from "./auth-shell";
import { FormError, FormNote, textLinkClass } from "./fields";
import { destinationAfterSignIn } from "./destination";
import { authErrorMessage, useAuth } from "@/lib/auth/provider";
import { withNext } from "@/lib/auth/next";
import { haptic } from "@/lib/feel/haptics";
import { qualityCheckEnabled } from "@/lib/quality/switch";

const RESEND_SECONDS = 60;
/**
 * New swipers continue to practice (step 3 of 3) unless the link that sent them here said otherwise. While the quality
 * check is set aside (src/lib/quality/switch.ts) they go straight to swiping.
 */
const DEFAULT_AFTER_VERIFY = qualityCheckEnabled() ? "/practice" : "/swipe";
const SENT_AT_KEY = "ps:verify-sent-at";

/** Remember when a verification email went out (this tab only), so /verify can hold the resend button for a minute. */
export function markVerificationSent() {
  try {
    window.sessionStorage.setItem(SENT_AT_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the resend button is simply available straight away.
  }
}

function secondsUntilResend(): number {
  try {
    const sentAt = Number(window.sessionStorage.getItem(SENT_AT_KEY));
    if (!sentAt) return 0;
    return Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

export function VerifyPanel({
  preview = false,
  next = null,
  previewHref,
  demo = false,
}: {
  preview?: boolean;
  /** Safe `?next=` (checked on the server), or null for the default (practice). */
  next?: string | null;
  previewHref?: string;
  /** Server isDemoMode(): skip the /profile?complete=1 hop, which has no form in demo mode. */
  demo?: boolean;
}) {
  const router = useRouter();
  const { user, loading, configured, refreshVerification, resendVerification, signOut, profileStatus } = useAuth();
  // 0 until we know an email went out just now (sign-up marks it); returning visitors can resend straight away.
  const [cooldown, setCooldown] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const leaving = React.useRef(false);
  const inflight = React.useRef<Promise<void> | null>(null);
  const continueTo = next ?? DEFAULT_AFTER_VERIFY;

  React.useEffect(() => {
    const left = secondsUntilResend();
    if (left > 0) {
      const t = setTimeout(() => setCooldown(left), 0);
      return () => clearTimeout(t);
    }
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Signed-out visitors sign in first, then come back here.
  React.useEffect(() => {
    if (preview || !configured || loading || user || leaving.current) return;
    leaving.current = true;
    router.replace(withNext("/login", withNext("/verify", next)));
  }, [preview, configured, loading, user, router, next]);

  /** Verified: run the C2 profile check, then continue. */
  const proceed = React.useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    haptic("success");
    router.replace(await destinationAfterSignIn(profileStatus, continueTo, { profileStep: !demo }));
  }, [router, profileStatus, continueTo, demo]);

  /**
   * `silent`: automatic checks (mount, focus) show nothing unless the email is verified, and are skipped while another
   * check runs. A tap waits for an automatic check in flight, then checks again and reports.
   */
  const check = React.useCallback(
    async (silent: boolean) => {
      if (leaving.current) return;
      if (inflight.current) {
        if (silent) return;
        setBusy(true);
        await inflight.current.catch(() => undefined);
        if (leaving.current) return;
      }
      if (!silent) {
        setBusy(true);
        setError(null);
        setInfo(null);
      }
      const run = (async () => {
        try {
          if (await refreshVerification()) await proceed();
          else if (!silent) setInfo("Not verified yet. Open the link in your email, then tap again.");
        } catch (e) {
          if (!silent) setError(authErrorMessage(e));
          else console.warn("[auth] Automatic verification check failed.", e);
        }
      })();
      inflight.current = run;
      try {
        await run;
      } finally {
        if (inflight.current === run) inflight.current = null;
        if (!silent) setBusy(false);
      }
    },
    [refreshVerification, proceed],
  );

  // Latest check() for the listeners below. Each reload re-creates the auth context (and so check), and the listeners
  // must not re-subscribe (and re-check) on that, or every check would schedule the next one.
  const checkRef = React.useRef(check);
  React.useEffect(() => {
    checkRef.current = check;
  }, [check]);

  // Re-check on arrival and whenever the person comes back to this tab (after tapping the link elsewhere).
  const signedIn = Boolean(user);
  React.useEffect(() => {
    if (preview || !configured || !signedIn) return;
    const onFocus = () => void checkRef.current(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkRef.current(true);
    };
    const first = setTimeout(onFocus, 0);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [preview, configured, signedIn]);

  async function resend() {
    if (preview) return setInfo("Layout preview only: nothing is sent.");
    setError(null);
    setInfo(null);
    try {
      await resendVerification(next);
      markVerificationSent();
      setCooldown(RESEND_SECONDS);
      setInfo("Sent again. Check your inbox and spam folder.");
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  async function changeEmail() {
    if (preview) return;
    leaving.current = true; // stop the signed-out redirect to /login from racing this one
    setError(null);
    setInfo(null);
    try {
      await signOut();
    } catch (e) {
      // Still signed in: let the automatic checks and the button work again, and say what happened.
      leaving.current = false;
      setError(authErrorMessage(e));
      return;
    }
    router.push(withNext("/signup", next));
  }

  const mm = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;

  return (
    <AuthShell
      preview={preview}
      previewHref={previewHref}
      step={2}
      title="Check your email."
      intro={
        <>
          We sent a verification link to <strong className="break-all text-foreground">{preview ? "priya.n@example.com" : (user?.email ?? "your email")}</strong>.
          You verify once; after that your email is shared with one tap when you claim a reward.
        </>
      }
      notes={[
        {
          icon: <Mail />,
          title: "One email, every reward",
          body: "When you claim a launch reward, your verified email goes to that founder only. No forms to fill each time.",
        },
        {
          icon: <Wallet />,
          title: "Your waitlist spots",
          body: "Every reward you claim shows in your wallet, so you know which founders have your email.",
        },
      ]}
    >
      <div className="flex flex-col gap-6">
        <div className="tile flex items-center gap-4 bg-sky p-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
            <Mail className="size-5" />
          </span>
          <p className="text-sm font-semibold">
            Open the link in the email. This page checks again by itself when you come back; you can also tap the button.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          {cooldown > 0 ? (
            <span className="tnum text-muted-foreground" aria-live="off">
              Resend email in {mm}
            </span>
          ) : (
            <button type="button" onClick={resend} className={textLinkClass}>
              Resend email
            </button>
          )}
          <button type="button" onClick={changeEmail} className={textLinkClass}>
            Change email
          </button>
        </div>
        <FormNote message={info} />
        <FormError message={error} />
        <Button
          variant="lime"
          size="lg"
          className="w-full justify-between pl-7 pr-3"
          onClick={() => (preview ? setInfo("Layout preview only: nothing is checked.") : void check(false))}
          disabled={busy || (!user && !preview)}
        >
          {busy ? "Checking..." : "I have verified my email"}
          <ArrowChip tone="ink" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/swipe" className={textLinkClass}>
            Skip for now
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
