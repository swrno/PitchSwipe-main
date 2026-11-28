"use client";

import { IconLabel } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { RotateCcw, Lock, Timer, MessageCircle, IndianRupee } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { QUALITY } from "@/features/quality/rules";
import { PAID_RATE_RS } from "@/features/swipe/validity";
import { useAuth } from "@/features/auth/ui/provider";
import { fetchWallet, type Fetcher } from "@/features/claims/ui/client";
import { WITHDRAW_MIN_RS, withdrawProgress, type WalletView } from "@/features/claims/rules";
import { getSwiperGuid } from "@/features/swipe/ui/client";
import { formatRs } from "@/shared/lib/utils";

/** S9: the wallet of the signed-in swiper (the page gates sign-in). Withdraw is disabled: payouts are not live yet. */
export function WalletScreen() {
  const { loading, authFetch } = useAuth();
  const fetcher: Fetcher = authFetch;
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
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft p-4 text-sm text-warning">
        <span>{error}</span>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warning px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RotateCcw className="size-4" aria-hidden /> Try again
        </button>
      </div>
    );
  }
  if (!wallet) {
    return (
      <div role="status" aria-label="Loading your wallet" className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
        <div className="h-60 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const { fraction, remainingRs } = withdrawProgress(wallet.balanceRs);
  const score = wallet.qualityScore;

  const kpis = [
    { label: "Earned today", value: formatRs(wallet.todayRs) },
    { label: "This week", value: formatRs(wallet.weeklyRs) },
    { label: "Valid swipes this week", value: String(wallet.weeklyValidSwipes) },
    ...(score !== undefined ? [{ label: "Quality score", value: String(score) }] : []),
  ];

  const steps = [
    { Icon: Timer, title: "Read for 2+ seconds", line: "Give each card a real look before you answer." },
    { Icon: MessageCircle, title: "Answer honestly", line: "Yes and no pay the same." },
    { Icon: IndianRupee, title: `${formatRs(PAID_RATE_RS)} on paid cards`, line: `Counts while your quality score is ${QUALITY.countingScore}+.` },
  ];

  // Entry detail reads "1 valid swipe · today"; the part after the dot is the day label.
  const groups: { day: string; rows: { entry: (typeof wallet.entries)[number]; paid: boolean }[] }[] = [];
  for (const entry of wallet.entries.slice(0, 8)) {
    const raw = entry.detail.split("·").pop()?.trim() ?? "";
    const day = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Recent";
    let g = groups.find((x) => x.day === day);
    if (!g) groups.push((g = { day, rows: [] }));
    g.rows.push({ entry, paid: entry.amountRs > 0 });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          <section aria-label="Balance" className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Balance</p>
            <p className="tnum mt-2 text-4xl font-semibold">{formatRs(wallet.balanceRs)}</p>
            <div className="mt-6">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={WITHDRAW_MIN_RS}
                aria-valuenow={Math.min(WITHDRAW_MIN_RS, wallet.balanceRs)}
                aria-label="Progress to the Rs 100 withdrawal minimum"
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="grow-x h-full rounded-full bg-accent" style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
              <div className="tnum mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Rs 0</span>
                <span>Rs {WITHDRAW_MIN_RS}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {remainingRs > 0
                  ? `${formatRs(remainingRs)} more to reach the Rs ${WITHDRAW_MIN_RS} minimum`
                  : `You have reached the Rs ${WITHDRAW_MIN_RS} minimum`}
              </p>
            </div>
            {/* Payouts are not live yet: withdraw is always disabled; Swipe is the one primary action. */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href="/swipe" className={buttonVariants({ variant: "accent", size: "lg" })}>
                Keep swiping
              </Link>
              <Button disabled aria-disabled="true" title="Payouts are not live yet" variant="outline" size="lg" className="gap-2">
                <Lock aria-hidden className="size-4" />
                Withdraw: coming soon
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Payouts are coming soon. Your balance is tracked until they go live.</p>
          </section>

          <section aria-label="Earnings summary">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-card p-4">
                  <dd className="tnum order-1 text-xl font-semibold">{k.value}</dd>
                  <dt className="mt-1 text-xs text-muted-foreground">{k.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section aria-label="How you earn" className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold"><IconLabel icon="earnsMost">How you earn</IconLabel></h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {steps.map(({ Icon, title, line }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon aria-hidden className="size-4 text-accent" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{line}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section aria-label="Recent activity" className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:col-span-4">
          <h2 className="text-lg font-semibold"><IconLabel icon="history">Recent activity</IconLabel></h2>
          {groups.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <Link href="/swipe" className="mt-1 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-accent underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                Start swiping
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {groups.map((g) => (
                <div key={g.day}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.day}</p>
                  <ul className="mt-1 divide-y divide-border">
                    {g.rows.map(({ entry, paid }) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {paid ? "Paid card" : "Unpaid card"} · {g.day.toLowerCase() === "today" || g.day.toLowerCase() === "yesterday" ? g.day.toLowerCase() : g.day}
                          </p>
                        </div>
                        <p className={paid ? "tnum shrink-0 text-sm font-semibold" : "shrink-0 text-sm text-muted-foreground"}>
                          {paid ? `+${formatRs(entry.amountRs)}` : "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <Link href="/history" className="flex min-h-11 items-center border-t border-border pt-3 text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                View full history →
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
