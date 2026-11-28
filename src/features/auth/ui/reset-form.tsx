"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, MailCheck } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { ArrowChip } from "@/shared/ui/mascot";
import { AuthShell } from "./auth-shell";
import { Field, FormError, inputClass, textLinkClass } from "./fields";
import { authErrorMessage, useAuth } from "@/features/auth/ui/provider";
import { withNext } from "@/features/auth/next";
import { cn } from "@/shared/lib/utils";
import { haptic } from "@/shared/lib/feel/haptics";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * /reset (contract C3). Sends a Firebase password reset email whose "continue" link returns to /login. The answer is
 * the same whether or not an account exists, so the page never tells anyone which emails are registered.
 */
export function ResetForm({
  initialEmail = "",
  next = null,
}: {
  initialEmail?: string;
  /** Safe `?next=` (checked on the server), or null. Carried back to /login so sign-in still ends up there. */
  next?: string | null;
}) {
  const loginHref = withNext("/login", next);
  const { sendReset } = useAuth();
  const [email, setEmail] = React.useState(initialEmail);
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const doneHeading = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (sent) doneHeading.current?.focus();
  }, [sent]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_SHAPE.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      await sendReset(email.trim(), next);
      haptic("success");
      setSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password."
      intro="Enter the email you signed up with. We will send a link to set a new password."
      notes={[
        {
          icon: <MailCheck />,
          title: "Check spam too",
          body: "The email comes from our sign-in provider. If it is not in your inbox in a few minutes, look in spam.",
        },
        {
          icon: <KeyRound />,
          title: "The link works once",
          body: "After you set a new password, the link takes you back here to sign in.",
        },
      ]}
    >
      {sent ? (
        <div className="flex max-w-md flex-col gap-5">
          <div className="rounded-xl border border-accent/40 bg-accent-soft neutral-ink p-5">
            <h2 ref={doneHeading} tabIndex={-1} className="text-xl focus:outline-none">
              Check your email.
            </h2>
            <p role="status" className="mt-1 text-sm font-semibold text-muted-foreground">
              If an account exists for that email, we sent a reset link.
            </p>
          </div>
          <Link href={loginHref} className={cn(buttonVariants({ variant: "lime", size: "lg" }), "w-full justify-between pl-7 pr-3")}>
            Back to sign in
            <ArrowChip tone="ink" />
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Wrong email?{" "}
            <button
              type="button"
              className={textLinkClass}
              onClick={() => {
                setSent(false);
                setError(null);
              }}
            >
              Try another
            </button>
          </p>
        </div>
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
          <FormError message={error} />
          <Button type="submit" variant="lime" size="lg" className="w-full justify-between pl-7 pr-3" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
            <ArrowChip tone="ink" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href={loginHref} className={textLinkClass}>
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
