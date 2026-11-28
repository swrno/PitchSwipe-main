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
import { ProductTestsSkeleton } from "@/shared/ui/page-skeletons";

/** A product's Tests tab: the Add test action, then its tests with status, swipers and waitlist. */
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
  if (product === undefined) return <ProductTestsSkeleton />;
  if (product === null) return <Notice tone="error">Product not found.</Notice>;

  const count = product.decks.length;
  return (
    <div className="space-y-4">
      {count > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "test" : "tests"} · {product.decks.filter((d) => d.status === "live").length} live
          </p>
          <Link href={`/decks/new?product=${product.id}`} className={cn(buttonVariants({ variant: "default" }))}>
            <Plus /> Add test
          </Link>
        </div>
      ) : null}
      {count === 0 ? (
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
