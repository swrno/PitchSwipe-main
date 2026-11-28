"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogIn, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/features/auth/ui/provider";
import { fetchWallet } from "@/features/claims/ui/client";
import { useAnnouncedBalance } from "@/shared/lib/feel/wallet-events";
import { getSwiperGuid } from "@/features/swipe/ui/client";
import { DecksLeftCompact } from "@/features/decks/ui/decks-left";
import { BrandMark } from "./brand-mark";
import { initialsOf, realIdentity, type ProfileLike, type ShellIdentity } from "./identity";
import { buttonVariants } from "@/shared/ui/button";
import { NAV_ITEMS, NEW_DECK_HREF, TAB_ITEMS, isActivePath, isItemActive } from "@/shared/lib/nav";
import { api } from "@/features/decks/ui/api";
import type { DecksOverview, ProductListItem } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";

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
        {TAB_ITEMS.map((item) => {
          const active = isItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-muted text-foreground",
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
 * The signed-in user's own name, role, state and wallet balance. Null while loading or when unavailable: the UI
 * then shows nothing, never a stand-in.
 * The shell stays mounted across client navigations, so this re-reads the profile and wallet after every
 * navigation and whenever the profile screen announces a save: a just-completed or renamed profile shows
 * without a full reload.
 */
function useShellIdentity(): ShellIdentity | null {
  const { user, loading, authFetch } = useAuth();
  const pathname = usePathname();
  // Kept with the uid it belongs to, so a different account never sees the previous one's name or balance.
  const [loaded, setLoaded] = React.useState<{ uid: string; identity: ShellIdentity | null } | null>(null);
  const [profileRevision, setProfileRevision] = React.useState(0);
  const uid = user?.uid;

  React.useEffect(() => {
    const onUpdated = () => setProfileRevision((r) => r + 1);
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, []);

  React.useEffect(() => {
    if (loading || !uid) return;
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
  }, [loading, uid, authFetch, pathname, profileRevision]);

  return uid && loaded?.uid === uid ? loaded.identity : null;
}

const MAX_SIDEBAR_PRODUCTS = 8;

/** The founder's products for the sidebar, re-read after each navigation. Null while loading, empty when signed out. */
function useSidebarProducts(): readonly ProductListItem[] | null {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const uid = user?.uid;
  const [loaded, setLoaded] = React.useState<{ uid: string; products: ProductListItem[] } | null>(null);

  React.useEffect(() => {
    if (loading || !uid) return;
    let live = true;
    api<DecksOverview>("/api/decks?overview=1")
      .then((o) => live && setLoaded({ uid, products: o.products }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [loading, uid, pathname]);

  if (!uid) return [];
  return loaded?.uid === uid ? loaded.products : null;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The URL to come back to after signing in: the current page (always a same-site path). */
export function useLoginHref(): string {
  const pathname = usePathname() || "/swipe";
  return `/login?next=${encodeURIComponent(pathname)}`;
}

/**
 * Web: left sidebar. Hidden below md. Needs an <AuthProvider> above it. Collapsing is owned by the parent (ShellFrame), which sets --sidebar-width.
 */
export function Sidebar({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const identity = useShellIdentity();
  // The swipe page announces the server's new balance when an answer is credited; show it at once.
  const announced = useAnnouncedBalance();
  const balance = identity?.balanceRs === undefined ? undefined : (announced ?? identity.balanceRs);
  const products = useSidebarProducts();
  const productsActive = NAV_ITEMS.some((i) => i.href === "/products" && isItemActive(pathname, i));
  // Open while inside Products; the chevron overrides until the next visit to another section.
  const [productsManual, setProductsManual] = React.useState<boolean | null>(null);
  const productsOpen = productsManual ?? productsActive;

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r border-border bg-background md:flex"
    >
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "px-5")}>
        <BrandLink collapsed={collapsed} />
      </div>

      <nav aria-label="Primary" className="mt-2 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item);
            const Icon = item.icon;
            const isProducts = item.href === "/products";
            const isEarnings = item.href === "/wallet" && balance !== undefined;
            const showProducts = isProducts && !collapsed && productsOpen;
            return (
              <li key={item.href}>
                <div className="relative">
                  <Link
                    href={item.href}
                    aria-current={active && !showProducts ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      isProducts && !collapsed && "pr-9",
                      active
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      FOCUS_RING,
                    )}
                  >
                    {active ? (
                      <span aria-hidden className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                    ) : null}
                    <Icon aria-hidden className={cn("size-4 shrink-0", active && "text-accent")} strokeWidth={active ? 2.25 : 1.75} />
                    {collapsed ? null : item.label}
                    {isEarnings && !collapsed ? (
                      // Payouts are not live yet: the item says so instead of showing a balance.
                      <Badge variant="coming" className="ml-auto px-1.5 text-[10px]">
                        Coming soon
                      </Badge>
                    ) : null}
                  </Link>
                  {isProducts && !collapsed ? (
                    <button
                      type="button"
                      onClick={() => setProductsManual(!productsOpen)}
                      aria-expanded={productsOpen}
                      aria-label={productsOpen ? "Hide products" : "Show products"}
                      className={cn(
                        "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                        FOCUS_RING,
                      )}
                    >
                      <ChevronRight aria-hidden className={cn("size-4 transition-transform", productsOpen && "rotate-90")} />
                    </button>
                  ) : null}
                </div>
                {showProducts ? (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {products === null ? (
                      <li role="status" aria-label="Loading products" className="space-y-1.5 px-2.5 py-2">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/5" />
                      </li>
                    ) : null}
                    {(products ?? []).slice(0, MAX_SIDEBAR_PRODUCTS).map((p) => {
                      const href = `/products/${p.id}`;
                      // A test's pages (/decks/<id>/...) belong to the product that owns the test.
                      const current =
                        isActivePath(pathname, href) || p.decks.some((d) => isActivePath(pathname, `/decks/${d.id}`));
                      return (
                        <li key={p.id}>
                          <Link
                            href={href}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "block truncate rounded-md px-2.5 py-1.5 text-sm transition-colors",
                              current ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                              FOCUS_RING,
                            )}
                          >
                            {p.name}
                          </Link>
                        </li>
                      );
                    })}
                    {(products?.length ?? 0) > MAX_SIDEBAR_PRODUCTS ? (
                      <li>
                        <Link href="/products" className={cn("block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground", FOCUS_RING)}>
                          All products
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <Link href="/products/new" className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground", FOCUS_RING)}>
                        <Plus aria-hidden className="size-3.5" /> New product
                      </Link>
                    </li>
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 pb-3">
        {collapsed ? null : (
          <div className="mb-2 border-t border-border pt-2">
            <DecksLeftCompact />
          </div>
        )}
        <Link
          href={NEW_DECK_HREF}
          aria-label="New test"
          title={collapsed ? "New test" : undefined}
          className={cn(buttonVariants({ variant: "default" }), "h-10 w-full", collapsed && "px-0")}
        >
          <Plus aria-hidden strokeWidth={2} />
          {collapsed ? null : "New test"}
        </Link>
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
            collapsed && "justify-center px-0",
            FOCUS_RING,
          )}
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-4" /> : <PanelLeftClose aria-hidden className="size-4" />}
          {collapsed ? null : "Collapse"}
        </button>
      </div>
    </aside>
  );
}

/** Name to show for a signed-in user: their profile name, else their Firebase display name, else their email. */
export function accountLabel(identity: ShellIdentity | null, user: { displayName: string | null; email: string | null }) {
  const name = identity?.name || user.displayName?.trim() || user.email || "Your account";
  const initials = identity?.initials || initialsOf(user.displayName ?? "") || (user.email?.[0] ?? "").toUpperCase() || "?";
  return { name, initials, email: user.email };
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Phone: the right side of the top brand bar. Signed in: the avatar, linking to /profile.
 * Signed out: a Sign in pill to /login?next=<this page>. Nothing while the sign-in state loads.
 */
export function BrandBarAccount() {
  const { user, loading } = useAuth();
  const loginHref = useLoginHref();

  if (loading) return <Skeleton className="size-9 rounded-full" />;

  // Signed out: a sign-in pill.
  if (!user) {
    return (
      <Link href={loginHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 px-4")}>
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

function BrandLink({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/swipe"
      aria-label="PitchSwipe: swipe home"
      title="PitchSwipe"
      className={cn("flex items-center gap-2 rounded-full font-display text-xl font-bold tracking-tight", FOCUS_RING)}
    >
      <BrandMark className="size-8" />
      {collapsed ? null : <span aria-hidden>PitchSwipe</span>}
    </Link>
  );
}
