import Link from "next/link";
import { Sparkles, Wrench } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { NEW_DECK_HREF } from "@/lib/nav";
import type { ChatStep, RenderedComponent } from "@/lib/ask/types";
import { cn } from "@/lib/utils";

/** Round green sparkle that marks the assistant's turn. */
export function AssistantMark() {
  return (
    <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
      <Sparkles className="size-4" />
    </span>
  );
}

/** "Looked up results by state" with the tool call in code text on the right. */
export function ToolLines({ steps }: { steps: ChatStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Tools used">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-3">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80">
            <Wrench className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground md:text-[0.8rem]">{s.summary}</span>
          <code className="hidden max-w-[45%] truncate font-mono text-xs text-muted-foreground/80 sm:block" title={s.call}>
            {s.call}
          </code>
        </li>
      ))}
    </ul>
  );
}

type Bar = Extract<RenderedComponent, { kind: "barList" }>;

function BarList({ c }: { c: Bar }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-label={c.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-base font-extrabold tracking-tight">{c.title}</h3>
        <span className="text-sm text-muted-foreground">{c.subtitle}</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {c.rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(4.5rem,7rem)_1fr_auto_auto] items-center gap-x-3 text-sm">
            <span className={cn("leading-tight", r.highlight && "font-extrabold")}>{r.label}</span>
            <span className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.label}: ${r.valueText}, ${r.countText}`}>
              <span
                className={cn("grow-x block h-full rounded-full", r.highlight ? "bg-accent" : "bg-muted-foreground/45")}
                style={{ width: `${Math.round(r.fraction * 100)}%` }}
              />
            </span>
            <span className="w-12 text-right font-extrabold tabular-nums">{r.valueText}</span>
            <span className="w-24 text-right text-muted-foreground tabular-nums">{r.countText}</span>
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
    <ul className="grid gap-2 md:grid-cols-3" aria-label="Comments">
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
    <section className="rounded-2xl bg-muted p-4 md:p-5">
      <span
        className={cn(
          "inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide",
          isLead ? "bg-[#fdebb8] text-[#8a3b05]" : c.tag === "Result" ? "bg-accent-soft text-accent" : "bg-background text-muted-foreground",
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
    <section className="rounded-2xl border-2 border-foreground bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        <span>Deck draft · not published</span>
        <span className="font-semibold normal-case tracking-normal">Uses 1 deck</span>
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
  }
}

/** Side panel on web: the tools and components, as in the design. Static copy of the spec table. */
const TOOL_ROWS = [
  ["get_results", "Swipers, said yes, joined per card, with totals"],
  ["get_segments", "Same, split by state, source, interest or target users (groups of 10+ only)"],
  ["get_experiment", "Flagsmith chance to be best, exposures, sample-ratio warning, last refresh"],
  ["get_price_curve", "Join rate and revenue per price, chance it earns most"],
  ["get_comments", "Typed and voice comments, translated, with state and role"],
  ["draft_deck", "Creates a draft deck for the founder to review; never publishes"],
] as const;

const COMPONENT_CHIPS = ["Stat row", "Bar list with counts", "Demand curve", "Comment quotes", "Result or Lead card", "Deck draft card", "Review-and-ship card (opens the approval sheet)"];

export function ToolsPanel() {
  return (
    <aside className="hidden space-y-5 md:block" aria-label="What the assistant can do">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-extrabold tracking-tight">Tools the assistant can use</h2>
        <ul className="mt-3 divide-y divide-border">
          {TOOL_ROWS.map(([name, text]) => (
            <li key={name} className="py-2.5">
              <code className="font-mono text-sm font-bold">{name}</code>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          It can read and draft. It cannot publish, ship, stop a test or change a flag: those need your tap on the approval screen.
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-extrabold tracking-tight">What it can draw in the chat</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {COMPONENT_CHIPS.map((chip) => (
            <li key={chip} className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
              {chip}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          The AI picks a component and points at tool results; code fills every number, so a chart can never show a number the data does not have.
        </p>
      </section>
    </aside>
  );
}
