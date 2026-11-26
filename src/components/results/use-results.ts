"use client";

import * as React from "react";

import type { ResultsPayload } from "@/lib/results/types";

import { resultsJson } from "./api";

/** Results for one deck: server-rendered `initial` in demo mode, otherwise loaded with the sign-in token. */
export function useDeckResults(deckId: string, initial?: ResultsPayload) {
  const [data, setData] = React.useState<ResultsPayload | undefined>(initial);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    resultsJson<ResultsPayload>(`/api/results/${encodeURIComponent(deckId)}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [deckId, initial]);

  return { data, error };
}
