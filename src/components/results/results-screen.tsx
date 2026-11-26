"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Mail, Sparkles, Zap } from "lucide-react";

import { assistantJson } from "@/components/assistant/api";
import { ShipWinnerButton } from "@/components/assistant";
import { DemandCurve } from "@/components/demand-curve";
import { DownloadResultsButton } from "@/components/export";
import { WebsiteShippedView } from "@/components/sites";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/demo-badge";
import { LIMITS } from "@/fixtures";
import type { WebsiteShippedData } from "@/lib/sites/types";
import {
  LEADER_FILTERS,
  LEADER_FILTER_LABELS,
  type LeaderFilter,
  type LeaderRow,
  type ResultsPayload,
} from "@/lib/results/types";
import { cn } from "@/lib/utils";

import { downloadWaitlistCsv } from "./api";
import { useDeckResults } from "./use-results";

const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** A headline count as a colour tile. Tones go in a fixed order so a screen reads the same every time. */
function Stat({ value, label, tone = "bg-lilac" }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className={cn("tile px-4 py-3 md:px-6 md:py-5", tone)}>
      <div className="stretch-display tnum text-2xl font-bold md:text-4xl">{value}</div>
      <div className="text-sm font-semibold text-ink/70">{label}</div>
    </div>
  );
}

function Pill({ kind, children }: { kind: ResultsPayload["verdict"]["kind"]; children: React.ReactNode }) {
  const tone =
    kind === "decided"
      ? "border-transparent bg-accent-soft text-accent"
      : "border-warning bg-background text-warning";
  return <span className={cn("inline-block rounded-lg border px-3 py-1 text-sm font-semibold", tone)}>{children}</span>;
}

/**
 * Web actions: Download results (WP11 export sheet/dialog) and Ship winner (WP8 review dialog).
 * Ship winner only enables when Flagsmith says the test is decided; it ships nothing by itself.
 */
function WebActions({
  deckId,
  boost = true,
  shipLabel,
  onChanged,
}: {
  deckId: string;
  boost?: boolean;
  shipLabel?: string;
  onChanged?: () => void;
}) {
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      <DownloadResultsButton deckId={deckId} variant="labelled" />
      {boost && (
        <Link href={`/decks/${deckId}/boost`} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
          <Zap /> Boost
        </Link>
      )}
      <ShipWinnerButton deckId={deckId} variant="secondary" className="h-11" label={shipLabel} onChanged={onChanged} />
    </div>
  );
}

/** Phone entry point for the Ship winner sheet (phone 18): the header has no room, so it sits under the verdict. */
function PhoneShip({ deckId, label, onChanged }: { deckId: string; label?: string; onChanged?: () => void }) {
  return (
    <div className="md:hidden">
      <ShipWinnerButton deckId={deckId} variant="secondary" className="h-11 w-full" label={label} onChanged={onChanged} />
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
    assistantJson<WebsiteShippedData>("GET", `/api/sites/shipped?deckId=${encodeURIComponent(deckId)}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [deckId, tick]);
  if (!data) return null;
  return <WebsiteShippedView key={`${data.live}-${data.shippedAt}`} deckId={deckId} initial={data} hideCrumb />;
}

function ClaimRateBar({ rate, axisMax }: { rate: number | null; axisMax: number }) {
  return (
    <div className="h-3 flex-1 rounded-full bg-muted" aria-hidden>
      <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${Math.min(100, ((rate ?? 0) / axisMax) * 100)}%` }} />
    </div>
  );
}

function LeaderItem({ row, axisMax }: { row: LeaderRow; axisMax: number }) {
  const stat = (n: number | null, label: string) => (
    <span className="whitespace-nowrap">
      <strong className="font-extrabold text-foreground">{n ?? "–"}</strong> {label}
    </span>
  );
  return (
    <li className="border-t border-border py-4 first:border-t-0 @4xl:grid @4xl:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1.4fr)_auto] @4xl:items-center @4xl:gap-5">
      <div className="flex items-baseline justify-between gap-3 @4xl:contents">
        <span className="hidden text-3xl font-extrabold text-muted-foreground @4xl:block">{row.rank}</span>
        <p className="text-sm font-semibold text-muted-foreground @4xl:hidden">
          {row.rank} · {row.label}
        </p>
        {row.chanceBest !== null && (
          <p className={cn("text-sm font-bold @4xl:hidden", row.rank === 1 ? "text-accent" : "text-muted-foreground")}>
            {Math.round(row.chanceBest * 100)}% chance best
          </p>
        )}
      </div>

      <div className="mt-1 @4xl:mt-0">
        <p className="hidden text-xs font-semibold text-muted-foreground @4xl:block">{row.label}</p>
        <p className="text-lg font-extrabold leading-snug tracking-tight">{row.valueText}</p>
      </div>

      {row.suppressed ? (
        <p className="mt-2 text-sm text-muted-foreground @4xl:col-span-2 @4xl:mt-0">
          Too few swipers to show (under {LIMITS.groupMinSize}).
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3 @4xl:mt-0">
            <ClaimRateBar rate={row.claimRate} axisMax={axisMax} />
            <span className="shrink-0 whitespace-nowrap text-right text-base font-extrabold tracking-tight @4xl:w-16">
              {row.claimRate === null ? "–" : pct1(row.claimRate)}
              <span className="@4xl:hidden"> claimed</span>
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground @4xl:mt-0 @4xl:grid @4xl:grid-cols-4 @4xl:gap-5 @4xl:text-xs">
            {stat(row.swipers, "swipers")}
            {stat(row.saidYes, "said yes")}
            {stat(row.joined, "joined waitlist")}
            {row.chanceBest !== null && (
              <span className="hidden whitespace-nowrap @4xl:inline">
                <strong className={cn("font-extrabold", row.rank === 1 ? "text-accent" : "text-foreground")}>
                  {Math.round(row.chanceBest * 100)}%
                </strong>{" "}
                chance best
              </span>
            )}
          </p>
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
    <Card className="@container border-0 bg-transparent p-0 md:border md:bg-card md:p-6">
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <h2 className="text-xl md:text-2xl">
          Leaderboard <span className="text-sm font-medium tracking-normal text-muted-foreground">ranked by reward claim rate</span>
        </h2>
        <div role="tablist" aria-label="Leaderboard filter" className="inline-flex rounded-xl bg-muted p-1">
          {LEADER_FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LEADER_FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No swipes counted for this deck yet.</p>
      ) : (
        <ol className="md:mt-3" aria-label={`Leaderboard, ${LEADER_FILTER_LABELS[filter]}`}>
          {rows.map((row) => (
            <LeaderItem key={row.key} row={row} axisMax={axisMax} />
          ))}
        </ol>
      )}

      {filter !== "everyone" && (
        <p className="mt-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {filter === "target" ? "Target users only" : "Swipes from your link only"}: a lead, not a result. The winner is
          decided only on the full experiment, and groups under {LIMITS.groupMinSize} swipers are hidden.
        </p>
      )}
    </Card>
  );
}

function AssistantCard({ data }: { data: ResultsPayload }) {
  const { verdict, assistant, flagsmithAvailable } = data;
  let body: React.ReactNode;
  if (data.deck.localSplitReason !== undefined && !data.demo) {
    // A local-split deck never gets Flagsmith results: say so, rather than "not available yet".
    body = (
      <>
        <strong>This deck runs a local split, not a Flagsmith experiment.</strong> The numbers above are your counted
        swipes. Flagsmith will not report results for it, so no winner or chance is shown.
      </>
    );
  } else if (!flagsmithAvailable) {
    body = (
      <>
        <strong>Flagsmith results are not available yet.</strong> The numbers above are your counted swipes. No winner or
        chance is shown until Flagsmith reports one.
      </>
    );
  } else if (verdict.kind === "decided") {
    body = (
      <>
        <strong>Test decided.</strong> {verdict.leaderLabel} has a {Math.round((verdict.chance ?? 0) * 100)}% chance of being
        best. Nothing changes until you approve and ship.
      </>
    );
  } else {
    const last =
      assistant.minutesAgo === null
        ? ""
        : ` (last check ${assistant.minutesAgo} min ago${verdict.chance !== null ? `: ${Math.round(verdict.chance * 100)}%` : ""})`;
    body = (
      <>
        <strong>Assistant is watching.</strong> It checks Flagsmith every {LIMITS.resultsRefreshMinutes} minutes{last}. At{" "}
        {Math.round(LIMITS.winnerConfidence * 100)}%, it tells you and asks before shipping.
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

function WaitlistCard({ data }: { data: ResultsPayload }) {
  const { waitlist } = data;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const download = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await downloadWaitlistCsv(data.deck.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Phone */}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-4 md:hidden">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-background text-accent">
            <Mail className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Waitlist: {waitlist.count} people</p>
            <p className="text-sm text-muted-foreground">{waitlist.acrossText}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={busy || waitlist.count === 0}
          className={cn(buttonVariants({ size: "default" }), "px-4")}
        >
          <Download /> CSV
        </button>
      </div>

      {/* Web */}
      <Card className="hidden p-6 md:block">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Waitlist</h2>
          <button
            type="button"
            onClick={download}
            disabled={busy || waitlist.count === 0}
            className="flex items-center gap-1.5 text-sm font-semibold underline disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden /> Download emails
          </button>
        </div>
        <p className="mt-3 text-muted-foreground">
          {waitlist.count} {waitlist.count === 1 ? "person" : "people"} claimed
          {waitlist.reward ? ` "${waitlist.reward}"` : " the reward"}. This is your waitlist: one list for every card in
          this deck. Contact them at launch or before.
        </p>
        <ul className="mt-3">
          {waitlist.preview.map((c) => (
            <li key={`${c.email}-${c.cardLabel}-${c.when}`} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0">
              <span className="min-w-0 truncate font-semibold">{c.email}</span>
              <span className="flex shrink-0 items-center gap-3 text-sm">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold">{c.cardLabel}</span>
                <span className="w-16 text-right text-muted-foreground">{c.when}</span>
              </span>
            </li>
          ))}
        </ul>
        {waitlist.moreCount > 0 && <p className="border-t border-border pt-3 text-sm font-semibold">+ {waitlist.moreCount} more</p>}
      </Card>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

function Skeleton({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-warning-soft p-4 text-sm font-medium text-warning">
      {error}
    </p>
  ) : (
    <p aria-live="polite" className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
      Loading results...
    </p>
  );
}

/** F7 Results (phone 14, web 16) and F7b price results with the demand curve (phone 15, web 17). */
export function ResultsScreen({ deckId, initial }: { deckId: string; initial?: ResultsPayload }) {
  const { data, error } = useDeckResults(deckId, initial);
  const [shipTick, setShipTick] = React.useState(0);
  const bump = React.useCallback(() => setShipTick((n) => n + 1), []);
  if (!data) return <Skeleton error={error} />;

  const { deck, verdict, totals, priceCurve } = data;
  const empty = totals.swipers === 0;

  return (
    <div className="rise-children space-y-5 md:space-y-6">
      <ShippedWebsite deckId={deck.id} tick={shipTick} />
      {priceCurve ? (
        <>
          <div className="hidden justify-end md:flex">
            <WebActions deckId={deck.id} boost={false} shipLabel={verdict.kind === "decided" ? undefined : "Ship winner at 95%"} onChanged={bump} />
          </div>
          <PhoneShip deckId={deck.id} label={verdict.kind === "decided" ? undefined : "Ship winner at 95%"} onChanged={bump} />
          <DemandCurve data={priceCurve} />
        </>
      ) : (
        <>
          <header className="space-y-3">
            <div className="md:flex md:flex-wrap md:items-start md:justify-between md:gap-x-4 md:gap-y-3">
              <div className="min-w-0 space-y-3 md:flex md:flex-1 md:basis-[28rem] md:flex-wrap md:items-center md:gap-3 md:space-y-0">
                <h1 className="text-4xl md:hidden">
                  <span className="inline-block max-w-[12ch] border-b-4 border-accent pb-1 leading-[1.05]">{verdict.headline}</span>
                </h1>
                <h1 className="hidden text-4xl lg:text-5xl md:block">Which {deck.noun} is winning</h1>
                <Pill kind={verdict.kind}>{verdict.pill}</Pill>
              </div>
              <WebActions deckId={deck.id} onChanged={bump} />
            </div>
            <PhoneShip deckId={deck.id} onChanged={bump} />
          </header>

          <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
            <Stat value={totals.swipers} label="Swipers" />
            <Stat value={totals.saidYes} label="Said yes" tone="bg-sky" />
            <Stat value={totals.joined} label="Joined waitlist" tone="bg-sun" />
            <div className="hidden md:block">
              <Stat value={`${totals.feed} / ${totals.link}`} label="From feed / your link" tone="bg-coral" />
            </div>
          </div>

          {empty ? (
            <Card className="p-6 text-muted-foreground">
              {deck.status === "draft"
                ? "This deck is still a draft. Publish it to start collecting swipes."
                : "No counted swipes yet. Only swipes from people whose quality score is 70 or more count here."}
            </Card>
          ) : (
            <Leaderboard data={data} />
          )}

          <AssistantCard data={data} />
        </>
      )}

      {priceCurve && data.flagsmithAvailable && <AssistantCard data={data} />}
      {(!priceCurve || data.waitlist.count > 0) && <WaitlistCard data={data} />}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <Link href={`/decks/${deck.id}/who-swiped`} className="font-semibold text-foreground underline">
          Who swiped
        </Link>
        <span>·</span>
        {deck.localSplitReason !== undefined && !data.demo ? (
          <span>
            Local split: not running on Flagsmith
            {deck.localSplitReason ? ` (${deck.localSplitReason})` : " (Flagsmith was not set up when this deck was published)"}. No
            winner is called for this deck. Swipes under 2 seconds are excluded.
          </span>
        ) : (
          <span>
            Experiment <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{deck.flagName}</code> runs on Flagsmith. Swipes
            under 2 seconds are excluded.
          </span>
        )}
      </p>
      {data.demo && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <DemoBadge />
          Every number on this screen is made up for the mockup.{deck.variable === "price" && " The chances and the extra swipers needed are the design's values, not computed from the counts."}
        </p>
      )}
    </div>
  );
}
