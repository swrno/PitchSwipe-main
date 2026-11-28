"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";

import { AudienceCard } from "@/features/share/ui/audience-card";
import { LIMITS } from "@/shared/lib/limits";
import { LEADS_FOOTNOTE, pct } from "@/features/results/insights";
import {
  WHO_TABS,
  WHO_TAB_LABELS,
  type ResultsPayload,
  type WhoTab,
} from "@/features/results/types";
import { cn } from "@/shared/lib/utils";
import { MovableBlocks } from "@/shared/ui/movable-blocks";
import { useDeckResults } from "./use-results";

import {
  InsightCard,
  Panel,
  PeopleRow,
  SegmentBars,
  StateMap,
  TotalBox,
} from "./segment-parts";

function LocationPanel({ data }: { data: ResultsPayload }) {
  const tab = data.whoSwiped.location;
  return (
    <Panel icon="location" title="Location" subtitle="State, approximate from IP">
      <p>
        How many people from each state <strong>joined the waitlist</strong>.
      </p>
      <StateMap tab={tab} />
      <SegmentBars view={tab} unit="per state" />
      <TotalBox
        view={tab}
        line={
          tab.other
            ? `${tab.shown.swipers} in these ${tab.rows.length} states + ${tab.other.swipers} hidden (under ${LIMITS.groupMinSize} per state) = ${tab.overall.swipers} · ${tab.shown.joined} + ${tab.other.joined} = ${tab.overall.joined} joined`
            : undefined
        }
      />
      {tab.insight && <InsightCard insight={tab.insight} />}
      {tab.hiddenNote && (
        <p className="text-sm text-muted-foreground">{tab.hiddenNote}</p>
      )}
    </Panel>
  );
}

function SwipeToWaitlist({ data }: { data: ResultsPayload }) {
  const v = data.whoSwiped.saidYesVsActed;
  const max = Math.max(v.swipers, 1);
  const bar = (n: number, cls: string) => (
    <div
      className="grow-x h-6 rounded-sm"
      style={{ width: `${Math.max(2, (n / max) * 100)}%` }}
    >
      <div className={cn("h-full w-full rounded-sm", cls)} />
    </div>
  );
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-lg"><IconLabel icon="funnel">From swipe to waitlist</IconLabel></h3>
        <span className="text-sm text-muted-foreground">
          All {v.swipers} swipers
        </span>
      </div>
      <p className="mt-1 text-base font-extrabold text-foreground">
        {v.headline}
      </p>
      <dl className="mt-2 space-y-2">
        {[
          {
            label: "Swiped",
            n: v.swipers,
            text: `${v.swipers}`,
            cls: "bg-muted-foreground/35",
          },
          {
            label: "Said yes",
            n: v.saidYes,
            text: `${v.saidYes} (${v.saidYesPct}%)`,
            cls: "bg-accent/55",
          },
          {
            label: "Left an email",
            n: v.joined,
            text: `${v.joined} (${v.joinedPct}%)`,
            cls: "bg-accent",
          },
        ].map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3"
          >
            <dt className="font-bold">{r.label}</dt>
            <dd className="flex items-center gap-3">
              <div className="min-w-0 flex-1">{bar(r.n, r.cls)}</div>
              <span className="w-20 shrink-0 text-sm font-bold">{r.text}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-muted-foreground">{v.note}</p>
    </div>
  );
}

function TargetPanel({ data }: { data: ResultsPayload }) {
  const t = data.whoSwiped.target;
  const group = (
    g: NonNullable<typeof t.target>,
    title: string,
    highlight: boolean,
  ) => (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlight ? "border-2 border-accent" : "border-border",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-extrabold">{title}</p>
        <p
          className={cn(
            "text-3xl font-extrabold tracking-tight",
            highlight ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {pct(g.joinRate)}%
        </p>
      </div>
      <div className="mt-2">
        <PeopleRow rate={g.joinRate} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {g.swipers} swipers · {g.saidYes} said yes · {g.joined} joined
      </p>
    </div>
  );
  return (
    <Panel
      icon="target"
      title="Target users"
      subtitle={
        t.roles.length > 0
          ? `From swiper profiles: ${t.roles.join(" or ")}`
          : "From swiper profiles"
      }
    >
      {t.enough && t.target && t.everyone ? (
        <>
          <p>Who joined the waitlist, out of every 10 people:</p>
          {group(
            t.target,
            `Target users${t.roles.length ? ` (${t.roles.join(", ")})` : ""}`,
            true,
          )}
          {group(t.everyone, "Everyone else", false)}
          <p className="text-sm text-muted-foreground">{t.total.text}</p>
        </>
      ) : (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          {t.total.text}
        </p>
      )}
      <SwipeToWaitlist data={data} />
      {t.insight && <InsightCard insight={t.insight} />}
    </Panel>
  );
}

function SourcePanel({ data }: { data: ResultsPayload }) {
  const s = data.whoSwiped.source;
  const cell = (c: (typeof s.cards)[number]["feed"], best: boolean) =>
    c ? (
      <div>
        <p className={cn("text-lg font-extrabold", best && "text-accent")}>
          {pct(c.rate)}%
        </p>
        <p className="text-xs text-muted-foreground">
          {c.swipers} swipers · {c.saidYes} yes · {c.joined} joined
        </p>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Other (under 10)</p>
    );
  return (
    <Panel icon="source" title="Source" subtitle="Swipe feed vs your link">
      <SegmentBars view={s} />
      <TotalBox view={s} line={s.totalText || undefined} />
      {s.cards.length > 1 && (
        <div>
          <h3 className="text-lg"><IconLabel icon="source">Each {data.deck.noun}, by source</IconLabel></h3>
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 font-semibold">
                  <span className="sr-only">Version</span>
                </th>
                <th scope="col" className="py-1.5 font-semibold">
                  Swipe feed
                </th>
                <th scope="col" className="py-1.5 font-semibold">
                  Your link
                </th>
              </tr>
            </thead>
            <tbody>
              {s.cards.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-border last:border-b-0"
                >
                  <th scope="row" className="py-2 pr-2 text-sm font-extrabold">
                    {c.label}
                  </th>
                  <td className="py-2 pr-2">{cell(c.feed, c.feedBest)}</td>
                  <td className="py-2">{cell(c.link, c.linkBest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.insight && <InsightCard insight={s.insight} />}
    </Panel>
  );
}

function InterestsPanel({ data }: { data: ResultsPayload }) {
  const i = data.whoSwiped.interests;
  return (
    <Panel icon="interests" title="Interests" subtitle="One person can follow several">
      <SegmentBars view={i} unit="per interest" />
      <TotalBox view={i} hint={i.totalText} />
      {i.tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {i.tiles.map((t) => (
            <div key={t.text} className="rounded-xl border border-border p-4">
              <p className="text-3xl font-extrabold tracking-tight">
                {t.value}
              </p>
              <p className="text-sm text-muted-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      )}
      {i.insight && <InsightCard insight={i.insight} />}
    </Panel>
  );
}

/**
 * "Who swiped" tab of a test: four tabs on phone, all four panels on web.
 * Every panel is a Lead view: the winner is decided only on the full experiment.
 */
export function WhoSwipedSection({ data }: { data: ResultsPayload }) {
  const [tab, setTab] = React.useState<WhoTab>(() => {
    const q =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("tab");
    return WHO_TABS.find((t) => t === q) ?? "location";
  });

  const select = (next: WhoTab) => {
    setTab(next);
    // Keeps the tab in the URL so the deck switcher carries it to the next deck.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const { deck, whoSwiped } = data;
  const show = (t: WhoTab) => cn(tab === t ? "block" : "hidden", "md:block");

  return (
    <section
      id="who-swiped"
      aria-labelledby="who-swiped-title"
      className="scroll-mt-24 space-y-5 md:space-y-6"
    >
      <header>
        <h2
          id="who-swiped-title"
          className="text-lg font-semibold tracking-tight md:text-2xl"
        >
          <IconLabel icon="whoSwiped">Audience & who swiped</IconLabel>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground md:hidden">
          {whoSwiped.validSwipers} valid swipers · {deck.label}
        </p>
      </header>

      {!whoSwiped.hasData ? (
        <p className="rounded-xl bg-muted p-5 text-muted-foreground">
          No counted swipes yet, so there is nobody to show. Only swipes from
          people whose quality score is 70 or more count.
        </p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Audience & who swiped"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:hidden"
          >
            {WHO_TABS.map((t) => (
              <button
                key={t}
                id={`who-tab-${t}`}
                role="tab"
                type="button"
                aria-selected={tab === t}
                aria-controls={`who-panel-${t}`}
                onClick={() => select(t)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background",
                )}
              >
                {WHO_TAB_LABELS[t]}
              </button>
            ))}
          </div>

          <MovableBlocks
            storageKey="ps:who-swiped-layout"
            blocks={(
              [
                ["location", "Location", <LocationPanel key="l" data={data} />],
                ["target", "Target users", <TargetPanel key="t" data={data} />],
                ["source", "Source", <SourcePanel key="s" data={data} />],
                ["interests", "Interests", <InterestsPanel key="i" data={data} />],
              ] as const
            ).map(([id, label, node]) => ({
              id,
              label,
              size: "half" as const,
              className: show(id),
              node: (
                <div id={`who-panel-${id}`} role="tabpanel" aria-labelledby={`who-tab-${id}`}>
                  {node}
                </div>
              ),
            }))}
          />
        </>
      )}

      <p className="text-sm text-muted-foreground">{LEADS_FOOTNOTE}</p>
    </section>
  );
}

/** The test's Who swiped tab: loads the results and shows the draggable cards. */
export function WhoSwipedScreen({ deckId }: { deckId: string }) {
  const { data, error } = useDeckResults(deckId);
  if (!data) {
    return error ? (
      <p role="alert" className="rounded-xl bg-warning-soft p-4 text-sm font-medium text-warning">
        {error}
      </p>
    ) : (
      <div aria-busy className="h-64 rounded-xl bg-muted motion-safe:animate-pulse" />
    );
  }
  return (
    <div className="space-y-6">
      <AudienceCard deckId={deckId} />
      <WhoSwipedSection data={data} />
    </div>
  );
}
