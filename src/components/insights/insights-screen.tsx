"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";

import { ProductTile } from "@/components/decks/ui";
import { DownloadResultsButton } from "@/components/export";
import { buttonVariants } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { LIMITS } from "@/fixtures";
import type { InsightsPayload } from "@/lib/insights/types";
import { cn } from "@/lib/utils";

import { loadInsightsPayload } from "./api";
import { EmptyInsights, InsightCard, PersonaCard, SaidYesCard, SuggestionCard, ThemesCard, WinnersList } from "./insight-parts";

function Pill({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-extrabold text-accent", className)}>
      <Sparkles className="size-4" aria-hidden /> AI insights from real swipes
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <p className="text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

const n = (x: number) => x.toLocaleString("en-US");
const decksText = (count: number) => `${count} ${count === 1 ? "deck" : "decks"}`;

/**
 * F11 Product insights (phone 25, web 25). Demo mode gets `initial` rendered on the server; otherwise the page
 * loads GET /api/insights/[productId] with the founder's sign-in token. Everything here is read only.
 */
export function InsightsScreen({ productId, initial }: { productId: string; initial?: InsightsPayload }) {
  const [data, setData] = React.useState<InsightsPayload | undefined>(initial);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (initial) return;
    let cancelled = false;
    loadInsightsPayload(productId)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [productId, initial]);

  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-muted p-4 text-sm">
        {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p className="p-4 text-muted-foreground" aria-busy="true">
        Loading insights...
      </p>
    );
  }

  const { anchorDeckId } = data;
  const ordered = [...data.insights.filter((i) => i.tag === "Result"), ...data.insights.filter((i) => i.tag === "Lead")];
  const pct = Math.round(LIMITS.winnerConfidence * 100);
  const swipersWord = data.swipersAreDistinct ? "real swipers" : "swipes counted";

  return (
    <div className="space-y-5">
      {/* Phone header (design phone 25) */}
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href={`/products/${productId}`}
          aria-label="Back"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <ProductTile icon={data.productIcon} accent={data.accent} className="size-9 text-base" />
        <p className="min-w-0 flex-1 truncate text-right text-sm text-muted-foreground">
          {data.productName} · {decksText(data.deckCount)} tested
        </p>
        {anchorDeckId && <DownloadResultsButton deckId={anchorDeckId} productId={productId} variant="icon" />}
      </div>

      {/* Web header (design web 25) */}
      <div className="hidden md:block">
        <p className="text-sm text-muted-foreground">
          <Link href="/decks" className="hover:underline">
            Products
          </Link>{" "}
          / {data.productName}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight">
            What {data.productName} has learned {data.demo && <DemoBadge className="align-middle" />}
          </h1>
          {anchorDeckId && (
            <div className="flex items-center gap-3">
              <DownloadResultsButton deckId={anchorDeckId} productId={productId} variant="labelled" />
              <Link href={`/decks/${anchorDeckId}/ask`} className={cn(buttonVariants(), "h-11 gap-2")}>
                <Sparkles className="size-4" aria-hidden /> Ask about results
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        <Pill />
        <h1 className="text-[2.2rem] font-extrabold leading-[1.05] tracking-tight">
          What {data.productName} <span className="inline-block border-b-[6px] border-accent pb-0.5">has learned.</span>
        </h1>
        {data.demo && <DemoBadge />}
        <p className="text-muted-foreground">
          {n(data.swipers)} {swipersWord} · {n(data.waitlist)} pilot customers on the waitlist
        </p>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-3">
        <Stat value={n(data.swipers)} label={`${data.swipersAreDistinct ? "real swipers" : "swipes counted"} across ${decksText(data.deckCount)}`} />
        <Stat value={n(data.waitlist)} label="pilot customers on the waitlist" />
        <Stat value={`${data.winnerCount} of ${data.deckCount}`} label="decks with a clear winner" />
      </div>

      {data.deckCount === 0 ? (
        <EmptyInsights payload={data} />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <section className="md:rounded-2xl md:border md:border-border md:bg-card md:p-5" aria-labelledby="winners-h">
              <div className="flex items-baseline justify-between">
                <h2 id="winners-h" className="text-lg font-extrabold tracking-tight md:text-xl">
                  Winners so far
                </h2>
                <span className="hidden text-sm text-muted-foreground md:inline">{decksText(data.deckCount)}</span>
              </div>
              <WinnersList winners={data.winners} />
            </section>

            <section className="space-y-4 md:rounded-2xl md:border md:border-border md:bg-card md:p-5" aria-label="Insights">
              <Pill className="hidden md:inline-flex" />
              {ordered.length === 0 ? (
                <p className="rounded-2xl bg-muted p-4 text-muted-foreground">
                  No insight yet. A Result needs two finished decks at {pct}% or more; a Lead needs a group of {LIMITS.groupMinSize}+ swipers.
                </p>
              ) : (
                ordered.map((i) => <InsightCard key={i.id} insight={i} />)
              )}
              {data.suggestion && <SuggestionCard suggestion={data.suggestion} />}
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            {data.saidYesVsActed && <SaidYesCard data={data.saidYesVsActed} />}
            {data.themes.map((g) => (
              <ThemesCard key={g.deckId} group={g} />
            ))}
            {data.persona && <PersonaCard persona={data.persona} />}
          </div>
        </>
      )}

      {data.notes.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {data.notes.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}

      {data.demo && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <DemoBadge className="mr-2" />
          Every number on this screen is made up for the mockup. The swiper total counts people, so it is lower than the deck counts added up: one swiper
          can answer several decks.
        </p>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        AI summary of finished results and comments. Each insight names the decks it comes from. Every number is filled in from Flagsmith results by
        code; the AI writes only the words, and a claim whose numbers do not match the results is not shown. A Result needs a {pct}% chance to be best; a
        Lead comes from a group of {LIMITS.groupMinSize}+ swipers and needs its own test to confirm. AI persona tests are never used here, and winners
        from separate decks were not tested together.
      </p>
    </div>
  );
}
