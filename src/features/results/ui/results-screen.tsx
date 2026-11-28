"use client";

import { Icon, IconLabel, type IconName } from "@/shared/ui/icon";
import * as React from "react";
import { Sparkles } from "lucide-react";

import { assistantJson } from "@/features/assistant/ui/api";
import { ShipWinnerButton } from "@/features/assistant/ui";
import {
  DemandCurveHeader,
  demandStatTiles,
  HowToReadCard,
  JoinRateCard,
  PriceNumbersCard,
  RevenueCard,
} from "@/features/demand-curve/ui";
import { WebsiteShippedView } from "@/features/sites/ui";
import { Card } from "@/shared/ui/card";
import { LIMITS } from "@/shared/lib/limits";
import type { WebsiteShippedData } from "@/features/sites/types";
import {
  LEADER_FILTERS,
  LEADER_FILTER_LABELS,
  type LeaderFilter,
  type LeaderRow,
  type ResultsPayload,
} from "@/features/results/types";
import { cn } from "@/shared/lib/utils";

import { MovableBlocks, type MovableBlock } from "@/shared/ui/movable-blocks";
import { useDeckResults } from "./use-results";

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const share = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** One-line takeaway built only from the payload numbers. */
function takeaway(data: ResultsPayload): string | null {
  const rows = data.leaderboard.everyone.filter((r) => !r.suppressed && r.claimRate !== null);
  const top = rows[0];
  if (!top || data.totals.swipers === 0) return null;
  const next = rows[1];
  const ratio =
    next && next.claimRate && top.claimRate !== null && top.claimRate > 0
      ? ` (${(top.claimRate / next.claimRate).toFixed(1)}x ${next.label})`
      : "";
  const verb = data.verdict.kind === "decided" ? "won with" : "is leading so far with";
  return `${top.label} ${verb} a ${pct1(top.claimRate ?? 0)} claim rate${ratio}.`;
}

/** Ring gauge: share of swipers. Number and label sit beside it, so state never relies on colour. */
function Ring({ value, label }: { value: number; label: string }) {
  const r = 15.9155;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 36 36" className="size-14 shrink-0 -rotate-90" role="img" aria-label={`${label}: ${v}% of swipers`}>
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${v} ${100 - v}`}
        className="stroke-accent motion-safe:transition-[stroke-dasharray] motion-safe:duration-700"
      />
    </svg>
  );
}

function RingStat({ value, pct, label, of, icon }: { value: number; pct: number; label: string; of: number; icon?: IconName }) {
  return (
    <div className="relative flex min-h-24 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 pr-10">
      {icon ? <Icon icon={icon} className="absolute right-3 top-3 text-muted-foreground" /> : null}
      <div className="relative size-14 shrink-0">
        <Ring value={pct} label={label} />
        <span className="tnum absolute inset-0 flex items-center justify-center text-xs font-semibold" aria-hidden>
          {pct}%
        </span>
      </div>
      <div>
        <div className="tnum text-2xl font-semibold">{value}</div>
        <div className="line-clamp-2 text-sm text-muted-foreground">
          {label}, of {of} swipers
        </div>
      </div>
    </div>
  );
}

function SplitStat({ feed, link }: { feed: number; link: number }) {
  const total = feed + link;
  const feedPct = share(feed, total);
  const linkPct = total ? 100 - feedPct : 0;
  // Labels live in a legend under the bar, never inside a segment: a small segment (e.g. 13%) has no room for text.
  const parts = [
    { label: "Feed", n: feed, pct: feedPct, dot: "bg-accent" },
    { label: "Your link", n: link, pct: linkPct, dot: "bg-muted-foreground/40" },
  ];
  return (
    <div className="flex min-h-24 flex-col justify-center rounded-xl border border-border bg-card px-4 py-3">
      {/* Right padding keeps the title clear of the drag handle in the corner. */}
      <p className="pr-10 text-sm font-medium"><IconLabel icon="source">Where swipers came from</IconLabel></p>
      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Feed ${feed}, ${feedPct}%. Your link ${link}, ${linkPct}%.`}
      >
        {feed > 0 && <div className="bg-accent" style={{ width: `${feedPct}%` }} />}
        {link > 0 && <div className="bg-muted-foreground/40" style={{ width: `${linkPct}%` }} />}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
        {parts.map((x) => (
          <li key={x.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", x.dot)} />
            <span className="text-muted-foreground">{x.label}</span>
            <span className="tnum font-semibold">{x.n}</span>
            <span className="tnum text-muted-foreground">· {x.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Swipers → Said yes → Joined waitlist as stepped bars. */
function Funnel({ data }: { data: ResultsPayload }) {
  const t = data.totals;
  const steps = [
    { label: "Swipers", n: t.swipers, cls: "bg-muted-foreground/35" },
    { label: "Said yes", n: t.saidYes, cls: "bg-accent/60" },
    { label: "Joined waitlist", n: t.joined, cls: "bg-accent" },
  ];
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-lg font-semibold"><IconLabel icon="funnel">From swipe to waitlist</IconLabel></h2>
      <ol className="mt-3 space-y-3">
        {steps.map((st, i) => {
          const p = share(st.n, t.swipers);
          const prev = i > 0 ? steps[i - 1].n : 0;
          const drop = i > 0 && prev > 0 ? Math.round(((prev - st.n) / prev) * 100) : null;
          return (
            <li key={st.label} className="grid grid-cols-[7rem_minmax(0,1fr)_8rem] items-center gap-3 text-sm">
              <span className="font-medium">{st.label}</span>
              <div className="h-6 rounded-md bg-muted" role="img" aria-label={`${st.label}: ${st.n}, ${p}% of swipers`}>
                <div className={cn("grow-x h-full rounded-md", st.cls)} style={{ width: `${Math.max(p, st.n > 0 ? 2 : 0)}%` }} />
              </div>
              <span className="tnum text-right">
                <strong>{st.n}</strong> <span className="text-muted-foreground">· {p}%</span>
                {drop !== null && <span className="block text-xs text-muted-foreground">−{drop}% vs step above</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** A headline count as a colour tile. Tones go in a fixed order so a screen reads the same every time. */
function Stat({
  value,
  label,
  icon,
  tone = "bg-card border border-border neutral-ink",
}: {
  icon?: IconName;
  value: React.ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className={cn("relative flex min-h-24 flex-col justify-center rounded-xl px-4 py-3 pr-10 md:px-6 md:py-5", tone)}>
      {icon ? <Icon icon={icon} className="absolute right-3 top-3 text-muted-foreground" /> : null}
      <div className="tnum text-2xl font-semibold">{value}</div>
      <div className="line-clamp-2 text-sm font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function Pill({
  kind,
  children,
}: {
  kind: ResultsPayload["verdict"]["kind"];
  children: React.ReactNode;
}) {
  const tone =
    kind === "decided"
      ? "border-transparent bg-accent-soft text-accent"
      : "border-border bg-background text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <Icon icon={kind === "decided" ? "statusDecided" : "statusCollecting"} />
      {children}
    </span>
  );
}

/** Primary action: Ship winner (WP8 review dialog). It only enables when the test is decided and ships nothing by itself. */
function WebActions({
  deckId,
  shipLabel,
  onChanged,
}: {
  deckId: string;
  shipLabel?: string;
  onChanged?: () => void;
}) {
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      <ShipWinnerButton deckId={deckId} variant="default" className="h-11" label={shipLabel} onChanged={onChanged} />
    </div>
  );
}

/** Phone entry point for the Ship winner sheet (phone 18): the header has no room, so it sits under the verdict. */
function PhoneShip({
  deckId,
  label,
  onChanged,
}: {
  deckId: string;
  label?: string;
  onChanged?: () => void;
}) {
  return (
    <div className="md:hidden">
      <ShipWinnerButton
        deckId={deckId}
        variant="default"
        className="h-11 w-full"
        label={label}
        onChanged={onChanged}
      />
    </div>
  );
}

/**
 * Website before/after (web 22) for decks that were shipped. The ship record decides: when GET /api/sites/shipped
 * has nothing for this deck, nothing renders. `tick` reloads it after a ship or undo.
 */
function ShippedWebsite({ deckId, tick }: { deckId: string; tick: number }) {
  const [data, setData] = React.useState<WebsiteShippedData | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    assistantJson<WebsiteShippedData>(
      "GET",
      `/api/sites/shipped?deckId=${encodeURIComponent(deckId)}`,
    )
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [deckId, tick]);
  if (!data) return null;
  return (
    <WebsiteShippedView
      key={`${data.live}-${data.shippedAt}`}
      deckId={deckId}
      initial={data}
    />
  );
}

/** One labelled bar: name on the left, bar, value at the end. Readable without a legend. */
function LabelledBar({
  name,
  fraction,
  valueText,
  strong,
  aria,
}: {
  name: string;
  fraction: number;
  valueText: string;
  strong: boolean;
  aria: string;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs" role="img" aria-label={aria}>
      <span className="text-muted-foreground">{name}</span>
      <div className="h-3 rounded-full bg-muted" aria-hidden>
        <div
          className={cn("grow-x h-full rounded-full", strong ? "bg-accent" : "bg-muted-foreground/45")}
          style={{ width: `${Math.max(0, Math.min(100, fraction * 100))}%` }}
        />
      </div>
      <span className="tnum min-w-[8.5rem] text-right font-semibold text-foreground">{valueText}</span>
    </div>
  );
}

function LeaderItem({ row, axisMax }: { row: LeaderRow; axisMax: number }) {
  return (
    <li className="border-t border-border py-4 first:border-t-0 @4xl:grid @4xl:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_auto] @4xl:items-center @4xl:gap-5">
      <div className="flex items-baseline justify-between gap-3 @4xl:contents">
        <span className="hidden text-3xl font-extrabold text-muted-foreground @4xl:block">
          {row.rank}
        </span>
        <p className="text-sm font-semibold text-muted-foreground @4xl:hidden">
          {row.rank} · {row.label}
        </p>
        {row.chanceBest !== null && (
          <p
            className={cn(
              "text-sm font-bold @4xl:hidden",
              row.rank === 1 ? "text-accent" : "text-muted-foreground",
            )}
          >
            {Math.round(row.chanceBest * 100)}% chance best
          </p>
        )}
      </div>

      <div className="mt-1 @4xl:mt-0">
        <p className="hidden text-xs font-semibold text-muted-foreground @4xl:block">
          {row.label}
        </p>
        <p className="text-lg font-semibold leading-snug tracking-tight">
          {row.valueText}
        </p>
        {row.rank === 1 && !row.suppressed && (
          <span className="mt-1 inline-block rounded-md border border-transparent bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
            Leading
          </span>
        )}
      </div>

      {row.suppressed ? (
        <p className="mt-2 text-sm text-muted-foreground @4xl:col-span-2 @4xl:mt-0">
          Too few swipers to show (under {LIMITS.groupMinSize}).
        </p>
      ) : (
        <>
          <div className="mt-2 space-y-1.5 @4xl:mt-0">
            <LabelledBar
              name="Joined waitlist"
              fraction={(row.claimRate ?? 0) / axisMax}
              strong={row.rank === 1}
              valueText={
                row.claimRate === null
                  ? "–"
                  : `${pct1(row.claimRate)} · ${row.joined ?? 0} of ${row.swipers ?? 0}`
              }
              aria={`${row.label}: joined waitlist ${row.claimRate === null ? "none" : pct1(row.claimRate)}, ${row.joined ?? 0} of ${row.swipers ?? 0} swipers`}
            />
            <LabelledBar
              name="Said yes"
              fraction={row.swipers ? (row.saidYes ?? 0) / row.swipers : 0}
              strong={false}
              valueText={`${row.swipers ? share(row.saidYes ?? 0, row.swipers) : 0}% · ${row.saidYes ?? 0} of ${row.swipers ?? 0}`}
              aria={`${row.label}: said yes ${row.swipers ? share(row.saidYes ?? 0, row.swipers) : 0}%, ${row.saidYes ?? 0} of ${row.swipers ?? 0} swipers`}
            />
          </div>
          {row.chanceBest !== null && (
            <p className="hidden whitespace-nowrap text-xs text-muted-foreground @4xl:block">
              <strong className={cn("font-extrabold", row.rank === 1 ? "text-accent" : "text-foreground")}>
                {Math.round(row.chanceBest * 100)}%
              </strong>{" "}
              chance best
            </p>
          )}
        </>
      )}
    </li>
  );
}

function Leaderboard({ data }: { data: ResultsPayload }) {
  const [filter, setFilter] = React.useState<LeaderFilter>("everyone");
  const rows = data.leaderboard[filter];
  const maxRate = Math.max(0, ...rows.map((r) => r.claimRate ?? 0));
  const axisMax = Math.max(0.2, maxRate * 1.1);

  return (
    <Card className="@container border-0 bg-transparent p-0 md:border md:bg-card md:p-5">
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <h2 className="text-lg font-semibold tracking-tight">
          <IconLabel icon="leaderboard">Leaderboard</IconLabel>{" "}
          <span className="text-sm font-medium tracking-normal text-muted-foreground">
            ranked by reward claim rate
          </span>
        </h2>
        <div
          role="tablist"
          aria-label="Leaderboard filter"
          className="inline-flex rounded-xl bg-muted p-1"
        >
          {LEADER_FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f
                  ? "bg-card text-foreground "
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LEADER_FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          No swipes counted for this test yet.
        </p>
      ) : (
        <ol
          className="md:mt-3"
          aria-label={`Leaderboard, ${LEADER_FILTER_LABELS[filter]}`}
        >
          {rows.map((row) => (
            <LeaderItem key={row.key} row={row} axisMax={axisMax} />
          ))}
        </ol>
      )}

      {filter !== "everyone" && (
        <p className="mt-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {filter === "target"
            ? "Target users only"
            : "Swipes from your link only"}
          : a lead, not a result. The winner is decided only on the full
          experiment, and groups under {LIMITS.groupMinSize} swipers are hidden.
        </p>
      )}
    </Card>
  );
}

function AssistantCard({ data }: { data: ResultsPayload }) {
  const { verdict, assistant, flagsmithAvailable } = data;
  let body: React.ReactNode;
  if (data.deck.localSplitReason !== undefined) {
    // A local-split deck never gets Flagsmith results: say so, rather than "not available yet".
    body = (
      <>
        <strong>
          This test runs a local split, not a Flagsmith experiment.
        </strong>{" "}
        The numbers above are your counted swipes. Flagsmith will not report
        results for it, so no winner or chance is shown.
      </>
    );
  } else if (!flagsmithAvailable) {
    body = (
      <>
        <strong>Flagsmith results are not available yet.</strong> The numbers
        above are your counted swipes. No winner or chance is shown until
        Flagsmith reports one.
      </>
    );
  } else if (verdict.kind === "decided") {
    body = (
      <>
        <strong>Test decided.</strong> {verdict.leaderLabel} has a{" "}
        {Math.round((verdict.chance ?? 0) * 100)}% chance of being best. Nothing
        changes until you approve and ship.
      </>
    );
  } else {
    const last =
      assistant.minutesAgo === null
        ? ""
        : ` (last check ${assistant.minutesAgo} min ago${verdict.chance !== null ? `: ${Math.round(verdict.chance * 100)}%` : ""})`;
    body = (
      <>
        <strong>Assistant is watching.</strong> It checks Flagsmith every{" "}
        {LIMITS.resultsRefreshMinutes} minutes{last}. At{" "}
        {Math.round(LIMITS.winnerConfidence * 100)}%, it tells you and asks
        before shipping.
      </>
    );
  }
  return (
    <div className="flex gap-3 rounded-2xl bg-muted p-4 text-sm leading-relaxed md:text-base">
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
      <p>{body}</p>
    </div>
  );
}

function Skeleton({ error }: { error?: string }) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl bg-warning-soft p-4 text-sm font-medium text-warning"
    >
      {error}
    </p>
  ) : (
    <div aria-busy aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading results</span>
      <div className="h-8 w-2/3 rounded-lg bg-muted motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted motion-safe:animate-pulse" />
    </div>
  );
}

/** F7 Results (phone 14, web 16) and F7b price results with the demand curve (phone 15, web 17). */
export function ResultsScreen({ deckId }: { deckId: string }) {
  const { data, error } = useDeckResults(deckId);
  const [shipTick, setShipTick] = React.useState(0);
  const bump = React.useCallback(() => setShipTick((n) => n + 1), []);
  if (!data) return <Skeleton error={error} />;

  const { deck, verdict, totals, priceCurve } = data;
  const empty = totals.swipers === 0;

  const blocks: MovableBlock[] = [];
  if (!priceCurve && !empty)
    blocks.push({ id: "funnel", label: "Swipe to waitlist funnel", size: "full", node: <Funnel data={data} /> });
  if (priceCurve) {
    for (const t of demandStatTiles(priceCurve))
      blocks.push({ id: t.id, label: t.label, size: "quarter", className: t.className, node: t.node });
    blocks.push({ id: "dc-join-rate", label: "Who joined at each price", size: "half", node: <JoinRateCard data={priceCurve} /> });
    blocks.push({ id: "dc-revenue", label: "Revenue per 100 swipers", size: "half", node: <RevenueCard data={priceCurve} /> });
    blocks.push({ id: "dc-numbers", label: "Every price, in numbers", size: "full", className: "hidden md:block", node: <PriceNumbersCard data={priceCurve} /> });
    blocks.push({ id: "dc-how-to-read", label: "How to read this", size: "full", className: "hidden md:block", node: <HowToReadCard data={priceCurve} /> });
  } else {
    blocks.push({ id: "stat-swipers", label: "Swipers", size: "quarter", node: <Stat icon="swipers" value={totals.swipers} label="Swipers" /> });
    blocks.push({ id: "stat-yes", label: "Said yes", size: "quarter", node: <RingStat icon="saidYes" value={totals.saidYes} pct={share(totals.saidYes, totals.swipers)} label="Said yes" of={totals.swipers} /> });
    blocks.push({ id: "stat-joined", label: "Joined waitlist", size: "quarter", node: <RingStat icon="joined" value={totals.joined} pct={share(totals.joined, totals.swipers)} label="Joined waitlist" of={totals.swipers} /> });
    blocks.push({ id: "stat-source", label: "Where swipers came from", size: "quarter", node: <SplitStat feed={totals.feed} link={totals.link} /> });
    blocks.push({
      id: "leaderboard",
      label: "Leaderboard",
      size: "full",
      node: empty ? (
        <Card className="p-5 text-muted-foreground">
          {deck.status === "draft"
            ? "This test is still a draft. Publish it to start collecting swipes."
            : "No counted swipes yet. Only swipes from people whose quality score is 70 or more count here."}
        </Card>
      ) : (
        <Leaderboard data={data} />
      ),
    });
  }
  if (!priceCurve || data.flagsmithAvailable)
    blocks.push({
      id: "assistant",
      label: "Split and Flagsmith note",
      size: "full",
      node: <AssistantCard data={data} />,
    });

  return (
    <div className="rise-children space-y-6">
      <ShippedWebsite deckId={deck.id} tick={shipTick} />
      {priceCurve ? (
        <>
          <div className="hidden justify-end md:flex">
            <WebActions
              deckId={deck.id}
              shipLabel={
                verdict.kind === "decided" ? undefined : "Ship winner at 95%"
              }
              onChanged={bump}
            />
          </div>
          <PhoneShip
            deckId={deck.id}
            label={
              verdict.kind === "decided" ? undefined : "Ship winner at 95%"
            }
            onChanged={bump}
          />
          <DemandCurveHeader data={priceCurve} />
        </>
      ) : (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-0 space-y-2">
                <Pill kind={verdict.kind}>{verdict.pill}</Pill>
                <p className="text-lg font-semibold tracking-tight" aria-live="polite">
                  {takeaway(data) ?? verdict.headline}
                </p>
              </div>
              <WebActions deckId={deck.id} onChanged={bump} />
            </div>
            <PhoneShip deckId={deck.id} onChanged={bump} />
          </header>
        </>
      )}

      <MovableBlocks blocks={blocks} storageKey="ps:results-layout-v2" />

      <p className="text-xs text-muted-foreground">
        {deck.localSplitReason !== undefined
          ? `No winner is called for this test${deck.localSplitReason ? ` (${deck.localSplitReason})` : ""}. Swipes under 2 seconds are excluded.`
          : "Swipes under 2 seconds are excluded."}
      </p>
    </div>
  );
}
