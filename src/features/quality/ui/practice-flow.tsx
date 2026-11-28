"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, Target, BarChart3, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/features/auth/ui/provider";
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";
import { PRACTICE_CARD_LABEL, QUALITY, type PracticeCard, type PracticeMode, type SubmittedSwipe } from "@/features/quality";
import { PracticeShell } from "./practice-shell";
import { saveOutcome, type PracticeOutcome } from "./storage";
import { PracticeCardsSkeleton } from "@/shared/ui/page-skeletons";

type Phase = "loading" | "intro" | "playing" | "submitting" | "error";

/** Whole minutes left at ~6 s a card, rounded up to a friendly "about N minutes". */
function minutesLeft(remaining: number): string {
  const minutes = Math.max(1, Math.round((remaining * 6) / 60));
  return `About ${minutes} minute${minutes === 1 ? "" : "s"} left`;
}

export function PracticeFlow({ mode }: { mode: PracticeMode }) {
  const router = useRouter();
  const { configured, loading, user, authFetch } = useAuth();
  const [cards, setCards] = React.useState<PracticeCard[]>([]);
  const [index, setIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const swipes = React.useRef<SubmittedSwipe[]>([]);
  const shownAt = React.useRef(0);
  const busy = React.useRef(false);
  const recheck = mode === "recheck";
  const size = recheck ? QUALITY.recheckCards : QUALITY.practiceCards;

  // Signed-out visitors go to login; unverified ones to verify.
  React.useEffect(() => {
    if (!configured || loading) return;
    if (!user) router.replace("/login");
    else if (!user.emailVerified) router.replace("/verify");
  }, [configured, loading, user, router]);

  const ready = configured && !loading && Boolean(user?.emailVerified);

  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/practice?mode=${mode}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load the practice cards.");
        if (cancelled) return;
        swipes.current = [];
        setIndex(0);
        setCards(data.cards as PracticeCard[]);
        setError(null);
        setPhase("intro");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load the practice cards.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, mode, attempt]);

  // Start the reading-time clock when a card appears.
  React.useEffect(() => {
    if (phase === "playing") shownAt.current = performance.now();
  }, [phase, index]);

  async function submit() {
    setPhase("submitting");
    try {
      const init = { method: "POST", body: JSON.stringify({ mode, swipes: swipes.current }) };
      const res = await authFetch("/api/practice", init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not score your practice.");
      saveOutcome(data as PracticeOutcome);
      router.push("/practice/result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not score your practice.");
      setPhase("error");
    }
  }

  function answer(value: "yes" | "no") {
    if (phase !== "playing" || busy.current) return;
    busy.current = true;
    const card = cards[index];
    swipes.current.push({ cardId: card.id, answer: value, dwellMs: Math.round(performance.now() - shownAt.current) });
    if (index + 1 >= cards.length) {
      void submit().finally(() => {
        busy.current = false;
      });
    } else {
      setIndex(index + 1);
      busy.current = false;
    }
  }

  const done = Math.min(index, size);
  const card = cards[index];
  const showCard = phase === "playing" && card;

  return (
    <PracticeShell tracker={!recheck} backHref={recheck ? "/practice/result" : "/verify"}>
      <div className="rise-children grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="md:rounded-2xl md:border md:border-border md:bg-card md:p-5">
          <p className="mb-2 hidden text-sm font-semibold text-accent md:block">
            {recheck ? "Re-check" : "Step 3 of 3"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl text-4xl md:text-5xl">
            {recheck ? (
              <>
                A quick <span className="underline decoration-accent decoration-4 underline-offset-8">re-check.</span>
              </>
            ) : (
              <>
                A quick <br className="md:hidden" />
                <span className="underline decoration-accent decoration-4 underline-offset-8">quality check.</span>
              </>
            )}
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            {recheck ? (
              <>
                Swipe <strong className="text-foreground">{QUALITY.recheckCards} practice cards</strong> again. Same four
                checks, no wait, and nothing is blocked while you do it.
              </>
            ) : (
              <>
                Before real tests, you swipe <strong className="text-foreground">{QUALITY.practiceCards} practice cards</strong>,
                picked at random from our sample cards. They are practice examples, not real founders&apos; pitches, and nothing you answer here goes to a founder.{" "}
                There is no right answer: we check that you read and answer with care.
              </>
            )}
          </p>

          <div className="mt-6 rounded-2xl bg-muted p-5 md:bg-transparent md:p-0">
            <div className="flex items-baseline justify-between">
              <span className="font-bold">Practice progress</span>
              <span className="text-sm text-muted-foreground md:hidden" />
              <span className="text-3xl font-extrabold md:text-base md:font-semibold">
                {done}
                <span className="text-lg font-semibold text-muted-foreground md:text-base"> / {size}</span>
                <span className="hidden text-sm font-normal text-muted-foreground md:inline">
                  {" "}
                  · {minutesLeft(size - done).toLowerCase()}
                </span>
              </span>
            </div>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={size}
              aria-valuenow={done}
              aria-label="Practice progress"
            >
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / size) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground md:hidden">{minutesLeft(size - done)}</p>
            <p className="mt-3 hidden text-sm text-muted-foreground md:block">
              After {size} cards you go to the real feed either way. Your score decides whether your swipes count.
            </p>
          </div>

          {showCard && (
            <article
              key={card.id + index}
              className="mt-6 rounded-xl border border-border bg-card p-5"
              aria-live="polite"
            >
              <span className="inline-block rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {PRACTICE_CARD_LABEL}
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                {card.brand} · {card.category}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight md:text-2xl">{card.headline}</h2>
              <p className="mt-2 text-muted-foreground">{card.detail}</p>
              <p className="mt-5 font-bold">{card.question}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button variant="outline" size="lg" onClick={() => answer("no")}>
                  {card.noLabel}
                </Button>
                <Button size="lg" onClick={() => answer("yes")}>
                  {card.yesLabel}
                </Button>
              </div>
            </article>
          )}

          {!configured && (
            <p role="alert" className="mt-6 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
              {NOT_CONFIGURED_MESSAGE}
            </p>
          )}
          {configured && phase === "loading" && <PracticeCardsSkeleton />}
          {phase === "submitting" && <p className="mt-6 font-semibold">Scoring your swipes...</p>}
          {phase === "error" && (
            <div role="alert" className="mt-6 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                  setPhase("loading");
                  setAttempt((n) => n + 1);
                }}>
                Start again
              </Button>
            </div>
          )}

          {phase === "intro" && (
            <div className="mt-8 hidden md:block">
              <Button size="lg" onClick={() => setPhase("playing")}>
                {recheck ? "Start re-check" : "Start practice"} <ArrowRight />
              </Button>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:order-none">
          <Note icon={<Eye className="size-5" />} title="Read each card" body="Answers under 2 seconds do not count." />
          <Note
            icon={<Target className="size-5" />}
            title="Answer honestly"
            body="Yes and no are both fine. Random or same-every-time answers lower your score."
          />
          <Note
            icon={<BarChart3 className="size-5 md:hidden" />}
            webIcon={<Sparkles className="hidden size-5 md:block" />}
            title="We score your swipes"
            body={`Four simple checks: reading time, not always the same answer, the same answer when a card repeats, and check cards. Score ${QUALITY.countingScore} or more and your swipes count.${
              recheck ? "" : ` Below ${QUALITY.countingScore} you can still swipe, and can re-check with ${QUALITY.recheckCards} cards at any time.`
            }`}
          />
          <Note
            className="hidden md:flex"
            icon={<Wallet className="size-5" />}
            title="Practice is not paid"
            body="Paid cards (Rs 0.25 per valid swipe) pay once your swipes count."
          />
        </aside>

        {/* Phone (design 30): the rules note, then the button pinned under it. */}
        <div className="md:hidden">
          <p className="text-sm text-muted-foreground">
            After {size} cards you go to the real feed either way. Below {QUALITY.countingScore} you can still swipe, but
            your swipes are not counted or paid until your score reaches {QUALITY.countingScore}.
          </p>
          {phase === "intro" && (
            <Button size="lg" className="mt-6 w-full" onClick={() => setPhase("playing")}>
              {recheck ? "Start re-check" : "Start practice"} <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </PracticeShell>
  );
}

function Note({
  icon,
  webIcon,
  title,
  body,
  className = "",
}: {
  icon: React.ReactNode;
  webIcon?: React.ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-3 md:rounded-2xl md:border md:border-border md:bg-card md:p-5 ${className}`}>
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-accent md:size-auto md:bg-transparent">
        {icon}
        {webIcon}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
