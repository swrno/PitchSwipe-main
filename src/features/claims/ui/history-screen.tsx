"use client";

import { Layers } from "lucide-react";
import { IconTile } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/shared/ui/button";
import { useAuth } from "@/features/auth/ui/provider";
import { fetchHistory } from "@/features/claims/ui/client";
import { filterItems, groupByDay, summarize, type HistoryFilter, type HistoryItem } from "@/features/claims/history";
import { getSwiperGuid } from "@/features/swipe/ui/client";
import { cn, formatRs } from "@/shared/lib/utils";
import { HistorySkeleton } from "@/shared/ui/page-skeletons";

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "claimed", label: "Claimed" },
];

/** Every card the signed-in swiper answered, newest first (the page gates sign-in). */
export function HistoryScreen() {
  const { loading, authFetch } = useAuth();
  const [items, setItems] = React.useState<HistoryItem[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(false);
  const [filter, setFilter] = React.useState<HistoryFilter>("all");

  React.useEffect(() => {
    if (loading) return;
    let live = true;
    fetchHistory(authFetch, getSwiperGuid())
      .then((page) => {
        if (!live) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load your history."));
    return () => {
      live = false;
    };
  }, [authFetch, loading]);

  async function loadMore() {
    if (!cursor || more) return;
    setMore(true);
    try {
      const page = await fetchHistory(authFetch, getSwiperGuid(), cursor);
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      setMore(false);
    }
  }

  if (error && !items) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft p-4 text-sm text-warning">
        <span>{error}</span>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center rounded-lg border border-warning px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Try again
        </button>
      </div>
    );
  }
  if (!items) {
    return (
      <HistorySkeleton />
    );
  }

  const summary = summarize(items);
  const shown = filterItems(items, filter);
  const groups = groupByDay(shown);
  const yesShare = summary.total ? Math.round((summary.yes / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <section className="rounded-xl border border-border bg-card p-8 text-center">
          <IconTile icon="swipe" className="mx-auto mb-3" />
          <p className="text-lg font-semibold">No swipes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Cards you answer show up here.</p>
          <Link href="/swipe" className={cn(buttonVariants(), "mt-4")}>
            <Layers /> Start swiping
          </Link>
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card">
            <Stat label="Answers" value={String(summary.total)} />
            <Stat label="Said yes" value={`${yesShare}%`} />
            <Stat label="Earned" value={formatRs(summary.earnedRs)} accent />
          </section>

          <div role="group" aria-label="Filter answers" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  filter === f.id ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {groups.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No answers match this filter. Try All.</p> : null}
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {group.items.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}

          {error ? <p role="alert" className="text-sm text-warning">{error}</p> : null}
          {cursor ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={more}>
                {more ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tnum mt-1 text-xl font-semibold", accent && "text-accent")}>{value}</p>
    </div>
  );
}

function Row({ item }: { item: HistoryItem }) {
  return (
    <li className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{item.product}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {item.variable ? `${item.variable}: ` : ""}
          {item.headline}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("tnum", item.earnedRs > 0 ? "font-semibold text-accent" : "text-muted-foreground")}>
            {item.earnedRs > 0 ? `Paid ${formatRs(item.earnedRs)}` : "Unpaid"}
          </span>
          {item.claimed ? <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium">Claimed</span> : null}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
          item.answer === "yes" ? "border-accent text-accent" : "border-border text-muted-foreground",
        )}
      >
        {item.answer === "yes" ? "Yes" : "No"}
      </span>
    </li>
  );
}
