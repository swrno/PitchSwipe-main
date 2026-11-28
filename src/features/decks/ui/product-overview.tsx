"use client";

import { Icon, IconLabel, IconTile, type IconName } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { resultsJson } from "@/features/results/ui/api";
import type { LeaderRow, ResultsPayload } from "@/features/results/types";
import type { DeckListItem, DecksOverview, ProductListItem } from "@/features/decks/views";
import { TEST_VARIABLE_LABELS, TEST_VARIABLES } from "@/shared/lib/lists";
import { cn } from "@/shared/lib/utils";
import { DownloadResultsButton } from "@/features/export/ui";
import { api } from "./api";
import { Notice, StatusText } from "./primitives";

const CARD = "rounded-xl border border-border bg-card";
const n = (x: number) => x.toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const href = (d: DeckListItem) => (d.status === "draft" ? `/decks/new?draft=${d.id}` : `/decks/${d.id}`);

/** The leading version of one test (the verdict's leader, else the top row). */
function leaderOf(r: ResultsPayload): LeaderRow | null {
  const rows = r.leaderboard.everyone;
  return rows.find((x) => x.key === r.verdict.leaderKey) ?? rows[0] ?? null;
}

function Kpi({ value, label, icon }: { value: string; label: string; icon: IconName }) {
  return (
    <div className={cn(CARD, "relative h-full p-4 pr-10")}>
      <Icon icon={icon} className="absolute right-3 top-3 text-muted-foreground" />
      <p className="tnum text-2xl font-semibold">{value}</p>
      <p className="line-clamp-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Claim-rate bar with its value written on it. */
function RateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-sm text-muted-foreground">No data yet</span>;
  const w = Math.max(0, Math.min(100, Math.round(rate * 100)));
  return (
    <span className="relative block h-6 w-full min-w-24 overflow-hidden rounded-md bg-muted" role="img" aria-label={`Claim rate ${pct(rate)}`}>
      <span className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${w}%` }} />
      <span className="tnum relative flex h-full items-center px-2 text-xs font-semibold">{pct(rate)}</span>
    </span>
  );
}

/** A product's Overview tab: KPIs, tests to review, tests at a glance, and the next test to run. */
export function ProductOverview({ productId }: { productId: string }) {
  const [product, setProduct] = React.useState<ProductListItem | null | undefined>();
  const [results, setResults] = React.useState<Record<string, ResultsPayload>>({});
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let cancelled = false;
    api<DecksOverview>("/api/decks?overview=1")
      .then((o) => {
        if (cancelled) return;
        const p = o.products.find((x) => x.id === productId) ?? null;
        setProduct(p);
        for (const d of p?.decks ?? []) {
          if (d.status === "draft") continue;
          resultsJson<ResultsPayload>(`/api/results/${encodeURIComponent(d.id)}`)
            .then((r) => !cancelled && setResults((prev) => ({ ...prev, [d.id]: r })))
            .catch(() => undefined);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (product === undefined)
    return (
      <div aria-busy className="space-y-6">
        <span className="sr-only">Loading overview</span>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
        <div className="h-40 rounded-xl bg-muted motion-safe:animate-pulse" />
      </div>
    );
  if (product === null) return <Notice tone="error">Product not found.</Notice>;

  const newHref = `/decks/new?product=${product.id}`;
  if (product.decks.length === 0)
    return (
      <div className={cn(CARD, "flex flex-col items-center gap-3 p-10 text-center")}>
        <IconTile icon="test" />
        <h2 className="text-xl font-semibold">Create your first test</h2>
        <p className="text-muted-foreground">Test an idea for {product.name} in a few minutes and see which version wins.</p>
        <Link href={newHref} className={cn(buttonVariants({ variant: "default" }))}>
          <Plus /> Create your first test
        </Link>
      </div>
    );

  const decks = product.decks;
  const live = decks.filter((d) => d.status === "live").length;
  const swipers = decks.reduce((s, d) => s + d.swipers, 0);
  const loaded = Object.values(results);
  const totalSwipers = loaded.reduce((s, r) => s + r.totals.swipers, 0);
  const totalYes = loaded.reduce((s, r) => s + r.totals.saidYes, 0);
  const pending = loaded.length < decks.filter((d) => d.status !== "draft").length;
  const yesPct = totalSwipers > 0 ? `${Math.round((totalYes / totalSwipers) * 100)}%` : pending ? "…" : "0%";
  const review = decks.filter((d) => d.tone === "ready");
  const tested = new Set(decks.map((d) => d.variable));
  const next = TEST_VARIABLES.find((v) => !tested.has(v));

  const started = decks.find((d) => d.status !== "draft");
  return (
    <div className="space-y-6">
      {started && (
        <div className="flex justify-end">
          <DownloadResultsButton deckId={started.id} initialTab="results" initialScope="product" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon="live" value={`${live} of ${decks.length}`} label="Tests live" />
        <Kpi icon="swipers" value={n(swipers)} label="Swipers" />
        <Kpi icon="saidYes" value={yesPct} label="Said yes" />
        <Kpi icon="joined" value={n(product.waitlist)} label="Joined waitlist" />
      </div>

      {review.length > 0 && (
        <section className={cn(CARD, "border-l-2 border-l-accent")} aria-labelledby="review-h">
          <h2 id="review-h" className="px-4 pt-4 text-lg font-semibold">
            <IconLabel icon="statusDraft">Needs your review</IconLabel>
          </h2>
          <ul className="divide-y divide-border">
            {review.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {d.statusLabel}
                    {d.chance !== undefined ? ` · ${Math.round(d.chance * 100)}% sure` : ""}
                  </span>
                </span>
                <Link href={`/decks/${d.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "shrink-0")} aria-label={`Review ${d.label}`}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="glance-h">
        <div className="flex items-center justify-between">
          <h2 id="glance-h" className="text-lg font-semibold">
            <IconLabel icon="tests">Tests at a glance</IconLabel>
          </h2>
          <Link href={`/products/${product.id}/tests`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        <ul className={cn(CARD, "divide-y divide-border overflow-hidden")}>
          {decks.map((d) => {
            const r = results[d.id];
            const lead = r ? leaderOf(r) : null;
            return (
              <li key={d.id} className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-muted/60 md:flex-nowrap">
                <Link href={href(d)} className="min-w-0 flex-1 basis-40 font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  <span className="block truncate">{d.label}</span>
                  <span className="block truncate text-sm font-normal text-muted-foreground">{lead ? `Leading: ${lead.label}` : d.status === "draft" ? "Draft" : " "}</span>
                </Link>
                <span className="w-full basis-40 md:w-48 md:flex-none">{lead ? <RateBar rate={lead.claimRate} /> : null}</span>
                <span className="w-16 text-center">
                  <span className="tnum block font-semibold">{n(d.swipers)}</span>
                  <span className="text-xs text-muted-foreground">Swipers</span>
                </span>
                <StatusText tone={d.tone} className="rounded-full border px-3 py-1">
                  {d.statusLabel}
                </StatusText>
              </li>
            );
          })}
        </ul>
      </section>

      {next && (
        <section className={cn(CARD, "flex flex-wrap items-center justify-between gap-3 p-4")} aria-labelledby="next-h">
          <div className="min-w-0">
            <h2 id="next-h" className="text-lg font-semibold">
              Suggested next test
            </h2>
            <p className="text-muted-foreground">{TEST_VARIABLE_LABELS[next]}: not tested yet. Change only this one thing.</p>
          </div>
          <Link href={newHref} className={cn(buttonVariants({ variant: "default" }))}>
            Create <ArrowRight />
          </Link>
        </section>
      )}
    </div>
  );
}
