"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArrowChip } from "@/components/ui/mascot";
import { AuthShell } from "./auth-shell";
import { Field, FormError, PasswordInput, inputClass, textLinkClass } from "./fields";
import { useContinueAfterSignIn } from "./use-continue";
import { authErrorMessage, useAuth } from "@/lib/auth/provider";
import { withNext } from "@/lib/auth/next";
import { haptic } from "@/lib/feel/haptics";

export function LoginForm({
  next = null,
  preview = false,
  previewHref,
  demo = false,
}: {
  /** Safe `?next=` (already checked on the server), or null when the page was opened without one. */
  next?: string | null;
  /** Dev/demo layout preview (`?demo=1`): nothing is sent. */
  preview?: boolean;
  previewHref?: string;
  /** Server isDemoMode(): skip the /profile?complete=1 hop, which has no form in demo mode. */
  demo?: boolean;
}) {
  const { signIn } = useAuth();
  const { go, hold, signedIn } = useContinueAfterSignIn(next, !preview, !demo);
  const [email, setEmail] = React.useState(preview ? "priya.n@example.com" : "");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (preview) return setError("Layout preview only: nothing is sent. Open /login without ?demo=1 to sign in.");
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    hold(true);
    try {
      await signIn(email.trim(), password);
      haptic("success");
      await go();
    } catch (e) {
      hold(false);
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  const resetHref = withNext(email.trim() ? `/reset?email=${encodeURIComponent(email.trim())}` : "/reset", next);

  return (
    <AuthShell
      preview={preview}
      previewHref={previewHref}
      title="Welcome back."
      intro="Sign in with your email and password."
      notes={[
        {
          icon: <ShieldCheck />,
          title: "Your answers stay yours",
          body: "Founders see totals, never your name. Signing in only brings back your wallet and your settings.",
        },
        {
          icon: <KeyRound />,
          title: "Forgot your password?",
          body: "Ask for a reset link. It goes to your email and works once.",
        },
      ]}
    >
      {signedIn && !busy ? (
        <p role="status" className="text-base font-semibold">
          You are signed in. Taking you on...
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-5" noValidate>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              inputMode="email"
              className={inputClass}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            aside={
              <Link href={resetHref} className={`${textLinkClass} text-sm`}>
                Forgot password?
              </Link>
            }
          >
            <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} required />
          </Field>
          <FormError message={error} />
          <Button type="submit" variant="lime" size="lg" className="w-full justify-between pl-7 pr-3" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
            <ArrowChip tone="ink" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link href={withNext("/signup", next)} className={textLinkClass}>
              Create a profile
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
