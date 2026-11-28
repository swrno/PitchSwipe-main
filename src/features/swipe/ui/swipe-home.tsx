"use client";

import * as React from "react";
import { Check, Clock, Shuffle } from "lucide-react";
import { WalletPill } from "./wallet-pill";
import { Button } from "@/shared/ui/button";
import { MIN_READ_MS, PAID_RATE_RS } from "@/features/swipe/validity";
import { INDUSTRIES, isIndustry, type Industry } from "@/shared/lib/lists";
import { ArrowChip } from "@/shared/ui/mascot";
import type { WalletView } from "@/features/claims/rules";
import { cn, formatRs } from "@/shared/lib/utils";
import { haptic } from "@/shared/lib/feel/haptics";

/** The "Show me ideas for" choice, kept in this browser so the swiper does not pick again on every visit. */
const INTERESTS_STORAGE_KEY = "ps:swipe-interests";

function readSavedInterests(): Industry[] | null {
  try {
    const raw = window.localStorage.getItem(INTERESTS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is Industry => typeof v === "string" && isIndustry(v)) : null;
  } catch {
    return null;
  }
}

function saveInterests(interests: Industry[]): void {
  try {
    window.localStorage.setItem(INTERESTS_STORAGE_KEY, JSON.stringify(interests));
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

/**
 * Swipe home (designs phone 33, web 32). "Earned today" and "Valid swipes today" are computed from the signed-in swiper's own
 * wallet credits (today, India time); signed out there is no wallet, so no wallet pill and no stat tiles. The "Show me
 * ideas for" chips are sent to the feed as a filter on product industry.
 */
export function SwipeHome({
  onStart,
  starting,
  error,
  wallet = null,
  signedIn = false,
}: {
  onStart: (interests: Industry[]) => void;
  starting: boolean;
  error?: string | null;
  /** The signed-in swiper's own wallet; null while it loads or if it failed. */
  wallet?: WalletView | null;
  /** Wallet pill and stat tiles show only for a signed-in swiper. */
  signedIn?: boolean;
}) {
  const balanceRs = wallet ? wallet.balanceRs : null;
  // null until the swiper picks (now or on an earlier visit). Swipers start with nothing selected, which the feed
  // reads as "all ideas".
  const [chosen, setChosen] = React.useState<Industry[] | null>(null);
  const selected = chosen ?? [];

  // Read the saved choice after mount (the server renders without it).
  React.useEffect(() => {
    const saved = readSavedInterests();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of browser-only state after hydration
    if (saved) setChosen(saved);
  }, []);

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
    const next = selected.includes(industry) ? selected.filter((i) => i !== industry) : [...selected, industry];
    setChosen(next);
    saveInterests(next);
  }

  const statTiles = [
    { label: "Earned today", value: wallet ? formatRs(wallet.todayRs) : "...", className: "" },
    { label: "Valid swipes today", value: wallet ? String(wallet.todayValidSwipes) : "...", className: "" },
    { label: "Wallet balance", value: balanceRs === null ? "..." : formatRs(balanceRs), className: "hidden md:block" },
  ];

  return (
    <div className="rise-children space-y-6">
      <div className="space-y-2">
        {signedIn ? (
          <div className="flex justify-end md:hidden">
            <WalletPill balanceRs={balanceRs} />
          </div>
        ) : null}
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Swipe on new ideas.
          <br />
          <span>Get paid for it.</span>
        </h1>
      </div>

      <section className="space-y-3" aria-labelledby="how-swiping-works">
        <h2 id="how-swiping-works" className="text-lg font-semibold">
          How swiping works
        </h2>
        <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
          {howItWorks.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 md:flex-col md:gap-3">
              <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {signedIn ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {statTiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border border-border bg-card p-4", t.className)}>
              <p className="tnum text-2xl font-semibold">{t.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section aria-labelledby="start-swiping" className="rounded-xl border border-border bg-card p-5">
        <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {formatRs(PAID_RATE_RS)} per paid card
        </span>
        <h2 id="start-swiping" className="mt-3 text-lg font-semibold tracking-tight">
          Ready for the next idea?
        </h2>
        <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">Read the card, answer one question. Yes and no pay the same.</p>

        <p className="mt-6 text-sm font-semibold">Show me ideas for</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Idea categories">
          {INDUSTRIES.map((industry) => {
            const on = selected.includes(industry);
            return (
              <button
                key={industry}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(industry)}
                className={cn(
                  "pressable inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                {industry}
              </button>
            );
          })}
        </div>
        {selected.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No category filter: ideas from every category can show up. Tap a category to narrow it.</p>
        ) : null}

        <Button
          variant="accent"
          size="lg"
          className="mt-5 w-full justify-between pl-7 pr-3 text-base md:w-auto md:min-w-80"
          disabled={starting}
          onClick={() => onStart(selected)}
        >
          {starting ? "Finding an idea..." : "Start swiping"}
          <ArrowChip />
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Answer honestly. There is no right answer.</p>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          {error}
        </p>
      ) : null}

    </div>
  );
}
