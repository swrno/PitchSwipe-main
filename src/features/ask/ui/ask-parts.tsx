import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";
import { NEW_DECK_HREF } from "@/shared/lib/nav";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { StatusText } from "@/features/decks/ui/primitives";
import type { StatusTone } from "@/features/decks/status";
import type { RenderedComponent } from "@/features/ask/types";
import { cn } from "@/shared/lib/utils";

type Bar = Extract<RenderedComponent, { kind: "barList" }>;

function BarList({ c }: { c: Bar }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={c.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-extrabold tracking-tight">{c.title}</h3>
        <span className="text-sm text-muted-foreground">{c.subtitle}</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {c.rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(3.5rem,6rem)_1fr_auto] items-center gap-x-3 gap-y-0.5 text-sm">
            <span className={cn("leading-tight", r.highlight && "font-extrabold")}>{r.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.label}: ${r.valueText}, ${r.countText}`}>
              <span
                className={cn("grow-x block h-full rounded-full", r.highlight ? "bg-accent" : "bg-muted-foreground/45")}
                style={{ width: `${Math.round(r.fraction * 100)}%` }}
              />
            </span>
            <span className="min-w-10 text-right font-extrabold tabular-nums">{r.valueText}</span>
            <span className="col-start-2 col-end-4 text-xs text-muted-foreground tabular-nums">{r.countText}</span>
          </li>
        ))}
      </ul>
      {c.footnote && <p className="mt-3 text-xs text-muted-foreground">{c.footnote}</p>}
    </section>
  );
}

function StatRow({ c }: { c: Extract<RenderedComponent, { kind: "statRow" }> }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {c.items.map((i) => (
        <div key={i.label} className="rounded-xl border border-border bg-card px-3 py-2.5">
          <dd className="text-xl font-extrabold tracking-tight">{i.value}</dd>
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function CommentQuotes({ c }: { c: Extract<RenderedComponent, { kind: "commentQuotes" }> }) {
  return (
    <ul className="grid gap-2" aria-label="Comments">
      {c.quotes.map((q) => (
        <li key={q.id} className="rounded-2xl bg-muted p-3.5">
          <blockquote className="text-sm leading-snug">&ldquo;{q.text}&rdquo;</blockquote>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">{q.meta}</p>
        </li>
      ))}
    </ul>
  );
}

/** Result or Lead card: the answer itself, with its tag and source line. Bold first sentence as in the design. */
function InsightCard({ c }: { c: Extract<RenderedComponent, { kind: "insightCard" }> }) {
  const isLead = c.tag === "Lead";
  const cut = c.text.search(/[.!?](\s|$)/);
  const first = cut >= 0 ? c.text.slice(0, cut + 1) : c.text;
  const rest = cut >= 0 ? c.text.slice(cut + 1) : "";
  return (
    <section className="rounded-2xl bg-muted p-4">
      <span
        className={cn(
          "inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide",
          isLead ? "border border-border bg-background text-foreground" : c.tag === "Result" ? "bg-accent-soft text-accent" : "bg-background text-muted-foreground",
        )}
      >
        {c.tagLabel}
      </span>
      <p className="mt-2 leading-snug">
        <strong>{first}</strong>
        {rest}
      </p>
      <p className="mt-2 text-xs font-bold text-muted-foreground">{c.sourceLine}</p>
    </section>
  );
}

/** Deck draft: never published from here. Both buttons open the New deck screen. */
function DeckDraft({ c }: { c: Extract<RenderedComponent, { kind: "deckDraft" }> }) {
  return (
    <section className="rounded-2xl border-2 border-foreground bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        <span>Test draft · not published</span>
        <span className="font-semibold normal-case tracking-normal">Uses 1 test</span>
      </div>
      <h3 className="mt-2 text-lg font-extrabold tracking-tight">{c.title}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {c.chips.map((chip) => (
          <li key={chip} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
            {chip}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href={NEW_DECK_HREF} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Edit
        </Link>
        <Link href={NEW_DECK_HREF} className={cn(buttonVariants(), "w-full")}>
          Review and publish
        </Link>
      </div>
    </section>
  );
}

/** Only opens the approval screen. The chat never ships. */
function ReviewAndShip({ c }: { c: Extract<RenderedComponent, { kind: "reviewAndShip" }> }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-foreground p-4 text-background">
      <div className="min-w-0">
        <p className="font-extrabold">Test decided</p>
        <p className="text-sm opacity-80">{c.text}</p>
      </div>
      <Link href={`/decks/${c.deckId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-foreground")}>
        {c.label}
      </Link>
    </section>
  );
}


/* Account cards: every value is display text made by code from tool data. */

function KpiRow({ c }: { c: Extract<RenderedComponent, { kind: "kpiRow" }> }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {c.items.map((i) => (
        <div key={i.label} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
          <dd className="truncate text-xl font-extrabold tracking-tight">{i.value}</dd>
          <dt className="truncate text-xs text-muted-foreground">{i.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function ProductList({ c }: { c: Extract<RenderedComponent, { kind: "productList" }> }) {
  if (c.items.length === 0) return <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">No products yet.</p>;
  return (
    <ul className="grid gap-2" aria-label="Your products">
      {c.items.map((p) => (
        <li key={p.id}>
          <Link href={p.href} className="block rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-extrabold tracking-tight">{p.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                {p.role === "cofounder" ? "Co-founder" : "Open"}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
              {[["Tests", p.tests], ["Live", p.live], ["Swipes", p.swipers], ["Waitlist", p.waitlist]].map(([k, v]) => (
                <div key={k}>
                  <dd className="text-base font-extrabold tabular-nums text-foreground">{v}</dd>
                  <dt>{k}</dt>
                </div>
              ))}
            </dl>
          </Link>
        </li>
      ))}
      {c.more && <li className="text-xs text-muted-foreground">{c.more}</li>}
    </ul>
  );
}

function TestTable({ c }: { c: Extract<RenderedComponent, { kind: "testTable" }> }) {
  if (c.rows.length === 0) return <p className="rounded-2xl bg-muted p-3.5 text-sm text-muted-foreground">No tests match.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul aria-label="Tests" className="divide-y divide-border">
        {c.rows.map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-3.5 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="min-w-0 truncate text-sm font-extrabold">
                {r.product} <span className="font-semibold text-muted-foreground">{r.variable}</span>
              </span>
              <StatusText tone={r.tone as StatusTone} className="text-xs">
                {r.status}
              </StatusText>
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.swipers} swipes · {r.waitlist} waitlist
              </span>
              <ArrowUpRight aria-hidden className="size-3.5 justify-self-end text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {c.more && <p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">{c.more}</p>}
    </div>
  );
}

function Comparison({ c }: { c: Extract<RenderedComponent, { kind: "comparison" }> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-label={c.title}>
      <h3 className="text-base font-extrabold tracking-tight">{c.title}</h3>
      <ul className="mt-3 space-y-3">
        {c.rows.map((r) => (
          <li key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className={cn(r.winner && "font-extrabold")}>{r.label}</span>
              <span className="font-extrabold tabular-nums">{r.valueText}</span>
            </div>
            <span className="block h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.label}: ${r.valueText}, ${r.countText}`}>
              <span className={cn("block h-full rounded-full", r.winner ? "bg-accent" : "bg-muted-foreground/45")} style={{ width: `${Math.round(r.fraction * 100)}%` }} />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{r.countText}</span>
          </li>
        ))}
      </ul>
      {c.footnote && <p className="mt-3 text-xs text-muted-foreground">{c.footnote}</p>}
    </section>
  );
}

function PageLink({ c }: { c: Extract<RenderedComponent, { kind: "pageLink" }> }) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="min-w-0">
        <p className="truncate font-extrabold tracking-tight">{c.title}</p>
        <p className="truncate text-sm text-muted-foreground">{c.description}</p>
      </div>
      <Link href={c.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
        Open
      </Link>
    </section>
  );
}

export function DoneCard({ c }: { c: Extract<RenderedComponent, { kind: "done" }> }) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft p-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-extrabold tracking-tight">Done: {c.title}</p>
          <p className="text-sm text-muted-foreground">{c.text}</p>
        </div>
      </div>
      <Link href={c.href} className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
        {c.linkLabel}
      </Link>
    </section>
  );
}

export function RenderComponent({ c }: { c: RenderedComponent }) {
  switch (c.kind) {
    case "barList":
      return <BarList c={c} />;
    case "statRow":
      return <StatRow c={c} />;
    case "commentQuotes":
      return <CommentQuotes c={c} />;
    case "insightCard":
      return <InsightCard c={c} />;
    case "deckDraft":
      return <DeckDraft c={c} />;
    case "reviewAndShip":
      return <ReviewAndShip c={c} />;
    case "kpiRow":
      return <KpiRow c={c} />;
    case "productList":
      return <ProductList c={c} />;
    case "testTable":
      return <TestTable c={c} />;
    case "comparison":
      return <Comparison c={c} />;
    case "pageLink":
      return <PageLink c={c} />;
    case "done":
      return <DoneCard c={c} />;
  }
}
