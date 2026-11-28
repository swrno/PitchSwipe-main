"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import { Check, Copy, Download } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

import { downloadWaitlistCsv, fetchWaitlistRows, type WaitlistRow } from "./api";
import { useDeckResults } from "./use-results";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** The test's Waitlist tab: count, inline search, the full list, Copy all emails and Download emails. */
export function WaitlistScreen({ deckId }: { deckId: string }) {
  const { data, error: loadError } = useDeckResults(deckId);
  const [rows, setRows] = React.useState<WaitlistRow[] | null>(null);
  const [error, setError] = React.useState<string>();
  const [query, setQuery] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
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
  const count = rows ? rows.length : (data?.waitlist.count ?? 0);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(shown.map((r) => r.email).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Use Download emails instead.");
    }
  };
  const download = async () => {
    setBusy(true);
    try {
      await downloadWaitlistCsv(deckId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
          <button
            type="button"
            onClick={download}
            disabled={busy || count === 0}
            className={cn(buttonVariants({ variant: "default" }), "h-11")}
          >
            <Download aria-hidden /> Download emails
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
          <div aria-busy className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{q ? "No email matches your search." : "No one has joined yet."}</p>
        ) : (
          <ul>
            {shown.map((r, i) => (
              <li
                key={`${r.email}-${r.claimedAt}-${i}`}
                className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
              >
                <span className="min-w-0 truncate text-sm font-medium">{r.email}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="rounded-md border border-border px-2 py-0.5 font-medium">{r.card}</span>
                  <span className="tnum w-24 text-right text-muted-foreground">{fmtDate(r.claimedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
