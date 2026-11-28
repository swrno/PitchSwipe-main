"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/features/auth/ui/provider";
import { QUALITY, type QualityMetrics } from "@/features/quality";
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { PracticeShell } from "./practice-shell";
import { ScoreRing } from "./score-ring";
import { loadOutcome, type PracticeOutcome } from "./storage";

/** What the screen needs. `metrics` is missing when we only have the saved score (a later visit). */
type View = {
  score: number;
  counting: boolean;
  reasons: string[];
  metrics?: QualityMetrics;
  size: number;
  recheck: boolean;
};

function fromOutcome(o: PracticeOutcome): View {
  return {
    score: o.score,
    counting: o.counting,
    reasons: o.reasons,
    metrics: o.metrics,
    size: o.metrics.total,
    recheck: o.mode === "recheck",
  };
}

export function ResultView() {
  const router = useRouter();
  const { configured, loading, user, authFetch } = useAuth();
  const [view, setView] = React.useState<View | null>(null);
  const [unavailable, setUnavailable] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const stored = loadOutcome();
      if (stored) {
        setView(fromOutcome(stored));
        return;
      }
      if (!configured) {
        setUnavailable(true);
        return;
      }
      if (loading) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const res = await authFetch("/api/practice/status");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        if (!data.checked) router.replace("/practice");
        else
          setView({
            score: data.score,
            counting: data.counting,
            reasons: data.reasons ?? [],
            size: QUALITY.practiceCards,
            recheck: false,
          });
      } catch {
        if (!cancelled) router.replace("/practice");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [configured, loading, user, authFetch, router]);

  return (
    <PracticeShell>
      {unavailable ? (
        <p role="status" className="py-20 text-center text-muted-foreground">
          Your quality result is not available yet. {NOT_CONFIGURED_MESSAGE}
        </p>
      ) : !view ? (
        <p className="py-20 text-center text-muted-foreground">Loading your result...</p>
      ) : (
        <Result view={view} />
      )}
    </PracticeShell>
  );
}

function Result({ view }: { view: View }) {
  const { score, counting, metrics } = view;
  const [reviewAsked, setReviewAsked] = React.useState(false);

  const rows: [string, string][] = metrics
    ? [
        ["Practice cards swiped", `${metrics.total} / ${view.size}`],
        ["Read for 2+ seconds", `${metrics.readPct}%`],
        ["Same answer on repeat cards", metrics.repeats.samePct === null ? "n/a" : `${metrics.repeats.samePct}%`],
        ["Check cards passed", `${metrics.checks.total - metrics.checks.missed} / ${metrics.checks.total}`],
      ]
    : [];

  const lowered: [string, string][] = metrics
    ? [
        ...(metrics.fastCount > 0
          ? ([["Too fast: under 2 seconds", `${metrics.fastCount} of ${metrics.total} cards`]] as [string, string][])
          : []),
        ...(metrics.repeats.differing > 0
          ? ([["Different answers on a repeated card", `${metrics.repeats.differing} of ${metrics.repeats.total}`]] as [
              string,
              string,
            ][])
          : []),
        ...(metrics.checks.missed > 0
          ? ([["Check cards missed", `${metrics.checks.missed} of ${metrics.checks.total}`]] as [string, string][])
          : []),
        ...(metrics.straight.flagged ? ([["Always the same answer", "Yes"]] as [string, string][]) : []),
      ]
    : view.reasons.map((r) => [r, ""] as [string, string]);

  const rechargeLabel = `Re-check now: ${QUALITY.recheckCards} cards`;

  return (
    <div className="rise-children mx-auto max-w-xl md:rounded-2xl md:border md:border-border md:bg-card md:p-5">
      {/* Phone: ring on top, centred. Web: ring beside "Quality score. You need 70." */}
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium md:order-first",
            counting ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning md:bg-secondary md:text-muted-foreground",
          )}
        >
          {counting ? "Swipes counting" : "Not counted yet"}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl mt-4 md:text-4xl">
          {counting ? (
            <>
              <span className="md:hidden">You are in.</span>
              <span className="hidden md:inline">Your swipes count.</span>
            </>
          ) : (
            "Almost there."
          )}
        </h1>
        <div className="mb-5 flex flex-col items-center gap-4 max-md:order-first md:mt-6 md:mb-0 md:flex-row md:gap-5">
          <ScoreRing score={score} counting={counting} />
          <p className="hidden text-sm text-muted-foreground md:block">
            Quality score. You need <strong className="text-foreground">{QUALITY.countingScore}</strong>.
          </p>
        </div>
        <p className="mt-6 text-muted-foreground">
          {counting ? (
            <>
              <span className="md:hidden">
                Your quality score is {score}; you need {QUALITY.countingScore}. Your swipes now count in founders&apos;
                results, and paid cards pay you Rs 0.25 per valid swipe.{" "}
              </span>
              <span className="hidden md:inline">
                Founders now see your swipes, and paid cards pay Rs 0.25 per valid swipe.{" "}
              </span>
              About 1 in 20 feed cards is a check card, so your score keeps updating.
            </>
          ) : (
            <>
              <span className="md:hidden">Your score is {score}; you need {QUALITY.countingScore}. </span>
              You can keep swiping, but your swipes are not counted in results or paid
              <span className="hidden md:inline"> until you reach {QUALITY.countingScore}</span>
              <span className="md:hidden"> yet</span>. Nothing else is blocked.
            </>
          )}
        </p>
      </div>

      {!counting && lowered.length > 0 && (
        <section className="mt-6 md:hidden" aria-label="What lowered your score">
          <h2 className="text-lg font-semibold tracking-tight font-bold">What lowered your score</h2>
          <dl className="mt-1 divide-y divide-border border-t border-border">
            {lowered.map(([label, value]) => (
              <Row key={label} label={label} value={value} tone="warning" />
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Tip: read each card before you answer. Yes and no both count the same.
          </p>
        </section>
      )}

      {rows.length > 0 && (
        <dl
          className={cn(
            "mt-6 divide-y divide-border border-y border-border",
            !counting && "hidden md:block",
          )}
        >
          {rows.map(([label, value]) => (
            <Row key={label} label={label} value={value} tone={counting ? "good" : undefined} />
          ))}
        </dl>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {counting ? (
          <>
            <Link href="/swipe" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              Start swiping <ArrowRight />
            </Link>
            <Link
              href="/practice?mode=recheck"
              className="text-center text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {rechargeLabel} (any time)
            </Link>
          </>
        ) : (
          <>
            <Link href="/practice?mode=recheck" className={cn(buttonVariants({ size: "lg" }), "w-full md:bg-background md:text-foreground md:border md:border-border md:hover:bg-muted")}>
              {rechargeLabel}
            </Link>
            <Link href="/swipe" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
              Keep swiping (not counted)
            </Link>
            {reviewAsked ? (
              <p role="status" className="text-center text-sm text-muted-foreground">
                Thanks. Review requests are not available yet, so nothing was sent.
              </p>
            ) : view.recheck ? (
              <Button variant="ghost" className="h-auto whitespace-normal py-1 text-sm underline underline-offset-4" onClick={() => setReviewAsked(true)}>
                Re-checked and still think it is wrong? Ask a person to review
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Re-checked and still think it is wrong? You can ask a person to review after a re-check.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warning" | "good" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted-foreground md:text-foreground">{label}</dt>
      <dd
        className={cn(
          "shrink-0 font-bold",
          tone === "warning" ? "text-warning" : tone === "good" ? "text-accent md:text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
