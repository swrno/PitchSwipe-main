import type * as React from "react";
import type { DemandCurveData } from "@/features/demand-curve";
import { cn } from "@/shared/lib/utils";

import { JoinRateChart } from "./join-rate-chart";
import { PriceTable } from "./price-table";
import { RevenueChart } from "./revenue-chart";

export interface DemandCurveProps {
  /** From shapeDemandCurve(). Every number shown comes from here. */
  data: DemandCurveData;
  /** Price unit shown in "How to read this", e.g. "per month". */
  unitText?: string;
  className?: string;
}

/** A headline count as a colour tile; `dark` marks the best-price tile (lime). */
function Stat({ value, label, dark, tone = "bg-card border border-border neutral-ink" }: { value: string | number; label: string; dark?: boolean; tone?: string }) {
  return (
    <div className={cn("rounded-xl px-4 py-3 md:px-6 md:py-5", dark ? "bg-card border border-border neutral-ink" : tone)}>
      <div className="tnum text-2xl font-semibold">{value}</div>
      <div className="text-sm font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

/** Headline, chance badge, mobile lead note and sample-ratio warning: the fixed part above the cards. */
export function DemandCurveHeader({ data }: { data: DemandCurveData }) {
  const isLead = data.verdict === "lead";
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex flex-col items-start gap-3">
        <h1
          id="demand-curve-headline"
          className="max-w-[10ch] border-b-4 border-accent pb-1 text-4xl font-extrabold leading-[1.05] tracking-tight md:max-w-none md:border-b-0 md:text-5xl"
        >
          {data.headline}
        </h1>
        <span
          className={cn(
            "rounded-lg border px-3 py-1 text-sm font-semibold md:hidden",
            isLead ? "border-warning bg-background text-warning" : "border-transparent bg-accent-soft text-accent",
          )}
        >
          {data.chanceBadge}
        </span>
      </header>
      {isLead && data.leadText && (
        <aside className="rounded-2xl bg-muted p-4 md:hidden">
          <span className="inline-block rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-warning">
            Lead · not decided
          </span>
          <p className="mt-2 text-lg font-bold leading-snug">{data.leadText.split(". ")[0].replace(/\.?$/, ".")}</p>
          <p className="mt-1 text-base leading-snug text-muted-foreground">
            {data.leadText.split(". ").slice(1).join(". ")}
          </p>
        </aside>
      )}
      {data.srmWarning && (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          Swipers were not split evenly across prices (sample ratio mismatch), so this stays a Lead.
        </p>
      )}
    </div>
  );
}

/** The four KPI tiles as separate nodes (the best-price tile is hidden on phones). */
export function demandStatTiles(data: DemandCurveData): { id: string; label: string; node: React.ReactNode; className?: string }[] {
  const { totals } = data;
  return [
    { id: "dc-swipers", label: "Swipers", node: <Stat value={totals.swipers} label={totals.perPriceSwipers ? `Swipers, ${totals.perPriceSwipers} per price` : "Swipers"} /> },
    { id: "dc-yes", label: "Said yes", node: <Stat value={totals.saidYes} label={`Said yes (${totals.saidYesPct}%)`} /> },
    { id: "dc-joined", label: "Joined waitlist", node: <Stat value={totals.joined} label={`Joined waitlist (${totals.joinedPct}%)`} /> },
    { id: "dc-best", label: "Best price", node: <Stat dark value={data.bestTileValue} label={data.bestTileLabel} />, className: "hidden md:block" },
  ];
}

export function JoinRateCard({ data }: { data: DemandCurveData }) {
  return (
    <figure className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 md:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 pr-8">
        <h2 className="text-lg font-semibold tracking-tight">Who joined at each price</h2>
        <span className="text-sm text-muted-foreground">
          <span className="hidden md:inline">dot = joined %, </span>bar = likely range
        </span>
      </figcaption>
      <JoinRateChart chart={data.lineChart} />
      <p className="hidden text-sm text-muted-foreground md:block">
        Dots show the share who joined at each price; bars show the 90% likely range.
      </p>
    </figure>
  );
}

export function RevenueCard({ data }: { data: DemandCurveData }) {
  return (
    <figure className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 md:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 pr-8">
        <h2 className="text-lg font-semibold tracking-tight">Revenue per 100 swipers</h2>
        <span className="text-sm text-muted-foreground">per month, if every sign-up pays</span>
      </figcaption>
      <RevenueChart chart={data.barChart} />
      <p className="hidden text-sm text-muted-foreground md:block">Revenue = price × share who joined × 100.</p>
    </figure>
  );
}

export function PriceNumbersCard({ data }: { data: DemandCurveData }) {
  return (
    <div className="hidden rounded-xl border border-border bg-card p-5 md:block">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 pr-8">
        <h2 className="text-lg font-semibold tracking-tight">Every price, in numbers</h2>
        <span className="text-sm text-muted-foreground">Swipers → Said yes → Joined · ranges are 90% likely</span>
      </div>
      <PriceTable data={data} />
    </div>
  );
}

export function HowToReadCard({ data, unitText = "per month" }: { data: DemandCurveData; unitText?: string }) {
  return (
    <div className="hidden gap-6 rounded-xl border border-border bg-card p-5 text-sm md:grid md:grid-cols-3">
      <h2 className="col-span-3 -mb-3 text-lg font-semibold tracking-tight">How to read this</h2>
      <p>
        <strong>Flagsmith picks the most sign-ups.</strong> Its chance to win is on join rate, not revenue, so
        it can differ from the chance here.
      </p>
      <p>
        <strong>PitchSwipe adds revenue.</strong> From the same counts, {data.bestTileValue} has a{" "}
        {data.rows.find((r) => r.isBest)?.chancePct ?? 0}% chance of earning the most. It becomes a Result at 95%
        {data.moreSwipersPerPrice ? `, about ${data.moreSwipersPerPrice} more swipers per price` : ""}.
      </p>
      <p>
        <strong>One price unit only.</strong> All prices are {unitText}, so they form a curve. A framing test
        such as &quot;Rs 10 a day&quot; vs &quot;Rs 299 a month&quot; is set up separately.
      </p>
    </div>
  );
}

/** The whole price view stacked (header plus every card), for pages that do not need movable cards. */
export function DemandCurve({ data, unitText = "per month", className }: DemandCurveProps) {
  return (
    <section className={cn("flex flex-col gap-5 md:gap-6", className)} aria-labelledby="demand-curve-headline">
      <DemandCurveHeader data={data} />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
        {demandStatTiles(data).map((t) => (
          <div key={t.id} className={t.className}>{t.node}</div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 md:gap-4">
        <JoinRateCard data={data} />
        <RevenueCard data={data} />
      </div>
      <PriceNumbersCard data={data} />
      <HowToReadCard data={data} unitText={unitText} />
    </section>
  );
}
