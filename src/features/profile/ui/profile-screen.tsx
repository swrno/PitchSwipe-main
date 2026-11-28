"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Trash2, User, BadgeCheck, FileText, KeyRound, LogOut, Mail, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { ArrowChip } from "@/shared/ui/mascot";
import { Preferences } from "@/shared/shell/preferences";
import { announceProfileUpdated } from "@/shared/shell/navigation";
import { AuthFlowError, ProfileApiError, authErrorMessage, useAuth } from "@/features/auth/ui/provider";
import { withNext } from "@/features/auth/next";
import { haptic } from "@/shared/lib/feel/haptics";
import { cn } from "@/shared/lib/utils";
import { ProfileFieldsEditor, fieldsProblem } from "./profile-fields";
import type { ProfileFields, ProfileView } from "./types";
import { ProfileSkeleton } from "@/shared/ui/page-skeletons";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; profile: ProfileView }
  | { kind: "none" }
  | { kind: "error"; message: string }
  /** DELETE removed the data but not the Firebase sign-in (502 auth_delete_failed): only "finish deleting" is left. */
  | { kind: "finish-delete" };

type AuthFetch = ReturnType<typeof useAuth>["authFetch"];

/**
 * DELETE /api/profile. Throws AuthFlowError for the answers whose copy is written for people (403 unverified,
 * 429 rate limited, 502 auth_delete_failed), ProfileApiError for the rest (authErrorMessage maps 401 and 5xx).
 */
async function requestAccountDelete(authFetch: AuthFetch): Promise<void> {
  const res = await authFetch("/api/profile", { method: "DELETE" });
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error?: unknown; code?: unknown };
  const message = typeof data.error === "string" && data.error ? data.error : "Could not delete your account.";
  const code = typeof data.code === "string" ? data.code : undefined;
  if (res.status === 403 || res.status === 429 || res.status === 502) throw new AuthFlowError(message, code);
  throw new ProfileApiError(message, res.status, code);
}

const isPartialDelete = (err: unknown) => err instanceof AuthFlowError && err.code === "auth_delete_failed";

/**
 * The Profile screen (spec 03 §5.12). No mockup exists, so it follows the swipe home's style.
 * - signed out: sign in / create profile.
 * - signed in without a profile (GET /api/profile 404 no_profile): "Finish your profile", then `next` (contract C4).
 * - signed in: editable details, quality status, wallet link, preferences, account actions and the danger zone.
 */
export function ProfileScreen({ complete, next }: { complete: boolean; next: string }) {
  const { configured, loading, user } = useAuth();

  if (!configured) {
    return (
      <Shell>
        <StatusTile tone="border border-warning/40 bg-warning-soft warn-ink" title="Sign-in is not available right now" body={`${NOT_CONFIGURED_MESSAGE}. Your appearance settings below still work on this device.`} />
        <Preferences />
        <LegalLinks />
      </Shell>
    );
  }
  if (loading) return <ProfileSkeleton />;
  if (!user) return <SignedOut />;
  return <SignedInProfile key={user.uid} complete={complete} next={next} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rise-children space-y-6 space-y-6">{children}</div>;
}

function StatusTile({ tone, title, body, children }: { tone: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl relative overflow-hidden p-5 md:p-5", tone)}>
      <h2 className="text-2xl font-semibold tracking-tight max-w-[14ch] md:max-w-[20ch] md:text-3xl">{title}</h2>
      <p className="mt-2 max-w-[40ch] text-sm text-muted-foreground md:text-base">{body}</p>
      {children}
    </section>
  );
}

function SignedOut() {
  return (
    <Shell>
      <StatusTile tone="border border-accent/40 bg-accent-soft neutral-ink" title="Your profile lives here" body="Sign in to edit your details, see your quality score and manage your account.">
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href={withNext("/login", "/profile")} className={cn(buttonVariants({ variant: "ink", size: "lg" }), "justify-between pl-7 pr-3")}>
            Sign in
            <ArrowChip />
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "border-2 border-ink bg-transparent text-ink hover:bg-ink/10")}
          >
            Create profile
          </Link>
        </div>
      </StatusTile>
      <Preferences />
      <LegalLinks />
    </Shell>
  );
}

function SignedInProfile({ complete, next }: { complete: boolean; next: string }) {
  const { authFetch } = useAuth();
  const [state, setState] = React.useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authFetch("/api/profile");
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.status === 404 && data.code === "no_profile") setState({ kind: "none" });
        else if (!res.ok) setState({ kind: "error", message: data.error ?? "Could not load your profile." });
        else setState({ kind: "ready", profile: data.user as ProfileView });
      } catch (error) {
        if (alive) setState({ kind: "error", message: authErrorMessage(error) });
      }
    })();
    return () => {
      alive = false;
    };
    // authFetch changes identity on every auth state change; the uid-keyed parent already remounts per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (state.kind === "loading") return <ProfileSkeleton />;
  if (state.kind === "error") {
    return (
      <Shell>
        <StatusTile tone="border border-warning/40 bg-warning-soft warn-ink" title="Could not load your profile" body={state.message}>
          <Button
            variant="ink"
            size="lg"
            className="mt-5"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </StatusTile>
      </Shell>
    );
  }
  if (state.kind === "none") {
    return <FinishProfile complete={complete} next={next} onDone={(profile) => setState({ kind: "ready", profile })} />;
  }
  if (state.kind === "finish-delete") return <FinishDelete />;
  return (
    <ProfileBody
      profile={state.profile}
      onSaved={(profile) => setState({ kind: "ready", profile })}
      onPartialDelete={() => setState({ kind: "finish-delete" })}
    />
  );
}

/* ---------- Delete finished in MongoDB, sign-in still there (502 auth_delete_failed) ---------- */

function FinishDelete() {
  const { authFetch, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      // Retry-safe on the server: with no profile left it goes straight to removing the Firebase sign-in.
      await requestAccountDelete(authFetch);
      haptic("success");
      await signOut().catch(() => undefined);
      router.replace("/");
    } catch (err) {
      setError(isPartialDelete(err) ? "We still could not remove your sign-in. Try again in a minute." : authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Shell>
      <StatusTile
        tone="border border-warning/40 bg-warning-soft warn-ink"
        title="Finish deleting your account"
        body="Your profile and data are deleted. We could not remove your sign-in yet. Try again to finish."
      >
        <Button variant="ink" size="lg" className="mt-5" onClick={finish} disabled={busy} aria-describedby={error ? "finish-delete-error" : undefined}>
          {busy ? "Deleting..." : "Finish deleting"}
        </Button>
        {error ? (
          <p id="finish-delete-error" role="alert" className="mt-3 text-sm font-semibold text-ink">
            {error}
          </p>
        ) : null}
      </StatusTile>
    </Shell>
  );
}

/* ---------- Finish your profile (contract C4) ---------- */

function FinishProfile({ complete, next, onDone }: { complete: boolean; next: string; onDone: (p: ProfileView) => void }) {
  const { user, saveProfile } = useAuth();
  const router = useRouter();
  const [fields, setFields] = React.useState<ProfileFields>({ name: user?.displayName ?? "", role: "", state: "", interests: [] });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = fieldsProblem(fields);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = (await saveProfile({
        name: fields.name.trim(),
        role: fields.role || undefined,
        state: fields.state || undefined,
        interests: fields.interests,
      })) as unknown as ProfileView;
      haptic("success");
      announceProfileUpdated();
      if (complete) router.replace(next);
      else onDone(saved);
    } catch (err) {
      setError(authErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Finish your profile</h2>
        <p className="max-w-[52ch] text-muted-foreground">
          A few details so we can show you ideas that fit, and so founders see answers from the right people. You can change them later.
        </p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-6 rounded-xl bg-card p-5 md:max-w-3xl md:p-5" aria-describedby={error ? "finish-error" : undefined}>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{user?.email}</span>
        </p>
        <ProfileFieldsEditor idPrefix="finish" value={fields} onChange={setFields} disabled={saving} />
        {error ? (
          <p id="finish-error" role="alert" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="lime" size="lg" disabled={saving} className="w-full justify-between pl-7 pr-3 md:w-auto md:min-w-72">
          {saving ? "Saving..." : "Save and continue"}
          <ArrowChip tone="ink" />
        </Button>
        <p className="text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link href="/terms" className="font-semibold underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold underline underline-offset-4">
            Privacy policy
          </Link>
          .
        </p>
      </form>
    </Shell>
  );
}

/* ---------- The profile itself ---------- */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function toFields(p: ProfileView): ProfileFields {
  return { name: p.name ?? "", role: p.role ?? "", state: p.state ?? "", interests: [...(p.interests ?? [])] };
}

function sameFields(a: ProfileFields, b: ProfileFields): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.role === b.role &&
    a.state === b.state &&
    a.interests.length === b.interests.length &&
    a.interests.every((i) => b.interests.includes(i))
  );
}

function ProfileBody({
  profile,
  onSaved,
  onPartialDelete,
}: {
  profile: ProfileView;
  onSaved: (p: ProfileView) => void;
  onPartialDelete: () => void;
}) {
  return (
    <Shell>
      <ProfileHeader profile={profile} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-6">
        <DetailsCard profile={profile} onSaved={onSaved} />
        <div className="space-y-4">
          <QualityTile profile={profile} />
          <WalletTile />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Preferences />
        <AccountCard email={profile.email} />
      </div>
      <LegalLinks />
      <DangerZone verified={profile.emailVerified} onPartialDelete={onPartialDelete} />
    </Shell>
  );
}

function ProfileHeader({ profile }: { profile: ProfileView }) {
  const since = profile.createdAt ? new Date(profile.createdAt) : null;
  return (
    <section aria-labelledby="profile-name" className="rounded-xl relative overflow-hidden bg-card border border-border neutral-ink p-5 md:p-5">
      <div className="flex items-center gap-4 md:gap-5">
        <span
          aria-hidden
          className="stretch-display flex size-16 shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-bold text-ink-foreground md:size-20 md:text-3xl"
        >
          {initials(profile.name)}
        </span>
        <div className="min-w-0">
          <h2 id="profile-name" className="truncate text-[1.5rem] md:text-3xl">
            {profile.name}
          </h2>
          <p className="truncate text-sm font-semibold text-muted-foreground md:text-base">{profile.email}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profile.emailVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <BadgeCheck aria-hidden className="size-3.5" /> Verified
          </span>
        ) : (
          <Link
            href={withNext("/verify", "/profile")}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            <Mail aria-hidden className="size-3.5" /> Verify email
          </Link>
        )}
        {profile.role ? <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{profile.role}</span> : null}
        {profile.state ? <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{profile.state}</span> : null}
        {since && !Number.isNaN(since.getTime()) ? (
          <span className="text-xs font-semibold text-muted-foreground">
            Member since {since.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function DetailsCard({ profile, onSaved }: { profile: ProfileView; onSaved: (p: ProfileView) => void }) {
  const { saveProfile } = useAuth();
  const [fields, setFields] = React.useState<ProfileFields>(() => toFields(profile));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const dirty = !sameFields(fields, toFields(profile));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = fieldsProblem(fields);
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = (await saveProfile({
        name: fields.name.trim(),
        role: fields.role || undefined,
        state: fields.state || undefined,
        interests: fields.interests,
      })) as unknown as ProfileView;
      haptic("success");
      announceProfileUpdated();
      setMessage({ ok: true, text: "Saved." });
      onSaved(saved);
    } catch (err) {
      setMessage({ ok: false, text: authErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="details-title" className="space-y-5 rounded-xl bg-card p-5 md:p-5">
      <div>
        <h2 id="details-title" className="text-xl">
          <IconLabel icon={User}>Your details</IconLabel>
        </h2>
        <p className="text-sm text-muted-foreground">Used to pick ideas for you and to group answers for founders. Founders never see your name or email.</p>
      </div>
      <ProfileFieldsEditor idPrefix="details" value={fields} onChange={(f) => { setFields(f); setMessage(null); }} disabled={saving} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="lime" disabled={saving || !dirty}>
          <Save /> {saving ? "Saving..." : "Save changes"}
        </Button>
        {dirty && !saving ? (
          <Button type="button" variant="ghost" onClick={() => { setFields(toFields(profile)); setMessage(null); }}>
            Undo
          </Button>
        ) : null}
        <p aria-live="polite" role={message && !message.ok ? "alert" : undefined} className={cn("text-sm font-semibold", message?.ok ? "text-accent" : "text-warning")}>
          {message?.text}
        </p>
      </div>
    </form>
  );
}

function QualityTile({ profile }: { profile: ProfileView }) {
  if (profile.qualityCheck === false) {
    return (
      <section aria-labelledby="quality-title" className="rounded-xl bg-card border border-border neutral-ink p-5 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="quality-title" className="text-lg">
            <IconLabel icon={ShieldCheck}>Quality score</IconLabel>
          </h2>
          <ShieldCheck aria-hidden className="size-5" />
        </div>
        <p className="mt-2 text-2xl font-bold">Your swipes count.</p>
        <p className="mt-1 text-sm text-muted-foreground">The practice check is paused for now. Read each card for at least 2 seconds so the answer is valid.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="quality-title" className="rounded-xl bg-card border border-border neutral-ink p-5 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="quality-title" className="text-lg">
          Quality score
        </h2>
        <ShieldCheck aria-hidden className="size-5" />
      </div>
      {profile.qualityChecked ? (
        <>
          <p className="tnum mt-2 text-3xl font-semibold">
            {profile.qualityScore}
            <span className="text-xl text-muted-foreground">/100</span>
          </p>
          <p className="mt-2 text-sm font-semibold">
            {profile.countsTowardPay
              ? "Your swipes count."
              : `Not counted yet. Swipes count from a score of ${profile.countingThreshold}.`}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold">Not checked yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Take the short practice round. Swipes count from a score of {profile.countingThreshold}.</p>
        </>
      )}
      <Link href="/practice" className="mt-3 inline-block text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
        {profile.qualityChecked ? "Retake the check" : "Take the check"}
      </Link>
    </section>
  );
}

function WalletTile() {
  return (
    <Link
      href="/wallet"
      className="rounded-xl pressable flex items-center justify-between gap-3 bg-card border border-border neutral-ink p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:p-5"
    >
      <span className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl text-muted-foreground">
          <WalletIcon aria-hidden className="size-5" />
        </span>
        <span>
          <span className="block font-bold">Wallet</span>
          <span className="block text-sm text-muted-foreground">Payouts are not live yet. No real money moves.</span>
        </span>
      </span>
      <ArrowChip tone="ink" />
    </Link>
  );
}

function AccountCard({ email }: { email: string }) {
  const { signOut, sendReset } = useAuth();
  const router = useRouter();
  const [resetState, setResetState] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState<"reset" | "out" | null>(null);

  async function changePassword() {
    setBusy("reset");
    setResetState(null);
    try {
      // The provider adds the continue URL back to /login (with a fallback) and hides auth/user-not-found.
      await sendReset(email);
      setResetState({ ok: true, text: `We sent a link to ${email}. Open it to set a new password.` });
    } catch (err) {
      setResetState({ ok: false, text: authErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function doSignOut() {
    setBusy("out");
    try {
      await signOut();
      router.replace("/");
    } catch (err) {
      setResetState({ ok: false, text: authErrorMessage(err) });
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="account-title" className="space-y-4 rounded-xl bg-card p-5 md:p-5">
      <h2 id="account-title" className="text-xl">
        <IconLabel icon={KeyRound}>Account</IconLabel>
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="outline" onClick={changePassword} disabled={busy !== null}>
          <KeyRound aria-hidden />
          {busy === "reset" ? "Sending..." : "Change password"}
        </Button>
        <Button variant="outline" onClick={doSignOut} disabled={busy !== null}>
          <LogOut aria-hidden />
          {busy === "out" ? "Signing out..." : "Sign out"}
        </Button>
      </div>
      <p aria-live="polite" className={cn("text-sm", resetState?.ok ? "text-accent" : "text-warning")}>
        {resetState?.text}
      </p>
    </section>
  );
}

function LegalLinks() {
  const links = [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/contact", label: "Contact" },
  ];
  return (
    <nav aria-label="Legal and support" className="flex flex-wrap items-center gap-2">
      <FileText aria-hidden className="mr-1 size-4 text-muted-foreground" />
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

function DangerZone({
  verified,
  onPartialDelete,
}: {
  verified: boolean;
  onPartialDelete?: () => void;
}) {
  const { authFetch, signOut } = useAuth();
  const router = useRouter();
  const [typed, setTyped] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ready = typed === "DELETE";

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      await requestAccountDelete(authFetch);
      haptic("success");
      await signOut().catch(() => undefined);
      router.replace("/");
    } catch (err) {
      if (isPartialDelete(err) && onPartialDelete) {
        // The data is gone; the old profile card would be stale. Switch to the "finish deleting" screen.
        onPartialDelete();
        return;
      }
      setError(authErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="danger-title" className="space-y-4 rounded-xl border-2 border-destructive/60 p-5 md:p-5">
      <div>
        <h2 id="danger-title" className="text-xl text-destructive">
          <IconLabel icon={Trash2}>Delete account</IconLabel>
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
          This removes your profile, your sign-in, your wallet and your reward claims. If you are a founder, it also deletes your products and tests, with every answer and claim collected on them. Answers you gave on other founders&apos; tests stay in their results without your name, email or comments. It cannot be undone.
        </p>
      </div>
      {!verified ? (
        <p className="text-sm">
          To delete your account, first{" "}
          <Link href={withNext("/verify", "/profile")} className="font-bold underline underline-offset-4">
            verify your email
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={remove} className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-2 md:w-72">
            <label htmlFor="delete-confirm" className="text-sm font-bold">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={deleting}
              aria-describedby={error ? "delete-error" : undefined}
              className="h-12 w-full rounded-2xl border-2 border-border bg-background px-4 text-base font-semibold tracking-wider outline-none focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
            />
          </div>
          <Button type="submit" disabled={!ready || deleting} className="bg-destructive text-white hover:bg-destructive/90">
            {deleting ? "Deleting..." : "Delete my account"}
          </Button>
        </form>
      )}
      {error ? (
        <p id="delete-error" role="alert" className="text-sm font-semibold text-warning">
          {error}
        </p>
      ) : null}
    </section>
  );
}
