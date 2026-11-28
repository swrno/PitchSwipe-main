"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import type { DecksOverview, ProductListItem } from "@/features/decks/views";
import { cn } from "@/shared/lib/utils";
import { api } from "./api";
import { DeckRow } from "./decks-screen";
import { Notice } from "./primitives";

/** A product's Decks tab: its decks with status, swipers and waitlist. */
export function ProductDecks({ productId }: { productId: string }) {
  const [product, setProduct] = React.useState<ProductListItem | null | undefined>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    api<DecksOverview>("/api/decks?overview=1")
      .then((o) => !cancelled && setProduct(o.products.find((p) => p.id === productId) ?? null))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (product === undefined)
    return (
      <div aria-busy className="space-y-6">
        <span className="sr-only">Loading tests</span>
        <div className="h-32 rounded-xl bg-muted motion-safe:animate-pulse" />
      </div>
    );
  if (product === null) return <Notice tone="error">Product not found.</Notice>;

  return (
    <div className="space-y-6">
      {product.decks.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-muted-foreground">No tests yet. Test your first idea for {product.name} in a few minutes.</p>
          <Link href={`/decks/new?product=${product.id}`} className={cn(buttonVariants({ variant: "default" }))}>
            <Plus /> Add test
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card p-2 md:space-y-0.5 md:divide-y-0">
          {product.decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} accent={product} />
          ))}
        </ul>
      )}
    </div>
  );
}
