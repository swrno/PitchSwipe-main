"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, LogOut, Plus, UserPlus } from "lucide-react";
import * as React from "react";
import { USER_CHIP, WALLET } from "@/fixtures";
import { useAuth } from "@/lib/auth/provider";
import { haptic } from "@/lib/feel/haptics";
import { fetchWallet } from "@/lib/claims/client";
import { AnimatedAmount } from "@/components/ui/animated-amount";
import { useAnnouncedBalance } from "@/lib/feel/wallet-events";
import { getSwiperGuid } from "@/lib/swipe/client";
import { BrandMark } from "./brand-mark";
import { demoIdentity, initialsOf, realIdentity, type ProfileLike, type ShellIdentity } from "./identity";
import { Button, buttonVariants } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { NAV_ITEMS, NEW_DECK_HREF, isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Phone: fixed bottom tab bar. Hidden from md up. */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden"
      style={{ height: "var(--tabbar-height)", paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto grid h-full max-w-md grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href) || (item.href === "/decks" && pathname.startsWith("/products"));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                  active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-highlight text-highlight-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Window event the profile screen dispatches after a successful saveProfile() (the C4 "Finish your profile"
 * form and edits on /profile), so the shell's account chip shows the new name, state and role at once.
 * Same tab only. Dispatch with `announceProfileUpdated()` or `window.dispatchEvent(new Event("ps:profile-updated"))`.
 */
export const PROFILE_UPDATED_EVENT = "ps:profile-updated";

export function announceProfileUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}

/**
 * The signed-in user's own name, role, state and wallet balance (real mode), or the designed demo user
 * (demo mode, labelled). Null while loading or when unavailable: the UI then shows nothing, never a stand-in.
 * The shell stays mounted across client navigations, so this re-reads the profile and wallet after every
 * navigation and whenever the profile screen announces a save: a just-completed or renamed profile shows
 * without a full reload.
 */
function useShellIdentity(demo: boolean): ShellIdentity | null {
  const { user, loading, authFetch } = useAuth();
  const pathname = usePathname();
  // Kept with the uid it belongs to, so a different account never sees the previous one's name or balance.
  const [loaded, setLoaded] = React.useState<{ uid: string; identity: ShellIdentity | null } | null>(null);
  const [profileRevision, setProfileRevision] = React.useState(0);
  const uid = user?.uid;

  React.useEffect(() => {
    if (demo) return;
    const onUpdated = () => setProfileRevision((r) => r + 1);
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, [demo]);

  React.useEffect(() => {
    if (demo || loading || !uid) return;
    let live = true;
    (async () => {
      // undefined: the read failed (offline, 5xx), so keep what is shown. null: no profile (or no name) yet.
      let profile: ProfileLike | null | undefined;
      try {
        const res = await authFetch("/api/profile");
        if (res.ok) profile = ((await res.json()) as { user?: ProfileLike }).user ?? null;
        else if (res.status === 404) profile = null;
      } catch {
        profile = undefined;
      }
      if (!live) return;
      if (profile !== undefined) {
        const next = realIdentity(profile, null);
        // Keep this account's last known balance while the wallet is re-read, so the badge does not blink.
        setLoaded((prev) => {
          const prevBalance = prev?.uid === uid ? prev.identity?.balanceRs : undefined;
          return { uid, identity: next && prevBalance !== undefined ? { ...next, balanceRs: prevBalance } : next };
        });
      }
      try {
        const wallet = await fetchWallet(authFetch, getSwiperGuid());
        if (!live) return;
        setLoaded((prev) => {
          if (prev?.uid !== uid || !prev.identity || !Number.isFinite(wallet.balanceRs)) return prev;
          return { uid, identity: { ...prev.identity, balanceRs: wallet.balanceRs } };
        });
      } catch {
        // Wallet unavailable: keep whatever balance was already shown (or none).
      }
    })();
    return () => {
      live = false;
    };
  }, [demo, loading, uid, authFetch, pathname, profileRevision]);

  if (demo) return demoIdentity(USER_CHIP, WALLET.balanceRs);
  return uid && loaded?.uid === uid ? loaded.identity : null;
}

/** The URL to come back to after signing in: the current page (always a same-site path). */
function useLoginHref(): string {
  const pathname = usePathname() || "/swipe";
  return `/login?next=${encodeURIComponent(pathname)}`;
}

/** Name to show for a signed-in user: their profile name, else their Firebase display name, else their email. */
function accountLabel(identity: ShellIdentity | null, user: { displayName: string | null; email: string | null }) {
  const name = identity?.name || user.displayName?.trim() || user.email || "Your account";
  const initials = identity?.initials || initialsOf(user.displayName ?? "") || (user.email?.[0] ?? "").toUpperCase() || "?";
  return { name, initials, email: user.email };
}

/**
 * Web: left sidebar. Hidden below md. `demo` comes from the server layout (isDemoMode).
 * Needs an <AuthProvider> above it: the (shell) layout wraps the whole shell in one.
 */
export function Sidebar({ demo = false }: { demo?: boolean }) {
  return <SidebarBody demo={demo} />;
}

function SidebarBody({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  const identity = useShellIdentity(demo);
  // The swipe page announces the server's new balance when an answer is credited; show it at once.
  const announced = useAnnouncedBalance();
  const sidebarBalance = identity?.balanceRs === undefined ? undefined : (announced ?? identity.balanceRs);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-border bg-background md:flex">
      <div className="flex h-16 items-center px-5">
        <BrandLink />
      </div>

      <nav aria-label="Primary" className="mt-2 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href) || (item.href === "/decks" && pathname.startsWith("/products"));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                    active ? "font-bold text-highlight-foreground" : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 -z-10 rounded-full bg-highlight"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  {item.label}
                  {item.href === "/wallet" && sidebarBalance !== undefined ? (
                    // No real money moves yet: the balance always carries a visible "demo" tag, and the full
                    // qualifier for screen readers ("Demo earnings for now" in real mode, "Demo data" in demo mode).
                    <span
                      className="ml-auto flex flex-col items-end leading-none"
                      title={demo ? "Demo data" : "Demo earnings for now"}
                    >
                      <span className={cn("tnum text-xs font-bold", active ? "text-highlight-foreground" : "text-accent")}>
                        <AnimatedAmount value={sidebarBalance} />
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          active ? "text-highlight-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        demo
                      </span>
                      <span className="sr-only">{demo ? " (Demo data)" : " (Demo earnings for now)"}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 px-3">
        <Link href={NEW_DECK_HREF} className={cn(buttonVariants({ variant: "default" }), "h-12 w-full")}>
          <Plus aria-hidden strokeWidth={2} />
          New deck
        </Link>
      </div>

      <div className="mt-auto px-3 pb-2">
        <ThemeToggle label className="w-full justify-start" />
      </div>

      <SidebarAccount demo={demo} identity={identity} />
    </aside>
  );
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Sidebar footer: who is signed in (links to /profile) with Sign out, or Sign in / Create profile. */
function SidebarAccount({ demo, identity }: { demo: boolean; identity: ShellIdentity | null }) {
  const { user, loading, signOut } = useAuth();
  const loginHref = useLoginHref();
  const [signingOut, setSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Demo: the designed demo user, labelled. No sign-in controls.
  if (demo) {
    if (!identity) return null;
    return (
      <div className="border-t border-border p-4">
        <Link href="/profile" className={cn("flex items-center gap-3 rounded-2xl p-1 -m-1 hover:bg-muted", FOCUS_RING)}>
          <Avatar initials={identity.initials} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{identity.name}</p>
            {identity.detail ? <p className="truncate text-xs text-muted-foreground">{identity.detail}</p> : null}
            <DemoBadge className="mt-1">Demo data</DemoBadge>
          </div>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border-t border-border p-4" role="status" aria-label="Checking your sign-in">
        <div aria-hidden className="flex items-center gap-3 motion-safe:animate-pulse">
          <span className="size-9 rounded-full bg-muted" />
          <span className="h-3 w-28 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-2 border-t border-border p-4">
        <Link href={loginHref} className={cn(buttonVariants({ variant: "lime", size: "sm" }), "w-full")}>
          <LogIn aria-hidden strokeWidth={2} />
          Sign in
        </Link>
        <Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
          <UserPlus aria-hidden strokeWidth={2} />
          Create profile
        </Link>
      </div>
    );
  }

  const account = accountLabel(identity, user);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    haptic("select");
    try {
      await signOut();
      // A full load of the landing: drops every in-memory trace of the account, and wins over the founder
      // gate's own redirect to /login when signing out on a /decks or /products page.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload is the point here
      window.location.assign("/");
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border p-4">
      <Link
        href="/profile"
        aria-label={`Your profile: ${account.name}`}
        className={cn("-m-1 flex items-center gap-3 rounded-2xl p-1 hover:bg-muted", FOCUS_RING)}
      >
        <Avatar initials={account.initials} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.name}</p>
          {identity?.detail ? (
            <p className="truncate text-xs text-muted-foreground">{identity.detail}</p>
          ) : account.email && account.email !== account.name ? (
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          ) : null}
        </div>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start px-3 text-muted-foreground hover:text-foreground"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <LogOut aria-hidden strokeWidth={2} />
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-lilac text-sm font-bold text-ink",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Phone: the right side of the top brand bar. Signed in (or demo): the avatar, linking to /profile.
 * Signed out: a Sign in pill to /login?next=<this page>. Nothing while the sign-in state loads.
 */
export function BrandBarAccount({ demo = false }: { demo?: boolean }) {
  const { user, loading } = useAuth();
  const loginHref = useLoginHref();

  if (demo) {
    // The fixture user's initials are demo data: label them visibly here too (the sidebar's badge is hidden on phones).
    return (
      <Link
        href="/profile"
        aria-label={`Your profile: ${USER_CHIP.name} (demo data)`}
        className={cn("flex items-center gap-2 rounded-full", FOCUS_RING)}
      >
        <DemoBadge>Demo data</DemoBadge>
        <Avatar initials={USER_CHIP.initials} />
      </Link>
    );
  }

  if (loading) return <span aria-hidden className="size-9 rounded-full bg-muted motion-safe:animate-pulse" />;

  if (!user) {
    return (
      <Link href={loginHref} className={cn(buttonVariants({ variant: "lime", size: "sm" }), "h-9 px-4")}>
        <LogIn aria-hidden strokeWidth={2} />
        Sign in
      </Link>
    );
  }

  const account = accountLabel(null, user);
  return (
    <Link href="/profile" aria-label={`Your profile: ${account.name}`} className={cn("rounded-full", FOCUS_RING)}>
      <Avatar initials={account.initials} />
    </Link>
  );
}

function BrandLink() {
  return (
    <Link
      href="/swipe"
      aria-label="PitchSwipe: swipe home"
      className={cn("flex items-center gap-2 rounded-full font-display text-xl font-bold tracking-tight", FOCUS_RING)}
    >
      <BrandMark className="size-8" />
      <span aria-hidden>PitchSwipe</span>
    </Link>
  );
}
