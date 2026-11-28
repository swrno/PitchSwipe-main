"use client";

import * as React from "react";
import { api } from "@/features/decks/ui/api";
import type { ProductRecord } from "@/features/decks/views";
import type { DeckRecord } from "@/features/decks/types";

export interface BoostData {
  deck: Pick<DeckRecord, "_id" | "slug" | "variable">;
  product: ProductRecord;
}

/** The founder's deck and its product, loaded with their sign-in token. Shared by Audience & Boost and Share. */
export function useDeckAndProduct(deckId: string): { data?: BoostData; loadError?: string } {
  const [data, setData] = React.useState<BoostData | undefined>();
  const [loadError, setLoadError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    api<DeckRecord>(`/api/decks/${deckId}`)
      .then(async (deck) => {
        const product = await api<ProductRecord>(`/api/products/${deck.productId}`);
        if (!cancelled) setData({ deck, product });
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  return { data, loadError };
}
