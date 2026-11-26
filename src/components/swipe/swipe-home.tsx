"use client";

import * as React from "react";
import { Check, Clock, Shuffle } from "lucide-react";
import { WalletPill } from "./wallet-pill";
import { Button } from "@/components/ui/button";
import { HOME_IDEA_SELECTION } from "@/fixtures";
import { MIN_READ_MS, PAID_RATE_RS } from "@/lib/swipe/validity";
import { INDUSTRIES, type Industry } from "@/lib/lists";
import { DemoBadge } from "@/components/ui/demo-badge";
import { ArrowChip, Mascot } from "@/components/ui/mascot";
import type { WalletView } from "@/lib/claims/rules";
import { cn, formatRs } from "@/lib/utils";
import { haptic } from "@/lib/feel/haptics";

/**
 * Swipe home (designs phone 33, web 32). "Earned today" and "Valid swipes today" are computed from the swiper's own wallet
 * credits (today, India time). Demo mode starts from the design numbers (phone 33: Rs 6.25, 25) and labels them. The "Show me ideas for" chips are sent to the feed as a filter on product industry.
 */
export function SwipeHome({
  onStart,
  starting,
  error,
  wallet = null,
}: {
  onStart: (interests: Industry[]) => void;
  starting: boolean;
  error?: string | null;
  /** The swiper's own wallet (real, or the demo wallet in demo mode); null while it loads or if it failed. */
  wallet?: WalletView | null;
}) {
  const balanceRs = wallet ? wallet.balanceRs : null;
  // null until the swiper changes it. Real swipers start with nothing selected, which the feed reads as "all ideas";
  // only the demo wallet starts from the design's selection.
  const [chosen, setChosen] = React.useState<Industry[] | null>(null);
  const selected = chosen ?? (wallet?.demo ? [...HOME_IDEA_SELECTION] : []);
  const [editing, setEditing] = React.useState(false);

  const howItWorks = [
    { icon: Shuffle, title: "Ideas come in random order", body: "You do not pick. Every idea gets a fair chance." },
    { icon: Clock, title: "One card per idea", body: "Read it, answer one question. About 10 seconds." },
    {
      icon: Check,
      title: `${formatRs(PAID_RATE_RS)} on every paid card`,
      body: `Paid cards say so. Read ${MIN_READ_MS / 1000}+ seconds; yes and no pay the same.`,
    },
  ];

  function toggle(industry: Industry) {
    haptic("select");
    setChosen(selected.includes(industry) ? selected.filter((i) => i !== industry) : [...selected, industry]);
  }

  const statTiles = [
    { label: "Earned today", value: wallet ? formatRs(wallet.todayRs) : "...", tone: "bg-lilac", className: "" },
    { label: "Valid swipes today", value: wallet ? String(wallet.todayValidSwipes) : "...", tone: "bg-sky", className: "" },
    { label: "Wallet balance", value: balanceRs === null ? "..." : formatRs(balanceRs), tone: "bg-sun", className: "hidden md:block" },
  ];
  const howTones = ["bg-coral", "bg-sky", "bg-lime"];

  return (
    <div className="rise-children space-y-6 md:space-y-8">
      <div className="space-y-2">
        <div className="flex justify-end md:hidden">
          <WalletPill balanceRs={balanceRs} />
        </div>
        <h1 className="text-[2.1rem] md:text-6xl">
          Swipe on new ideas.
          <br />
          <span className="accent-underline">Get paid for it.</span>
        </h1>
      </div>

      {/* The main block: what to show, and the one button that starts. */}
      <section aria-labelledby="start-swiping" className="tile relative overflow-hidden bg-lime p-5 md:p-7">
        <Mascot mood="happy" color="var(--cream)" back="var(--sky)" className="absolute -right-2 -top-1 size-24 md:right-4 md:top-3 md:size-32" />
        <span className="inline-flex rounded-full bg-ink px-3 py-1 text-xs font-bold text-ink-foreground">
          {formatRs(PAID_RATE_RS)} per paid card
        </span>
        <h2 id="start-swiping" className="mt-3 max-w-[14ch] text-[1.75rem] md:text-4xl">
          Ready for the next idea?
        </h2>
        <p className="mt-1 max-w-[34ch] text-sm text-ink/75 md:text-base">Read the card, answer one question. Yes and no pay the same.</p>

        <div className="mt-5 flex items-baseline justify-between">
          <p className="text-sm font-bold">Show me ideas for</p>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-sm font-bold underline underline-offset-4">
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Idea categories">
          {INDUSTRIES.map((industry) => {
            const on = selected.includes(industry);
            return (
              <button
                key={industry}
                type="button"
                aria-pressed={on}
                disabled={!editing}
                onClick={() => toggle(industry)}
                className={cn(
                  "pressable rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default",
                  on ? "bg-ink text-ink-foreground" : "bg-transparent text-ink",
                  editing && "cursor-pointer",
                )}
              >
                {industry}
              </button>
            );
          })}
        </div>
        {selected.length === 0 ? (
          <p className="mt-2 text-sm text-ink/70">No category filter: ideas from every category can show up. Tap Edit to narrow it.</p>
        ) : null}

        <Button
          variant="ink"
          size="lg"
          className="mt-5 w-full justify-between pl-7 pr-3 text-base md:w-auto md:min-w-80"
          disabled={starting}
          onClick={() => onStart(selected)}
        >
          {starting ? "Finding an idea..." : "Start swiping"}
          <ArrowChip />
        </Button>
        <p className="mt-2 text-xs font-semibold text-ink/65">Answer honestly. There is no right answer.</p>
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {statTiles.map((t) => (
            <div key={t.label} className={cn("tile p-5 md:px-6", t.tone, t.className)}>
              <p className="stretch-display tnum text-3xl font-bold">{t.value}</p>
              <p className="mt-1 text-sm font-semibold text-ink/70">{t.label}</p>
            </div>
          ))}
        </div>
        {wallet?.demo ? <DemoBadge /> : null}
      </div>

      <section className="space-y-3" aria-labelledby="how-swiping-works">
        <h2 id="how-swiping-works" className="text-xl md:text-2xl">
          How swiping works
        </h2>
        <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
          {howItWorks.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-4 rounded-3xl bg-card p-4 md:flex-col md:gap-3 md:p-5">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl text-ink", howTones[i % howTones.length])}>
                <Icon aria-hidden className="size-5" strokeWidth={2.5} />
              </span>
              <div>
                <p className="font-bold md:text-base">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
