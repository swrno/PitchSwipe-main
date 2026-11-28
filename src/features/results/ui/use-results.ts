"use client";

import * as React from "react";

import type { ResultsPayload } from "@/features/results/types";

import { resultsJson } from "./api";

/** Results for one deck, loaded with the sign-in token. */
export function useDeckResults(deckId: string) {
  const [data, setData] = React.useState<ResultsPayload | undefined>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    resultsJson<ResultsPayload>(`/api/results/${encodeURIComponent(deckId)}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  return { data, error };
}
