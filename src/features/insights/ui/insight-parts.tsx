import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/shared/ui/button";
import type { InsightCardView, InsightsPayload, PersonaCardView, SuggestionView, ThemeGroup, WinnerRow } from "@/features/insights/types";
import type { SaidYesVsActed } from "@/features/results/types";
import { cn } from "@/shared/lib/utils";

const STATUS_TONE: Record<WinnerRow["tone"], string> = {
  won: "text-accent",
  leading: "text-muted-foreground",
  muted: "text-muted-foreground",
};

/** Three blue screen tiles, as in the design for the Product UI deck. */
function ScreenTiles() {
  return (
    <span aria-hidden className="mt-2 flex gap-2">
      {["bg-muted", "bg-muted", "bg-muted"].map((c) => (
        <span key={c} className={cn("flex h-[5.5rem] w-[3.75rem] flex-col justify-end gap-1 rounded-lg p-2", c)}>
          <span className="h-1 w-8 rounded-full bg-foreground/50" />
          <span className="h-1 w-5 rounded-full bg-foreground/30" />
        </span>
      ))}
    </span>
  );
}

/** "Winners so far": one line per deck, Won or Leading with Flagsmith's chance. */
export function WinnersList({ winners }: { winners: WinnerRow[] }) {
  return (
    <ol className="divide-y divide-border" aria-label="Winners so far">
      {winners.map((w) => (
        <li key={w.deckId} className="flex items-start gap-3 py-3.5 md:py-4">
          <span aria-hidden className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-extrabold">
            {w.index}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{w.label}</p>
            <p className="text-base font-extrabold leading-snug tracking-tight">{w.text}</p>
            {w.screens && <ScreenTiles />}
          </div>
          <span className={cn("mt-1 shrink-0 text-right text-sm font-bold", STATUS_TONE[w.tone])}>{w.statusText}</span>
        </li>
      ))}
    </ol>
  );
}

/** Result or Lead card with its source line. Leads are always tagged "confirm with a test". */
export function InsightCard({ insight }: { insight: InsightCardView }) {
  const lead = insight.tag === "Lead";
  return (
    <article className="rounded-2xl bg-muted p-4 md:p-5">
      <span
        className={cn(
          "inline-block rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide",
          lead ? "border border-border bg-muted text-foreground" : "bg-accent-soft text-accent",
        )}
      >
        {insight.tagLabel}
      </span>
      <h3 className="mt-2 text-lg font-extrabold leading-snug tracking-tight">{insight.title}</h3>
      <p className="mt-1 leading-snug text-muted-foreground">{insight.body}</p>
      <p className="mt-2 text-sm font-bold text-muted-foreground">{insight.sourceLine}</p>
    </article>
  );
}

/** Suggested next test. Create opens the New deck screen; nothing is created or published here. */
export function SuggestionCard({ suggestion }: { suggestion: SuggestionView }) {
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-border p-4 md:p-5" aria-label="Suggested next test">
      <div className="min-w-0">
        <p className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Suggested next test</p>
        <p className="mt-1 font-extrabold leading-snug">{suggestion.text}</p>
      </div>
      <Link href={suggestion.href} className={cn(buttonVariants(), "shrink-0")}>
        <Plus className="hidden md:block" aria-hidden />
        <span className="md:hidden">Create</span>
        <span className="hidden md:inline">Create this test</span>
      </Link>
    </section>
  );
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-extrabold tabular-nums">{text}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${text}`}>
        <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

const n = (x: number) => x.toLocaleString("en-US");

/** Said yes vs acted: the email is the real signal. */
export function SaidYesCard({ data }: { data: SaidYesVsActed }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-label="Said yes versus acted">
      <h2 className="text-lg font-semibold tracking-tight text-lg tracking-tight">{data.headline}</h2>
      <div className="mt-3 space-y-3">
        <Meter label="Said yes" value={data.saidYesPct} text={`${data.saidYesPct}% · ${n(data.saidYes)} of ${n(data.swipers)} swipes`} />
        <Meter label="Joined the waitlist" value={data.joinedPct} text={`${data.joinedPct}% · ${n(data.joined)} of ${n(data.swipers)} swipes`} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{data.note}</p>
    </section>
  );
}

/** Comment themes: the model groups comments, code counts them. */
export function ThemesCard({ group }: { group: ThemeGroup }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5" aria-label={`Comment themes, ${group.deckLabel}`}>
      <h2 className="text-lg font-semibold tracking-tight text-lg tracking-tight">What people said</h2>
      <p className="text-sm text-muted-foreground">{group.deckLabel} · themes grouped by AI, counted by code</p>
      <ul className="mt-3 divide-y divide-border">
        {group.themes.map((t) => (
          <li key={t.label} className="flex items-baseline justify-between gap-3 py-2">
            <span className="font-semibold">{t.label}</span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{t.countText}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Persona pre-test: Simulated and Unproven. Kept apart from every real count. */
export function PersonaCard({ persona }: { persona: PersonaCardView }) {
  return (
    <section className="rounded-2xl border-2 border-dashed border-border p-4 md:p-5" aria-label="AI persona pre-test, simulated and unproven">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight mr-1 text-lg tracking-tight">{persona.title}</h2>
        {persona.tags.map((t) => (
          <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
            {t}
          </span>
        ))}
      </div>
      <p className="mt-2 leading-snug">{persona.text}</p>
      <p className="mt-1 text-sm font-bold text-muted-foreground">{persona.trackRecord}</p>
      <p className="mt-1 text-xs text-muted-foreground">{persona.footnote}</p>
    </section>
  );
}

export function EmptyInsights({ payload }: { payload: InsightsPayload }) {
  return (
    <section className="rounded-2xl border border-dashed border-border p-5 text-center">
      <p className="text-lg font-extrabold tracking-tight">No tests have run for {payload.productName} yet.</p>
      <p className="mt-1 text-muted-foreground">Insights appear once a test has real swipers.</p>
      <Link href={`/decks/new?product=${encodeURIComponent(payload.productId)}`} className={cn(buttonVariants(), "mt-4")}>
        New test
      </Link>
    </section>
  );
}
