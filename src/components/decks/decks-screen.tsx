"use client";

import * as React from "react";
import Link from "next/link";
import { Flag, Plus, Settings, Sparkles, Wallet, Zap } from "lucide-react";
import { ReadyToShipAlert } from "@/components/assistant";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DECK_FILTERS, DECK_FILTER_LABELS, matchesFilter, type DeckFilter } from "@/lib/decks/status";
import type { DeckListItem, DecksOverview, ProductListItem } from "@/lib/decks/views";
import { cn } from "@/lib/utils";
import { api } from "./api";
import { Notice, ProductTile, StatusText, ToggleChip } from "./ui";

const smallButton = buttonVariants({ variant: "outline", size: "sm" });

/** F1 My decks (phone 02, web 03): products with their decks, status filters. */
export function DecksScreen({ initial }: { initial?: DecksOverview }) {
  const [overview, setOverview] = React.useState<DecksOverview | undefined>(initial);
  const [error, setError] = React.useState<string>();
  const [filter, setFilter] = React.useState<DeckFilter>("all");

  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    api<DecksOverview>("/api/decks?overview=1")
      .then((data) => !cancelled && setOverview(data))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const products = overview?.products ?? [];
  const visible = products
    .map((p) => ({ ...p, decks: p.decks.filter((d) => matchesFilter(d.status, filter)) }))
    .filter((p) => filter === "all" || p.decks.length > 0);

  return (
    <div className="rise-children space-y-5">
      <div className="mb-2 flex h-5 items-center justify-between md:hidden">
        <span className="sr-only">Deck allowance</span>
        <span />
        {overview ? (
          <p className="text-sm font-medium text-muted-foreground">
            {overview.allowance ? `${overview.allowance.left} of ${overview.allowance.total} decks left · ` : null}
            <Link href="/decks/plans" className="font-semibold text-foreground underline">
              Plans
            </Link>
          </p>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl">
            <span className="md:hidden">My decks</span>
            <span className="hidden md:inline">Your decks</span>
          </h1>
          <p className="mt-2 hidden text-base text-muted-foreground md:block">
            Grouped by product. Each deck tests one thing, with 2 or 3 versions.
          </p>
        </div>
        <Link href="/decks/new" className={cn(buttonVariants({ size: "default" }), "shrink-0")}>
          <Plus /> New deck
        </Link>
      </div>

      <ReadyToShipAlert />

      <div className="flex items-center justify-between gap-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1" role="group" aria-label="Filter decks">
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
        <Link href="/products/new" className="hidden shrink-0 text-sm font-semibold underline md:inline-flex md:items-center md:gap-1.5">
          <Plus className="size-4" /> New product
        </Link>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {!overview && !error ? <p className="text-muted-foreground">Loading your decks…</p> : null}

      {visible.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}

      {overview && visible.length === 0 ? (
        <Notice>No decks here yet. Start with “New deck”.</Notice>
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
            <Wallet className="size-4 text-accent" /> Deck pack
          </p>
          <p className="mb-4 text-muted-foreground">
            {overview?.allowance ? (
              <>
                {overview.allowance.left} of {overview.allowance.total} decks left.{" "}
              </>
            ) : null}
            Rs 200 buys 10 decks.
          </p>
          <Link href="/decks/plans" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Buy 10 decks
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

      {overview?.demo ? (
        <p className="text-xs text-muted-foreground">Demo data. Set MONGODB_URI to save your own products and decks.</p>
      ) : null}
    </div>
  );
}

function ProductCard({ product }: { product: ProductListItem }) {
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
              {product.deckCount} {product.deckCount === 1 ? "deck" : "decks"} · {product.waitlist} on waitlist
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/products/${product.id}`} aria-label={`${product.name} settings`} className={cn(smallButton, "border-0 px-2 md:border md:px-4")}>
              <Settings />
              <span className="hidden md:inline">Settings</span>
            </Link>
            <Link href={`/products/${product.id}/insights`} className={cn(smallButton, "border-0 px-2 underline md:border md:px-4 md:no-underline")}>
              <Sparkles className="text-accent" /> Insights
            </Link>
            <Link href={`/decks/new?product=${product.id}`} className={cn(smallButton, "hidden md:inline-flex")}>
              <Plus /> Add deck
            </Link>
          </div>
        </div>

        <ul className="mt-3 divide-y divide-border md:mt-4 md:rounded-xl md:border md:border-border md:bg-card md:px-5">
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

function DeckRow({ deck, accent }: { deck: DeckListItem; accent: ProductListItem }) {
  const href = deck.status === "draft" ? `/decks/new?draft=${deck.id}` : `/decks/${deck.id}`;
  return (
    <li className="flex items-center gap-3">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg py-4 transition-colors duration-150 hover:bg-muted/40 active:bg-muted/60 md:py-5">
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
        <Link href={`/decks/${deck.id}/boost`} className={cn(smallButton, "hidden md:inline-flex")}>
          <Zap aria-hidden /> Boost
        </Link>
      ) : null}
    </li>
  );
}
