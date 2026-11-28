"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

import { fetchWaitlistRows, type WaitlistRow } from "./api";
import { useDeckResults } from "./use-results";
import { SheetGrid } from "@/features/export/ui/file-preview";
import type { SheetData } from "@/features/export/sheet";
import { SheetGridSkeleton } from "@/shared/ui/page-skeletons";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** The test's Waitlist tab: count, inline search, the full list, and Copy all emails. */
export function WaitlistScreen({ deckId }: { deckId: string }) {
  const { data, error: loadError } = useDeckResults(deckId);
  const [rows, setRows] = React.useState<WaitlistRow[] | null>(null);
  const [error, setError] = React.useState<string>();
  const [query, setQuery] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    fetchWaitlistRows(deckId)
      .then((r) => live && setRows(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [deckId, tick]);

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => r.email.toLowerCase().includes(q));
  const sheet = React.useMemo<SheetData>(
    () => ({
      rows: shown.length ? [["email", "version", "date"], ...shown.map((r) => [r.email, r.card, fmtDate(r.claimedAt)])] : [],
      total: shown.length,
      columns: 3,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, q],
  );
  const count = rows ? rows.length : (data?.waitlist.count ?? 0);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(shown.map((r) => r.email).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Use Download in the header instead.");
    }
  };
  return (
    <Card className="w-full p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight"><IconLabel icon="waitlist">Waitlist users</IconLabel></h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tnum text-2xl font-semibold text-foreground">{count}</span>{" "}
            {count === 1 ? "person" : "people"} claimed
            {data?.waitlist.reward ? ` "${data.waitlist.reward}"` : " the reward"}. One list for every card in this test.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAll}
            disabled={shown.length === 0}
            className={cn(buttonVariants({ variant: "outline" }), "h-11")}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy all emails"}
          </button>
        </div>
      </div>
      <label htmlFor="waitlist-search" className="sr-only">
        Search by email
      </label>
      <input
        id="waitlist-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by email"
        className="mt-4 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div aria-live="polite" className="mt-3">
        {error || loadError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-destructive">{error ?? loadError}</p>
            <button
              type="button"
              onClick={() => {
                setError(undefined);
                setRows(null);
                setTick((n) => n + 1);
              }}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Try again
            </button>
          </div>
        ) : !rows ? (
          <SheetGridSkeleton label="the waitlist" />
        ) : (
          <SheetGrid
            sheet={sheet}
            empty={q ? "No email matches your search." : "No one has joined yet."}
            label="Waitlist"
            frameClassName="h-[calc(100dvh-22rem)] min-h-64 md:h-[560px]"
          />
        )}
      </div>
    </Card>
  );
}
