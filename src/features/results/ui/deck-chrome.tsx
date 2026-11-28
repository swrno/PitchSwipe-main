"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

import { DownloadResultsButton } from "@/features/export/ui";
import { useBreadcrumb } from "@/shared/shell/breadcrumb";
import { PageHeader } from "@/shared/shell/page-header";
import { isTabActive, type PageTab } from "@/shared/shell/page-tabs";
import type { SwitcherView } from "@/features/results/types";
import { cn } from "@/shared/lib/utils";

import { resultsJson } from "./api";

/** Part of the path after /decks/<id>, so switching decks keeps the same page ("" or "/boost"). */
function pageSuffix(pathname: string, currentId: string): string {
  const prefix = `/decks/${currentId}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
}

function SwitcherButton({
  view,
  open,
  onClick,
  className,
}: {
  view: SwitcherView | null;
  open?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open ?? false}
      aria-label={
        view
          ? `Switch test, now ${view.productName} ${view.currentLabel}`
          : "Switch test"
      }
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-background text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        open ? "border-primary" : "border-border",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col leading-tight md:flex-row md:items-center md:gap-0">
        <span className="text-xs text-muted-foreground md:hidden">
          {view?.productName ?? " "}
        </span>
        <span className="truncate text-base font-extrabold tracking-tight md:text-sm md:font-bold">
          {view?.currentLabel ?? "Test"}
        </span>
      </span>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 transition-transform",
          open && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}

/** F10b deck switcher (phone 22, web 24): every deck of the product, same page and tab kept on switch. */
function DeckSwitcher({ view }: { view: SwitcherView }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const ref = React.useRef<HTMLDivElement>(null);
  const suffix = pageSuffix(pathname, view.currentId);
  const query = search.toString() ? `?${search.toString()}` : "";

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="md:relative">
      <SwitcherButton
        view={view}
        open={open}
        onClick={() => setOpen((o) => !o)}
        className="px-3.5 py-1.5 md:px-3 md:py-1"
      />
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-black/25 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div
          role="menu"
          aria-label={`${view.productName} tests`}
          className="absolute right-0 top-full z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 shadow-xl md:w-80"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {view.productName} · {view.items.length}{" "}
            {view.items.length === 1 ? "test" : "tests"}
          </p>
          <ul>
            {view.items.map((item) => (
              <li key={item.id}>
                <Link
                  role="menuitem"
                  href={`/decks/${item.id}${suffix}${query}`}
                  aria-current={item.current ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-muted",
                    item.current && "bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold tracking-tight">
                      {item.label}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {item.statusText}
                    </span>
                  </span>
                  {item.current && (
                    <Check className="size-5 shrink-0" aria-label="On screen" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link
              role="menuitem"
              href={`/products/${view.productId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-extrabold tracking-tight hover:bg-muted"
            >
              All tests of {view.productName}{" "}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Header shared by every deck-level page (results, Who swiped, Waitlist, Share, and any page added under
 * /decks/[id]/): title, deck switcher + download, and the Results · Who swiped · Waitlist · Share tabs.
 * Registers the real names for the top bar's breadcrumb. Wrapped by app/(shell)/decks/[id]/layout.tsx.
 */
export function DeckChrome({
  deckId,
  children,
}: {
  deckId: string;
  children: React.ReactNode;
}) {
  const [loaded, setLoaded] = React.useState<{ deckId: string; view: SwitcherView } | null>(null);
  const pathname = usePathname();
  const view = loaded?.deckId === deckId ? loaded.view : null;

  React.useEffect(() => {
    let cancelled = false;
    resultsJson<SwitcherView>(
      `/api/results/${encodeURIComponent(deckId)}?view=switcher`,
    )
      .then((v) => !cancelled && setLoaded({ deckId, view: v }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const base = `/decks/${deckId}`;
  const tabs: PageTab[] = [
    { label: "Results", href: base, exact: true },
    { label: "Who swiped", href: `${base}/who-swiped` },
    { label: "Waitlist users", href: `${base}/waitlist` },
    { label: "Share", href: `${base}/share` },
  ];
  const active = tabs.find((t) => isTabActive(pathname, t));
  const sub = active && active.label !== "Results" ? active.label : null;
  useBreadcrumb(
    view
      ? [
          { label: "Products", href: "/products" },
          { label: view.productName, href: `/products/${view.productId}` },
          sub ? { label: view.currentLabel, href: base } : { label: view.currentLabel },
          ...(sub ? [{ label: sub }] : []),
        ]
      : null,
  );

  return (
    <div>
      <PageHeader
        title={view?.currentLabel ?? <span className="inline-block h-8 w-40 rounded-lg bg-muted align-middle motion-safe:animate-pulse" />}
        description={
          !view
            ? undefined
            : sub === "Waitlist users"
              ? "Everyone who joined the waitlist for this test."
              : sub === "Who swiped"
              ? "Where swipers are, who they are and what they care about."
              : sub === "Share"
              ? `Send ${view.productName} to people who can answer.`
              : sub
                ? "Choose who sees this test."
                : "See which version is winning, then ship it."
        }
        actions={
          <>
            {view ? (
              <React.Suspense fallback={<SwitcherButton view={view} className="px-3.5 py-1.5" />}>
                <DeckSwitcher view={view} />
              </React.Suspense>
            ) : (
              <SwitcherButton view={null} className="px-3.5 py-1.5" />
            )}
            {/* Results and Who swiped both export the same bundle (it includes the who-swiped tables). */}
            {!sub || sub === "Who swiped" ? <DownloadResultsButton deckId={deckId} /> : null}
          </>
        }
        tabs={tabs}
        tabsLabel="Test sections"
      />
      {children}
    </div>
  );
}
