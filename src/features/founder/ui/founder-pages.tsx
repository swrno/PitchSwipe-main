"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { CURRENT_PLAN, decksLeft } from "@/shared/lib/plans";
import { useAuth } from "@/features/auth/ui/provider";
import type { DecksOverview, ProductListItem } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";

const TITLE = "text-2xl md:text-3xl font-semibold tracking-tight";
const CARD = "rounded-xl border border-border bg-card";
const fmt = (n: number) => n.toLocaleString("en-IN");

type State = { products: ProductListItem[] } | { error: string } | null;

function useOverview(): State {
  const { user, authFetch } = useAuth();
  const [state, setState] = React.useState<State>(null);
  const uid = user?.uid;
  React.useEffect(() => {
    if (!uid) return;
    let live = true;
    authFetch("/api/decks?overview=1")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load your decks. Try again.");
        const data = (await res.json()) as DecksOverview;
        if (live) setState({ products: Array.isArray(data.products) ? data.products : [] });
      })
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => {
      live = false;
    };
  }, [uid, authFetch]);
  return state;
}

function NewDeckLink() {
  return (
    <Link href="/decks/new" className={cn(buttonVariants({ variant: "default" }), "h-10")}>
      <Plus aria-hidden strokeWidth={2} />
      New deck
    </Link>
  );
}

const allDecks = (products: ProductListItem[]) =>
  products.flatMap((p) => p.decks.map((d) => ({ deck: d, product: p })));

function Kpi({ label, value, children }: { label: string; value: number; children?: React.ReactNode }) {
  return (
    <div className={cn(CARD, "p-4")}>
      <p className="flex items-baseline gap-1.5">
        <span className="tnum text-2xl font-semibold">{fmt(value)}</span>
        {children}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm font-medium text-muted-foreground hover:text-foreground">
      View all
    </Link>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-56 rounded-xl bg-muted motion-safe:animate-pulse md:col-span-2" />
        <div className="h-56 rounded-xl bg-muted motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export function OverviewScreen() {
  const state = useOverview();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={TITLE}>Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your tests at a glance</p>
        </div>
        <NewDeckLink />
      </div>
      {!state ? (
        <OverviewSkeleton />
      ) : "error" in state ? (
        <div role="alert" className={cn(CARD, "flex flex-col items-start gap-3 p-6")}>
          <p className="text-sm text-destructive">{state.error}</p>
          <button type="button" onClick={() => window.location.reload()} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Try again
          </button>
        </div>
      ) : (
        <OverviewBody products={state.products} />
      )}
    </div>
  );
}

function OverviewBody({ products }: { products: ProductListItem[] }) {
  const rows = allDecks(products);
  if (rows.length === 0) {
    return (
      <div className={cn(CARD, "flex flex-col items-center gap-3 p-10 text-center")}>
        <h2 className="text-xl font-semibold">Test your first idea</h2>
        <p className="text-muted-foreground">Describe it in your own words and AI drafts the pitch.</p>
        <Link href="/decks/new" className={cn(buttonVariants({ variant: "default" }), "h-10")}>
          Tell me what&apos;s on your mind
        </Link>
      </div>
    );
  }
  const live = rows.filter((r) => r.deck.tone === "live" || r.deck.tone === "leading");
  const review = rows.filter((r) => r.deck.tone === "ready");
  const swipers = rows.reduce((n, r) => n + r.deck.swipers, 0);
  const waitlist = products.reduce((n, p) => n + p.waitlist, 0);
  const left = decksLeft(rows.length);
  const allowance = CURRENT_PLAN.deckAllowance;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Live decks" value={live.length} />
        <Kpi label="Swipers" value={swipers} />
        <Kpi label="Joined waitlist" value={waitlist} />
        <div className={cn(CARD, "p-4")}>
          <p className="flex items-baseline gap-1.5">
            <span className="tnum text-2xl font-semibold">{fmt(left)}</span>
            <span className="text-xs text-muted-foreground">of {fmt(allowance)}</span>
          </p>
          <p className="text-xs text-muted-foreground">Decks left</p>
          <div className="mt-2 h-1 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((left / allowance) * 100)}%` }} />
          </div>
        </div>
      </div>

      {review.length > 0 ? (
        <section className={cn(CARD, "border-l-2 border-l-accent")}>
          <h2 className="px-4 pt-4 text-lg font-semibold">Needs your review</h2>
          <ul className="divide-y divide-border">
            {review.map(({ deck, product }) => (
              <li key={deck.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {product.name} · {deck.label}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {deck.statusLabel}
                    {deck.chance !== undefined ? ` · ${Math.round(deck.chance * 100)}% sure` : ""}
                  </span>
                </span>
                <Link href={`/decks/${deck.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0")} aria-label={`Review ${product.name} ${deck.label}`}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <section className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Live tests</h2>
            <ViewAll href="/products" />
          </div>
          {live.length === 0 ? (
            <p className={cn(CARD, "p-4 text-sm text-muted-foreground")}>No live tests right now.</p>
          ) : (
            <ul className={cn(CARD, "divide-y divide-border overflow-hidden")}>
              {live.map(({ deck, product }) => (
                <li key={deck.id}>
                  <Link
                    href={`/decks/${deck.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{product.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{deck.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs font-medium">{deck.statusLabel}</span>
                      <span className="tnum w-24 text-right text-muted-foreground">{fmt(deck.swipers)} {deck.swipers === 1 ? "swiper" : "swipers"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Products</h2>
            <ViewAll href="/products" />
          </div>
          <ul className={cn(CARD, "divide-y divide-border overflow-hidden")}>
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.deckCount} {p.deckCount === 1 ? "deck" : "decks"} · {fmt(p.waitlist)} waitlist
                  </span>
                </span>
                <Link href={`/products/${p.id}/insights`} className="shrink-0 rounded-sm text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  Insights
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

