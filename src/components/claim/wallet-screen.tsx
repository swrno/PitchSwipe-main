"use client";

import * as React from "react";
import { Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/ui/mascot";
import { QUALITY } from "@/lib/quality/rules";
import { PAID_RATE_RS } from "@/lib/swipe/validity";
import { AuthProvider, useAuth } from "@/lib/auth/provider";
import { fetchWallet, type Fetcher } from "@/lib/claims/client";
import { WITHDRAW_MIN_RS, withdrawProgress, type WalletView } from "@/lib/claims/rules";
import { getSwiperGuid } from "@/lib/swipe/client";
import { cn, formatRs } from "@/lib/utils";

/** S9: the demo wallet. "Demo earnings", withdraw disabled, no real money moves. */
export function WalletScreen() {
  return (
    <AuthProvider>
      <Wallet />
    </AuthProvider>
  );
}

function Wallet() {
  const { user, loading, authFetch } = useAuth();
  const fetcher = React.useMemo<Fetcher>(() => (user ? authFetch : (input, init) => fetch(input, init)), [user, authFetch]);
  const [wallet, setWallet] = React.useState<WalletView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (loading) return;
    let live = true;
    fetchWallet(fetcher, getSwiperGuid())
      .then((w) => live && setWallet(w))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load your wallet."));
    return () => {
      live = false;
    };
  }, [fetcher, loading]);

  if (error) {
    return (
      <div role="alert" className="rounded-2xl bg-warning-soft p-4 text-warning">
        {error}
      </div>
    );
  }
  if (!wallet) {
    return (
      <div role="status" aria-label="Loading your wallet" className="space-y-4">
        <div className="h-[15.5rem] animate-pulse rounded-3xl bg-lime/80 md:max-w-[52%]" />
        <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-14 animate-pulse rounded-2xl bg-muted" />
        <div className="h-14 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const { fraction, remainingRs } = withdrawProgress(wallet.balanceRs);
  const score = wallet.qualityScore;

  return (
    <div className="space-y-4">
      <h1 className="hidden text-4xl md:block">Wallet</h1>
      <div className="md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-start md:gap-6">
        <div className="rise-children space-y-4">
          <section aria-label="Balance" className="tile relative overflow-hidden bg-lime p-6">
            <Mascot mood="wink" color="var(--cream)" back="var(--coral)" className="absolute -right-1 -top-1 size-20 md:size-24" />
            <p className="text-base font-semibold text-ink/70">
              Balance <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-ink-foreground">{wallet.label}</span>
            </p>
            <p className="stretch-display tnum mt-3 text-6xl font-bold">{formatRs(wallet.balanceRs)}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={WITHDRAW_MIN_RS}
              aria-valuenow={Math.min(WITHDRAW_MIN_RS, wallet.balanceRs)}
              aria-label="Progress to the Rs 100 withdrawal minimum"
              className="mt-5 h-2.5 overflow-hidden rounded-full bg-ink/15"
            >
              <div className="grow-x h-full rounded-full bg-ink" style={{ width: `${Math.round(fraction * 100)}%` }} />
            </div>
            <p className="mt-3 font-medium text-ink/75">
              {remainingRs > 0
                ? `${formatRs(remainingRs)} more to withdraw to UPI`
                : "You have reached the minimum"}
              <span className="hidden md:inline"> (minimum Rs {WITHDRAW_MIN_RS})</span>
            </p>
            {/* Withdraw is a Pitch-only feature: always disabled, no real money moves. */}
            <Button
              disabled
              aria-disabled="true"
              size="lg"
              className="mt-4 h-14 w-full bg-ink/10 text-base text-ink/55 disabled:opacity-100"
            >
              Withdraw from Rs {WITHDRAW_MIN_RS}
            </Button>
          </section>

          <section className="hidden rounded-3xl border border-border p-5 md:block">
            <h2 className="text-xl">How pay works</h2>
            <ul className="mt-3 space-y-3 text-base">
              {[
                `Paid cards are marked on the card: ${formatRs(PAID_RATE_RS)} per valid swipe.`,
                "Valid means you read the card for at least 2 seconds and pass quality checks. It never means answering yes.",
                "Yes and no pay the same.",
                `Your swipes count while your quality score is ${QUALITY.countingScore} or more${
                  score !== undefined ? ` (now ${score})` : ""
                }.`,
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-label="History" className="mt-6 md:mt-0 md:rounded-3xl md:border md:border-border md:p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl md:text-xl">History</h2>
            <span className="hidden text-sm text-muted-foreground md:inline">This week</span>
          </div>
          <ul className="rise-children mt-2 divide-y divide-border">
            {wallet.entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{entry.title}</p>
                  <p className="text-base text-muted-foreground">{entry.detail}</p>
                </div>
                <p className={cn("tnum shrink-0 text-lg font-extrabold", entry.amountRs > 0 ? "text-accent" : "text-muted-foreground")}>
                  {entry.amountRs > 0 ? `+${formatRs(entry.amountRs)}` : "Rs 0"}
                </p>
              </li>
            ))}
            <li className="hidden items-center justify-between gap-4 py-4 md:flex">
              <div>
                <p className="text-lg font-bold">Weekly total</p>
                <p className="text-base text-muted-foreground">{wallet.weeklyValidSwipes} valid swipes on paid cards</p>
              </div>
              <p className="tnum text-lg font-extrabold text-accent">+{formatRs(wallet.weeklyRs)}</p>
            </li>
          </ul>
          {wallet.entries.length === 0 ? <p className="py-6 text-muted-foreground">No swipes yet. Paid swipes show up here.</p> : null}
        </section>
      </div>

      <p className="flex gap-3 rounded-2xl bg-muted p-4 text-base md:hidden">
        <Eye aria-hidden className="mt-1 size-4 shrink-0 text-accent" />A swipe is paid when you read the card for at least 2
        seconds. Yes and no pay the same.
      </p>
      <p className="text-sm text-muted-foreground">Demo earnings for the hackathon. No real money moves.</p>
    </div>
  );
}
