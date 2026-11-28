import { Sparkles, User } from "lucide-react";

import { Card } from "@/shared/ui/card";
import { LIMITS } from "@/shared/lib/limits";
import { pct } from "@/features/results/insights";
import { STATE_TILES, rateBucket } from "@/features/results/state-tiles";
import type {
  InsightView,
  LocationTab,
  SegmentRowView,
  SegmentView,
} from "@/features/results/types";
import { cn } from "@/shared/lib/utils";

/** Card shell used by every Who swiped panel. */
export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "@container border-0 bg-transparent p-0 md:border md:bg-card md:p-5",
        className,
      )}
    >
      <div className="hidden flex-wrap items-baseline justify-between gap-x-4 gap-y-1 md:flex">
        <h2 className="text-lg font-semibold tracking-tight text-xl md:text-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="space-y-4 md:mt-3">{children}</div>
    </Card>
  );
}

/** One row per group: label, counts, join rate, and a bar against the dashed overall rate. */
export function SegmentBars({
  view,
  unit,
}: {
  view: SegmentView;
  unit?: string;
}) {
  const overallLeft = Math.min(100, (view.overall.rate / view.axisMax) * 100);
  const sorted = [...view.rows].sort((a, b) => b.joinRate - a.joinRate);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const other =
    view.otherVisible && view.other
      ? {
          swipers: view.other.swipers + rest.reduce((n, r) => n + r.swipers, 0),
          saidYes: view.other.saidYes + rest.reduce((n, r) => n + r.saidYes, 0),
          joined: view.other.joined + rest.reduce((n, r) => n + r.joined, 0),
        }
      : rest.length
        ? {
            swipers: rest.reduce((n, r) => n + r.swipers, 0),
            saidYes: rest.reduce((n, r) => n + r.saidYes, 0),
            joined: rest.reduce((n, r) => n + r.joined, 0),
          }
        : null;
  const otherRow: SegmentRowView | null =
    other && other.swipers >= LIMITS.groupMinSize
      ? { key: "__other", label: "Other", ...other, joinRate: other.joined / other.swipers, best: false }
      : null;
  const shownRows = otherRow ? [...top, otherRow] : top;
  return (
    <div>
      <ul className="space-y-3">
        {shownRows.map((r) => (
          <li key={r.key}>
            <div className="flex flex-col gap-x-3 @lg:flex-row @lg:items-baseline @lg:justify-between">
              <span className="text-lg font-extrabold tracking-tight">
                {r.label}
              </span>
              <span className="tnum text-sm text-muted-foreground">
                <strong className="text-lg text-foreground">{pct(r.joinRate)}%</strong> · {r.joined} of {r.swipers} joined · {r.saidYes} said yes
              </span>
            </div>
            <div
              className="relative mt-1 h-3 rounded-full bg-muted"
              role="img"
              aria-label={`${r.label}: ${pct(r.joinRate)}% joined`}
            >
              <div
                className={cn(
                  "grow-x h-full rounded-full",
                  r.best ? "bg-accent" : "bg-muted-foreground/45",
                )}
                style={{
                  width: `${Math.min(100, (r.joinRate / view.axisMax) * 100)}%`,
                }}
              />
              <div
                aria-hidden
                className="absolute -top-1 bottom-[-4px] border-l-2 border-dashed border-foreground/70"
                style={{ left: `${overallLeft}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {view.rows.length === 0 && (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          No group has {LIMITS.groupMinSize} swipers yet{unit ? ` ${unit}` : ""}
          , so nothing is shown.
        </p>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 border-l-2 border-dashed border-foreground/70"
          />
          Overall: {view.overall.swipers} swipers · {view.overall.saidYes} said
          yes · {view.overall.joined} joined ({pct(view.overall.rate)}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-accent" /> Best
        </span>
      </p>
    </div>
  );
}

export function TotalBox({
  view,
  line,
  hint,
}: {
  view: SegmentView;
  line?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-muted px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-extrabold">Total</span>
        <span className="text-base">
          <strong>{view.overall.swipers}</strong> swipers ·{" "}
          <strong>{view.overall.saidYes}</strong> said yes ·{" "}
          <strong>{view.overall.joined}</strong> joined (
          {pct(view.overall.rate)}%)
        </span>
      </div>
      {line && (
        <p className="mt-0.5 text-right text-sm text-muted-foreground">
          {line}
        </p>
      )}
      {hint && (
        <p className="mt-0.5 text-right text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Insight card. Always carries the Lead line: segment views are leads, never results. */
export function InsightCard({ insight }: { insight: InsightView }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="flex items-center gap-2 text-base font-extrabold">
        <Sparkles aria-hidden className="size-4 text-accent" /> {insight.title}
      </p>
      <p className="mt-1 leading-snug">{insight.body}</p>
      <p
        className={cn(
          "mt-2 text-sm font-bold",
          insight.warning ? "text-destructive" : "text-warning",
        )}
      >
        {insight.lead}
      </p>
    </div>
  );
}

const BUCKET_STYLE = [
  "bg-[#8ee8a8] text-[#14532d]",
  "bg-[#2fcf6b] text-[#0b3d1f]",
  "bg-[#168a3d] text-white",
  "bg-[#14532d] text-white",
] as const;
const LEGEND = ["under 10%", "10 to 14%", "15 to 19%", "20% or more"] as const;

/** Tile map of states coloured by share who joined. Groups under 10 swipers stay grey. */
export function StateMap({ tab }: { tab: LocationTab }) {
  const byState = new Map(tab.tiles.map((t) => [t.state, t]));
  const cols = Math.max(...STATE_TILES.map((t) => t.col)) + 1;
  const rows = Math.max(...STATE_TILES.map((t) => t.row)) + 1;
  return (
    <div className="flex items-start gap-4">
      <div
        role="img"
        aria-label={`Tile map of states by share who joined. ${tab.tiles.length} states have ${LIMITS.groupMinSize} or more swipers.`}
        className="grid w-[15.5rem] shrink-0 gap-1 md:w-[17rem]"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        {STATE_TILES.map((t) => {
          const data = byState.get(t.state);
          return (
            <div
              key={t.abbr}
              aria-hidden
              style={{ gridColumn: t.col + 1, gridRow: t.row + 1 }}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-md text-[10px] font-bold leading-none",
                data
                  ? BUCKET_STYLE[rateBucket(data.joinRate)]
                  : "bg-muted text-muted-foreground/70",
                data?.best && "ring-2 ring-foreground",
              )}
            >
              <span>{t.abbr}</span>
              {data && (
                <span className="mt-0.5 text-[9px]">{pct(data.joinRate)}%</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs md:text-sm">
        <p className="mb-1.5 font-bold text-muted-foreground">
          Share who joined
        </p>
        <ul className="space-y-1">
          {LEGEND.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-3.5 rounded-sm",
                  BUCKET_STYLE[i].split(" ")[0],
                )}
              />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="size-3.5 rounded-sm bg-muted" />
            under {LIMITS.groupMinSize} swipers
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Ten person icons, `filled` of them highlighted ("out of every 10 people"). */
export function PeopleRow({ rate }: { rate: number }) {
  const filled = Math.round(rate * 10);
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <User
          key={i}
          className={cn(
            "size-5",
            i < filled ? "fill-accent text-accent" : "fill-muted text-muted",
          )}
        />
      ))}
    </div>
  );
}
