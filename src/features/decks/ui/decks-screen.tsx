"use client";

import * as React from "react";
import Link from "next/link";
import { Flag, Plus, Settings, Sparkles, Wallet, Zap } from "lucide-react";
import { ReadyToShipAlert } from "@/features/assistant/ui";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { DECK_FILTERS, DECK_FILTER_LABELS, matchesFilter, type DeckFilter } from "@/features/decks/status";
import type { DeckListItem, DecksOverview, ProductListItem } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/shell/page-header";
import { api } from "./api";
import { Notice, ProductTile, StatusText, ToggleChip } from "./primitives";

const smallButton = buttonVariants({ variant: "outline", size: "sm" });

/** F1 My decks (phone 02, web 03): products with their decks, status filters. */
export function DecksScreen() {
  const [overview, setOverview] = React.useState<DecksOverview | undefined>();
  const [error, setError] = React.useState<string>();
  const [filter, setFilter] = React.useState<DeckFilter>("all");

  React.useEffect(() => {
    let cancelled = false;
    api<DecksOverview>("/api/decks?overview=1")
      .then((data) => !cancelled && setOverview(data))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const products = overview?.products ?? [];
  const deckTotal = products.reduce((n, p) => n + p.decks.length, 0);
  const visible = products
    .map((p) => ({ ...p, decks: p.decks.filter((d) => matchesFilter(d.status, filter)) }))
    .filter((p) => filter === "all" || p.decks.length > 0);

  return (
    <div className="rise-children space-y-5">
      <PageHeader
        title="Products"
        description={
          overview
            ? `${deckTotal} ${deckTotal === 1 ? "test" : "tests"} across ${products.length} ${products.length === 1 ? "product" : "products"}. Each tests one thing, with 2 or 3 versions.`
            : "Each tests one thing, with 2 or 3 versions."
        }
        actions={
          <Link href="/products/new" className={cn(buttonVariants({ variant: "outline", size: "default" }), "shrink-0")}>
            <Plus /> New product
          </Link>
        }
        className="mb-0"
      />

      <ReadyToShipAlert />

      <div className="flex items-center justify-between gap-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1" role="group" aria-label="Filter tests">
          {DECK_FILTERS.map((f) => (
            <ToggleChip
              key={f}
              selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(f === "archived" && "hidden md:inline-flex")}
            >
              {DECK_FILTER_LABELS[f]}
            </ToggleChip>
          ))}
        </div>
      </div>

      {error ? (
        <div role="alert" className="space-y-3">
          <Notice tone="error">{error}</Notice>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button>
        </div>
      ) : null}
      {!overview && !error ? (
        <div aria-busy className="space-y-3">
          <span className="sr-only">Loading your tests</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      ) : null}

      {visible.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}

      {overview && visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-muted-foreground">
            {filter === "all" ? "No tests yet. Test your first idea in a few minutes." : "No tests match this filter."}
          </p>
          {filter === "all" ? (
            <Link href="/decks/new" className={cn(buttonVariants({ size: "default" }))}>
              <Plus /> New test
            </Link>
          ) : null}
        </div>
      ) : null}

      <Link
        href="/products/new"
        className="flex h-16 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-base font-semibold hover:bg-muted md:hidden"
      >
        <Plus className="size-5" /> New product
      </Link>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 font-bold">
            <Wallet className="size-4 text-accent" /> Test pack
          </p>
          <p className="mb-4 text-muted-foreground">
            Rs 200 buys 10 tests.
          </p>
          <Link href="/settings/plan" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Buy 10 tests
          </Link>
        </Card>
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 font-bold">
            <Flag className="size-4 text-accent" /> How winners are picked
          </p>
          <p className="text-muted-foreground">
            A version wins at a 95% chance of beating the others on reward claims. Until then the deck says “too close to call”.
          </p>
        </Card>
      </div>

    </div>
  );
}

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <section aria-labelledby={`product-${product.id}`}>
      <Card className="p-4 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center gap-2 md:gap-4">
          <ProductTile icon={product.icon} accent={product.accent} className="size-10 text-lg md:hidden" />
          <div className="min-w-0 flex-1">
            <h2 id={`product-${product.id}`} className="text-xl leading-tight md:text-2xl">
              {product.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {product.deckCount} {product.deckCount === 1 ? "test" : "tests"} · {product.waitlist} on waitlist
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/products/${product.id}/settings`} aria-label={`${product.name} settings`} className={cn(smallButton, "border-0 px-2 md:border md:px-4")}>
              <Settings />
              <span className="hidden md:inline">Settings</span>
            </Link>
            <Link href={`/products/${product.id}/insights`} className={cn(smallButton, "border-0 px-2 underline md:border md:px-4 md:no-underline")}>
              <Sparkles className="text-accent" /> Insights
            </Link>
            <Link href={`/decks/new?product=${product.id}`} className={cn(smallButton, "hidden md:inline-flex")}>
              <Plus /> Add test
            </Link>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-border md:mt-4 md:space-y-0.5 md:divide-y-0 md:rounded-xl md:border md:border-border md:bg-card md:p-2">
          {product.decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} accent={product} />
          ))}
          <li className="md:hidden">
            <Link href={`/decks/new?product=${product.id}`} className="block py-4 pl-1 text-base font-semibold text-muted-foreground">
              + Add a deck to {product.name}
            </Link>
          </li>
        </ul>
      </Card>
    </section>
  );
}

export function DeckRow({ deck, accent }: { deck: DeckListItem; accent: ProductListItem }) {
  const href = deck.status === "draft" ? `/decks/new?draft=${deck.id}` : `/decks/${deck.id}`;
  return (
    <li className="relative flex items-center gap-3 rounded-lg transition-colors duration-150 hover:bg-muted/60 has-[a:active]:bg-muted md:px-3">
      {/* The whole row opens the deck (stretched link); Boost sits above it with its own target. */}
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg py-4 outline-none md:py-3.5 after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <ProductTile icon={accent.icon} accent={accent.accent} className="hidden size-12 md:flex" />
        <span className="min-w-0 flex-1 pl-[3.75rem] md:pl-0">
          <span className="block text-lg font-semibold leading-tight">
            {deck.label}
            <span className="hidden md:inline"> test</span>
          </span>
          <span className="hidden text-sm text-muted-foreground md:block">
            {deck.status === "draft" ? "Draft" : deck.versions > 0 ? `${deck.versions} versions` : ""}
          </span>
        </span>
        <span className="hidden w-24 text-center md:block">
          <span className="block text-lg font-bold">{deck.swipers}</span>
          <span className="text-sm text-muted-foreground">Swipers</span>
        </span>
        <span className="hidden w-24 text-center md:block">
          <span className="block text-lg font-bold">{deck.waitlist}</span>
          <span className="text-sm text-muted-foreground">On waitlist</span>
        </span>
        <StatusText tone={deck.tone} className="md:rounded-full md:border md:px-3 md:py-1">
          {deck.statusLabel}
        </StatusText>
      </Link>
      {deck.status === "live" ? (
        <Link href={`/decks/${deck.id}/boost`} className={cn(smallButton, "relative z-10 hidden md:inline-flex")}>
          <Zap aria-hidden /> Boost
        </Link>
      ) : null}
    </li>
  );
}
