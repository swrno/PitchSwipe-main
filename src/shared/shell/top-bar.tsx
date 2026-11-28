"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Layers, LogIn, LogOut, ListChecks, Palette, User } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/features/auth/ui/provider";
import { haptic } from "@/shared/lib/feel/haptics";
import { breadcrumbFor } from "@/shared/lib/nav";
import { useBreadcrumbItems } from "./breadcrumb";
import { CURRENT_PLAN, decksLeft } from "@/shared/lib/plans";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { useDecksUsed } from "@/features/decks/ui/decks-left";
import { accountLabel, Avatar, useLoginHref } from "./navigation";
import { Skeleton } from "@/shared/ui/skeleton";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const MENU_ITEM = cn("flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted", FOCUS_RING);

/** Web top bar: breadcrumb on the left, theme toggle + account on the right. Hidden below md. */
export function TopBar() {
  const pathname = usePathname();
  const registered = useBreadcrumbItems();
  const crumbs = registered ?? breadcrumbFor(pathname);
  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur md:flex">
      <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
        {crumbs ? (
          <ol className="flex items-center gap-1.5">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <React.Fragment key={`${i}-${c.label}`}>
                  {i > 0 ? (
                    <li aria-hidden className="text-muted-foreground">
                      <ChevronRight className="size-3.5" />
                    </li>
                  ) : null}
                  <li
                    aria-current={last ? "page" : undefined}
                    className={cn("min-w-0 truncate", last ? "font-semibold text-foreground" : "text-muted-foreground")}
                  >
                    {!last && c.href ? (
                      <Link href={c.href} className={cn("rounded-sm hover:text-foreground hover:underline", FOCUS_RING)}>
                        {c.label}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        ) : null}
      </nav>
      <div className="flex items-center gap-2">
        <DecksLeft />
        <ThemeToggle className="size-9 bg-transparent" />
        <TopBarAccount />
      </div>
    </header>
  );
}

/** Phone only: one compact row under the logo bar; the parent crumb is a back link, the current page is the label. */
export function PhoneCrumb() {
  const pathname = usePathname();
  const registered = useBreadcrumbItems();
  const crumbs = registered ?? breadcrumbFor(pathname);
  if (!crumbs || crumbs.length < 2) return null;
  const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.href);
  if (!parent) return null;
  return (
    <nav aria-label="Breadcrumb" className="px-4 pt-1 md:hidden">
      <Link
        href={parent.href as string}
        className={cn("-ml-2 inline-flex min-h-11 max-w-full items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground", FOCUS_RING)}
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{parent.label}</span>
      </Link>
    </nav>
  );
}

/** "980 decks left": the plan allowance minus the founder's decks. Signed in only; re-read after each navigation. */
function DecksLeft() {
  const used = useDecksUsed();
  if (used === null) return null;
  const left = decksLeft(used);
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    <Link
      href="/settings/plan"
      title={`${fmt(used)} of ${fmt(CURRENT_PLAN.deckAllowance)} tests used on the ${CURRENT_PLAN.name} plan`}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        FOCUS_RING,
      )}
    >
      <Layers aria-hidden className="size-4" />
      <span className="tnum font-semibold text-foreground">{fmt(left)}</span>
      <span>{left === 1 ? "test left" : "tests left"}</span>
    </Link>
  );
}

function TopBarAccount() {
  const { user, loading, signOut } = useAuth();
  const loginHref = useLoginHref();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLElement>("button")?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) return <Skeleton className="h-9 w-24 rounded-lg" />;

  if (!user) {
    return (
      <Link href={loginHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
        <LogIn aria-hidden strokeWidth={2} />
        Sign in
      </Link>
    );
  }

  const account = accountLabel(null, user);

  async function handleSignOut() {
    setError(null);
    haptic("select");
    try {
      await signOut();
      // Full load: drops every in-memory trace of the account and wins over the founder gate's redirect.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload is the point here
      window.location.assign("/");
    } catch {
      setError("Could not sign out. Try again.");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu: ${account.name}`}
        className={cn("flex h-9 items-center gap-2 rounded-lg px-1.5 pr-2 hover:bg-muted", FOCUS_RING)}
      >
        <Avatar initials={account.initials} className="size-7 text-xs" />
        <span className="max-w-[10rem] truncate text-sm font-medium">{account.name}</span>
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className={MENU_ITEM}
          >
            <User aria-hidden className="size-4" />
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/appearance"
            onClick={() => setOpen(false)}
            className={MENU_ITEM}
          >
            <Palette aria-hidden className="size-4" />
            Appearance
          </Link>
          <Link
            role="menuitem"
            href="/settings/plan"
            onClick={() => setOpen(false)}
            className={MENU_ITEM}
          >
            <ListChecks aria-hidden className="size-4" />
            Plan
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className={cn(MENU_ITEM, "w-full")}
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
          {error ? (
            <p role="alert" className="px-2.5 py-1 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
