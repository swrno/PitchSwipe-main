"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Check, User } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ArrowChip } from "@/shared/ui/mascot";
import { AuthShell } from "./auth-shell";
import { ChipGroup, Field, FormError, PasswordInput, inputClass, textLinkClass } from "./fields";
import { useContinueAfterSignIn } from "./use-continue";
import { markVerificationSent } from "./verify-panel";
import { ProfileApiError, ProfileSaveError, authErrorMessage, useAuth } from "@/features/auth/ui/provider";
import { withNext } from "@/features/auth/next";
import { INDUSTRIES, ROLES, STATES, isState, type Industry, type Role } from "@/shared/lib/lists";
import { haptic } from "@/shared/lib/feel/haptics";
import { qualityCheckEnabled } from "@/features/quality/switch";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm({
  next = null,
}: {
  /** Safe `?next=` (checked on the server), or null: then verify keeps its own default (practice). */
  next?: string | null;
}) {
  const router = useRouter();
  const { signUp, signOut } = useAuth();
  const { hold, signedIn } = useContinueAfterSignIn(next);
  /** The account was created but cannot be set up from here (409/401). Stays on screen; the user is signed in. */
  const [stuck, setStuck] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [state, setState] = React.useState("");
  const [role, setRole] = React.useState<Role[]>([]);
  const [interests, setInterests] = React.useState<Industry[]>([]);
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Enter your name.");
    if (!EMAIL_SHAPE.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Use a password of at least 6 characters.");
    if (!isState(state)) return setError("Pick your state.");
    if (role.length !== 1) return setError("Pick what you do.");
    if (!agreed) return setError("Agree to the Terms and Privacy Policy to continue.");
    setBusy(true);
    hold(true);
    const verifyHref = withNext("/verify", next);
    try {
      await signUp(email.trim(), password, { name: name.trim(), role: role[0], state, interests }, next);
      markVerificationSent();
      haptic("success");
      router.push(verifyHref);
    } catch (e) {
      if (e instanceof ProfileSaveError) {
        // The account exists; only the profile is missing. Go wherever that can actually be fixed.
        const reason = e.reason;
        const status = reason instanceof ProfileApiError ? reason.status : 0;
        if (status === 409 || status === 401) {
          // Repeats the same way on /profile (an older profile holds this email, or the sign-in is gone): explain.
          setStuck(
            status === 409
              ? "Your sign-in was created, but an older PitchSwipe profile already uses this email, so we could not set this one up."
              : authErrorMessage(reason),
          );
          setBusy(false);
          return;
        }
        markVerificationSent();
        haptic("success");
        if (status === 400) {
          // The server refused an answer: fix it on the profile form, then carry on to verify.
          router.push(withNext("/profile?complete=1", verifyHref));
        } else {
          // Offline, 5xx or not configured: verify now. After verifying, C2 sends a missing profile to /profile.
          router.push(verifyHref);
        }
        return;
      }
      hold(false);
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      step={1}
      title="Create your profile."
      intro={
        <>
          Tells us which ideas to show you. Founders only ever see totals<span className="hidden md:inline">, never your name</span>.
        </>
      }
      notes={[
        {
          icon: <User />,
          title: "Why we ask",
          body: "Founders can target a state, an interest or a type of user. Your answers decide which ideas reach you.",
        },
        {
          icon: <Eye />,
          title: "Private by default",
          body: "Founders see counts by state or interest, never who you are. Your email is shared only when you claim a reward.",
        },
        {
          icon: <Check />,
          title: qualityCheckEnabled() ? "Next: verify, then practice" : "Next: verify, then swipe",
          body: qualityCheckEnabled()
            ? "You verify your email once, then swipe 30 practice cards, about 3 minutes."
            : "You verify your email once, then start swiping on real ideas.",
        },
      ]}
    >
      {stuck ? (
        <div className="flex max-w-md flex-col gap-5">
          <div role="alert" className="rounded-xl border border-warning/40 bg-warning-soft warn-ink p-5">
            <h2 className="text-lg font-semibold tracking-tight text-xl">We could not finish setting up your account.</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{stuck}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href="/contact" className={textLinkClass}>
              Contact us
            </Link>{" "}
            and we will sort it out. You can also sign out and try a different email.
          </p>
          <FormError message={error} />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signOut();
                setStuck(null);
              } catch (e) {
                setError(authErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      ) : signedIn && !busy ? (
        <p role="status" className="text-base font-semibold">
          You are already signed in. Taking you on...
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full name" htmlFor="name">
              <input id="name" className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </Field>
            <Field label="Email" hint="we will send a link" htmlFor="email">
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
            <Field label="Password" hint="6 or more characters" htmlFor="password">
              <PasswordInput id="password" autoComplete="new-password" minLength={6} value={password} onChange={setPassword} required />
            </Field>
            <Field label="State" htmlFor="state">
              <select id="state" className={inputClass} value={state} onChange={(e) => setState(e.target.value)} required>
                <option value="" disabled>
                  Select your state
                </option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <ChipGroup legend="What do you do?" options={ROLES} value={role} onChange={setRole} single />
          <ChipGroup legend="Show me ideas for" options={INDUSTRIES} value={interests} onChange={setInterests} />

          <div className="flex items-start gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            <input
              id="consent"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
            />
            <label htmlFor="consent">
              I agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener" className={textLinkClass}>
                Terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" rel="noopener" className={textLinkClass}>
                Privacy Policy
              </Link>
              . My state is checked against my network location to stop fake accounts.
            </label>
          </div>

          <FormError message={error} />
          <Button type="submit" variant="lime" size="lg" className="w-full justify-between pl-7 pr-3" disabled={busy}>
            {busy ? "Creating account..." : "Continue"}
            <ArrowChip tone="ink" />
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={withNext("/login", next)} className={textLinkClass}>
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
