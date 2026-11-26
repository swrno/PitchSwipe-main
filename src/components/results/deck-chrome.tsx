"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronLeft } from "lucide-react";

import { DownloadResultsButton } from "@/components/export";
import { BrandMark } from "@/components/shell/brand-mark";
import type { SwitcherView } from "@/lib/results/types";
import { cn } from "@/lib/utils";

import { resultsJson } from "./api";

/** Part of the path after /decks/<id>, so switching decks keeps the same page ("" or "/who-swiped"). */
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
      aria-label={view ? `Switch deck, now ${view.productName} ${view.currentLabel}` : "Switch deck"}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-background text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        open ? "border-primary" : "border-border",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col leading-tight md:flex-row md:items-center md:gap-0">
        <span className="text-xs text-muted-foreground md:hidden">{view?.productName ?? " "}</span>
        <span className="truncate text-base font-extrabold tracking-tight md:text-sm md:font-bold">
          {view?.currentLabel ?? "Deck"}
        </span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
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
        <div aria-hidden className="fixed inset-0 z-30 bg-black/25 md:hidden" onClick={() => setOpen(false)} />
      )}
      {open && (
        <div
          role="menu"
          aria-label={`${view.productName} decks`}
          className="absolute right-0 top-full z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 shadow-xl md:left-0 md:right-auto md:w-80"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {view.productName} · {view.items.length} {view.items.length === 1 ? "deck" : "decks"}
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
                    <span className="block text-base font-extrabold tracking-tight">{item.label}</span>
                    <span className="block text-sm text-muted-foreground">{item.statusText}</span>
                  </span>
                  {item.current && <Check className="size-5 shrink-0" aria-label="On screen" />}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border pt-1">
            <Link
              role="menuitem"
              href={`/products/${view.productId}/insights`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-base font-extrabold tracking-tight hover:bg-muted"
            >
              All decks: product insights <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Header shared by every deck-level page (results, Who swiped, and any page added under
 * /decks/[id]/): back, product icon, deck switcher, download. Phone is one row; web is a
 * breadcrumb "Decks / Voice Khata / [switcher]". Wrapped by app/(shell)/decks/[id]/layout.tsx.
 */
export function DeckChrome({
  deckId,
  initial,
  children,
}: {
  deckId: string;
  initial?: SwitcherView | null;
  children: React.ReactNode;
}) {
  const [view, setView] = React.useState<SwitcherView | null>(initial ?? null);
  // Ask your results (phone 26, web 26) is a product-level chat: web breadcrumb "Products / Name", no deck switcher.
  const pathname = usePathname();
  const isAsk = pathname.endsWith("/ask");
  // Audience and Boost (phone 13, web 15) draws its own back row / breadcrumb, so it gets no second header here.
  const hasOwnHeader = pathname.endsWith("/boost");

  React.useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    resultsJson<SwitcherView>(`/api/results/${encodeURIComponent(deckId)}?view=switcher`)
      .then((v) => !cancelled && setView(v))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [deckId, initial]);

  if (hasOwnHeader) return <div>{children}</div>;

  if (isAsk) {
    return (
      <div>
        <p className="mb-2 hidden text-sm text-muted-foreground md:block">
          <Link href="/decks" className="hover:text-foreground">
            Products
          </Link>{" "}
          / <span>{view?.productName ?? ""}</span>
        </p>
        {children}
      </div>
    );
  }

  return (
    <div>
      <header data-hide-brand-bar className="mb-4 md:mb-5">
        {/* Phone */}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="flex items-center gap-3">
            <Link
              href="/decks"
              aria-label="Back to My decks"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-background"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <BrandMark className="size-8" />
          </div>
          <div className="relative flex items-center gap-2">
            {view ? (
              <React.Suspense fallback={<SwitcherButton view={view} className="px-3.5 py-1.5" />}>
                <DeckSwitcher view={view} />
              </React.Suspense>
            ) : (
              <SwitcherButton view={null} className="px-3.5 py-1.5" />
            )}
            <DownloadResultsButton deckId={deckId} />
          </div>
        </div>

        {/* Web */}
        <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
          <Link href="/decks" className="hover:text-foreground">
            Decks
          </Link>
          <span>/</span>
          <span>{view?.productName ?? ""}</span>
          <span>/</span>
          {view ? (
            <React.Suspense fallback={<SwitcherButton view={view} className="px-3 py-1" />}>
              <DeckSwitcher view={view} />
            </React.Suspense>
          ) : (
            <SwitcherButton view={null} className="px-3 py-1" />
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
