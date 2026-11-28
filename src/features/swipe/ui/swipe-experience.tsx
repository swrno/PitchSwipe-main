"use client";

import { IconTile } from "@/shared/ui/icon";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronLeft, Heart, RotateCcw, X } from "lucide-react";
import { haptic } from "@/shared/lib/feel/haptics";
import { SPRING_SNAPPY } from "@/shared/lib/feel/motion";
import { announceBalance } from "@/shared/lib/feel/wallet-events";
import { Button } from "@/shared/ui/button";
import { AuthProvider, useAuth } from "@/features/auth/ui/provider";
import type { Industry } from "@/shared/lib/lists";
import { fetchNextCard, getSwiperGuid, sendAnswer, type Fetcher } from "@/features/swipe/ui/client";
import type { CardView, SubmitSuccess } from "@/features/swipe/types";
import { ANSWER_LOCK_MS } from "@/features/swipe/validity";
import { cn, formatRs } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/shell/brand-mark";
import { WalletPill, useWallet, type WalletBump } from "./wallet-pill";
import { AnswerButtons, KeyHints } from "./answer-bar";
import { AnswerReceiptStrip, type AnswerReceipt } from "./answer-handoff";
import { DeckCard, LangFont, ProductTile, ACCENT_VAR, scriptStyle } from "./deck-card";
import { SwipeHome } from "./swipe-home";
import { creditWalletRequest } from "@/features/claims/ui/client";
import { qualityCheckEnabled } from "@/features/quality/switch";
import { Skeleton, SkeletonText } from "@/shared/ui/skeleton";

type Phase = "home" | "loading" | "card" | "saving" | "empty";

const SWIPE_DISTANCE = 110;

export interface SwipeExperienceProps {
  /** "feed": home screen first. "link": opens straight on the link deck (`firstSlug`). */
  mode: "feed" | "link";
  firstSlug?: string;
}

/** Wrapped in AuthProvider so signed-in swipers send their Firebase token (role, quality flag live in Mongo). */
export function SwipeExperience(props: SwipeExperienceProps) {
  return (
    <AuthProvider>
      <Experience {...props} />
    </AuthProvider>
  );
}


function splitQuestion(question: string): [string, string | null] {
  const words = question.trim().split(/\s+/);
  if (words.length < 4) return [question.trim(), null];
  const cut = Math.floor(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

function Experience({ mode, firstSlug }: SwipeExperienceProps) {
  const { user, authFetch, loading: authLoading } = useAuth();
  const fetcher = React.useMemo<Fetcher>(
    () => (user ? authFetch : (input, init) => fetch(input, init)),
    [user, authFetch],
  );

  const [phase, setPhase] = React.useState<Phase>(mode === "link" ? "loading" : "home");
  const [card, setCard] = React.useState<CardView | null>(null);
  const [locked, setLocked] = React.useState(true);
  const [receipt, setReceipt] = React.useState<AnswerReceipt | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [exitDir, setExitDir] = React.useState<1 | -1>(1);
  const receiptCount = React.useRef(0);
  // The balance the server returned with the last credit, shown until a newer wallet read replaces it.
  const [walletLive, setWalletLive] = React.useState<{ balanceRs: number; after: unknown } | null>(null);
  const [bump, setBump] = React.useState<WalletBump | null>(null);
  // How far the top card is on its way out (0..1): the cards behind it rise as it goes.
  const dragProgress = useMotionValue(0);
  const dismissReceipt = React.useCallback(() => setReceipt(null), []);

  // The signed-in swiper's own wallet: re-read when a card is on screen or the home screen shows (after each answer's
  // credit). Signed out there is no wallet and none is read or shown.
  const signedIn = Boolean(user);
  const wallet = useWallet(fetcher, phase === "card" || phase === "home" ? `${phase}:${card?.cardId ?? ""}` : "busy", signedIn);
  const walletRef = React.useRef(wallet);
  React.useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);
  const balanceRs =
    walletLive && walletLive.after === wallet ? walletLive.balanceRs : wallet ? wallet.balanceRs : (walletLive?.balanceRs ?? null);

  const token = React.useRef<string | undefined>(undefined);
  const shownAt = React.useRef(0);
  const seen = React.useRef<string[]>([]);
  const pendingLink = React.useRef<string | undefined>(mode === "link" ? firstSlug : undefined);
  const interests = React.useRef<Industry[]>([]);
  const started = React.useRef(false);

  // Who the shown card was served to (uid, or null for a guest). Its token only verifies for that same swiper.
  const loadedAs = React.useRef<string | null | undefined>(undefined);
  const load = React.useCallback(async () => {
    loadedAs.current = user?.uid ?? null;
    setPhase("loading");
    setLoadError(null);
    try {
      const res = await fetchNextCard(fetcher, {
        swiperGuid: getSwiperGuid(),
        firstSlug: pendingLink.current,
        interests: interests.current,
        seen: seen.current,
      });
      token.current = res.token;
      if (!res.card) {
        pendingLink.current = undefined;
        setCard(null);
        setPhase("empty");
        return;
      }
      if (res.card.source !== "link") pendingLink.current = undefined;
      setCard(res.card);
      setLocked(true);
      setPhase("card");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the next idea.");
      setPhase(mode === "link" ? "empty" : "home");
    }
  }, [fetcher, mode, user?.uid]);

  // Signed in or out while a card is on screen: its token belongs to the old identity, so fetch a fresh card.
  React.useEffect(() => {
    if (authLoading || phase !== "card" || loadedAs.current === undefined) return;
    if (loadedAs.current !== (user?.uid ?? null)) void load();
  }, [authLoading, phase, user?.uid, load]);

  // A personal link opens straight on its deck, but only once sign-in has settled: the served token is bound to the
  // swiper (guest or signed-in). Loading as a guest and answering signed in would make the answer "no longer valid".
  React.useEffect(() => {
    if (mode === "link" && !started.current && !authLoading) {
      started.current = true;
      void load();
    }
  }, [mode, load, authLoading]);

  // The card is on screen: start the dwell clock and the 2 s answer lock.
  React.useEffect(() => {
    if (phase !== "card" || !card) return;
    shownAt.current = performance.now(); // locked is already true (set when the card loaded)
    const timer = window.setTimeout(() => setLocked(false), ANSWER_LOCK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, card]);

  const answer = React.useCallback(
    async (choice: "positive" | "negative", options?: { claim?: boolean }) => {
      if (phase !== "card" || !card || locked || sheetOpen) return;
      const answered = card;
      const swiperGuid = getSwiperGuid();
      // One commit tap for every way of answering (button, drag, arrow key), and only for real answers.
      haptic("commit");
      setExitDir(choice === "positive" ? 1 : -1);
      setPhase("saving");
      setReceipt(null);
      seen.current = [...seen.current, answered.deckId];
      let result: SubmitSuccess | null = null;
      let error: string | null = null;
      try {
        const outcome = await sendAnswer(fetcher, {
          swiperGuid,
          deckId: answered.deckId,
          cardId: answered.cardId,
          answer: choice,
          token: token.current ?? "",
        });
        if (outcome.kind === "saved") result = outcome.result;
      } catch (e) {
        error = e instanceof Error ? e.message : "Could not save your answer.";
      }
      // Credit the wallet once per stored answer (the server decides the amount and ignores repeats), before
      // the next card loads, so the wallet pill re-reads the new balance with it.
      if (result) {
        const credited = await creditWalletRequest(fetcher, { swiperGuid, responseId: result.responseId, token: result.servedToken });
        if (credited) {
          setWalletLive({ balanceRs: credited.balanceRs, after: walletRef.current });
          announceBalance(credited.balanceRs);
          if (credited.earnedRs > 0) setBump({ id: receiptCount.current + 1, earnedRs: credited.earnedRs });
        }
      }
      receiptCount.current += 1;
      setReceipt({ id: receiptCount.current, card: answered, result, error, openClaim: options?.claim === true });
      // No pop-up between cards: the next idea comes straight away; the strip offers claim and comment.
      await load();
    },
    [phase, card, locked, sheetOpen, fetcher, load],
  );

  // Arrow keys answer on the web layout.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      void answer(event.key === "ArrowRight" ? "positive" : "negative");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  function start(chosen: Industry[]) {
    interests.current = chosen;
    void load();
  }

  if (phase === "home") {
    return <SwipeHome onStart={start} starting={false} error={loadError} wallet={wallet} signedIn={signedIn} />;
  }

  const strip = (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+0.75rem)] z-40 flex justify-center px-3 md:bottom-6 md:pl-[var(--sidebar-width)] md:pr-[var(--chat-width,0px)]">
      <AnimatePresence>
        {receipt ? (
          <AnswerReceiptStrip key={receipt.id} receipt={receipt} onDismiss={dismissReceipt} onSheetChange={setSheetOpen} />
        ) : null}
      </AnimatePresence>
    </div>
  );

  if ((phase === "loading" || phase === "saving") && !card) {
    return (
      <div className="mx-auto max-w-md pt-2" role="status" aria-label="Finding an idea">
        <span className="sr-only">Finding an idea…</span>
        <CardSkeleton />
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <>
      {strip}
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <IconTile icon={loadError ? AlertTriangle : CheckCircle2} className="mx-auto" />
        <h1 className="text-3xl">{loadError ? "Something went wrong." : "That is every idea for now."}</h1>
        <p className="text-muted-foreground">
          {loadError ?? "You have seen every live idea. New ones arrive as founders publish them."}
        </p>
        <div className="flex flex-col items-center gap-3 pt-2">
          {loadError ? (
            <Button onClick={() => void load()}>
              <RotateCcw /> Try again
            </Button>
          ) : null}
          <Link href="/products" className="text-sm font-semibold underline underline-offset-4">
            Test your own idea
          </Link>
          {mode === "feed" ? (
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => setPhase("home")}>
              Back to swipe home
            </button>
          ) : null}
        </div>
      </div>
      </>
    );
  }

  if (!card) return null;

  const [q1, q2] = splitQuestion(card.question);
  const accent = ACCENT_VAR[card.product.accent];
  const showing = phase === "card";
  const interactive = showing && !locked && !sheetOpen;

  return (
    <div
      data-hide-brand-bar
      aria-busy={!showing}
      className="-mb-[1.625rem] md:mb-0 md:mx-auto md:grid md:min-h-[calc(100dvh-var(--tabbar-height)-8rem)] md:max-w-5xl md:grid-cols-[minmax(0,1fr)_30rem] md:items-center md:gap-16"
    >
      {strip}
      {/* Web: founder line, the big question and the key hints. Faded while the next idea loads. */}
      <aside className={cn("hidden transition-opacity duration-200 md:block", !showing && "opacity-30")} lang={card.lang}>
        <LangFont lang={card.lang} />
        <div className="flex items-center gap-3 text-base">
          <ProductTile card={card} className="md:size-11 md:rounded-lg" />
          <span>
            <span className="font-bold">{card.ownerName ?? "A founder"}</span> wants your honest take on one idea.
          </span>
        </div>
        <h1 style={scriptStyle(card.lang)} className="mt-8 text-4xl xl:text-5xl 2xl:text-6xl">
          {q2 ? <span className="block">{q1}</span> : null}
          <span
            className="inline-block pb-1.5"
            style={{
              backgroundImage: `linear-gradient(${accent}, ${accent})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 5px",
              backgroundPosition: "0 100%",
            }}
          >
            {q2 ?? q1}
          </span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground" lang="en">
          {card.source === "link"
            ? "Read the card and decide. Your answer goes straight to the founder who shared this link. Link answers are not verified or paid."
            : card.paid
              ? `Read the card and decide. This is a paid card: you earn ${formatRs(card.paidRs)} if you read it for at least 2 seconds, whichever answer you pick.`
              : "Read the card and decide. This is an unpaid card: just your honest take."}
        </p>
        <KeyHints card={card} />
      </aside>

      <div className="mx-auto w-full max-w-md md:max-w-none">
        {/* Phone: back, logo and wallet in one row (design phone 34); the shell's own brand bar is hidden here. */}
        <div className="-mt-2.5 mb-2.5 flex items-center gap-3 md:hidden">
          {mode === "feed" ? (
            <button
              type="button"
              onClick={() => setPhase("home")}
              aria-label="Back to swipe home"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
          ) : null}
          <span className="flex min-w-0 items-center gap-2">
            <BrandMark className="size-8" />
            <span className="truncate text-xl font-extrabold tracking-tight">PitchSwipe</span>
          </span>
          {signedIn ? <WalletPill balanceRs={balanceRs} accentColor={accent} bump={bump} className="ml-auto" /> : null}
        </div>

        <div className="relative">
          <StackPeeks progress={dragProgress} />
          {/* The answered card flies off while the loading card takes its place (popLayout lifts the leaving card out of the flow). */}
          <AnimatePresence custom={exitDir} mode="popLayout" initial={false}>
            {showing ? (
              <DraggableCard
                key={card.cardId}
                card={card}
                enabled={interactive}
                dir={exitDir}
                progress={dragProgress}
                onSwipe={(c) => void answer(c)}
                // The reward on the card is a yes that goes straight to the claim.
                onReward={() => void answer("positive", { claim: true })}
              />
            ) : (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                <CardSkeleton />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={cn("mt-2 transition-opacity duration-200 md:hidden", !showing && "opacity-0")}>
          <Banner card={card} />
        </div>
        {/* Phone: the question and the answer bar stay visible above the tab bar on short screens. */}
        <div className="sticky bottom-[var(--tabbar-height)] z-20 -mx-4 mt-1 bg-background/95 px-4 pb-0 pt-2 backdrop-blur md:static md:mx-0 md:mt-8 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <p
            className={cn("text-center text-[1.0625rem] font-extrabold leading-tight tracking-tight transition-opacity duration-200 md:hidden", !showing && "opacity-0")}
            style={scriptStyle(card.lang)}
            lang={card.lang}
          >
            {card.question}
          </p>
          <div className="mt-2 md:mt-0">
            <AnswerButtons card={card} locked={!interactive} onAnswer={(c) => void answer(c)} />
          </div>
        </div>
        <div className="mt-4 hidden md:block">
          <Banner card={card} />
        </div>
      </div>
    </div>
  );
}

/** Same footprint as a pitch card, so nothing jumps when the next idea arrives. */
function CardSkeleton() {
  return (
    <div aria-hidden className="rounded-3xl border border-border bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-4">
        <Skeleton className="size-[60px] rounded-2xl md:size-14" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5 rounded-full" />
          <Skeleton className="h-3.5 w-3/5 rounded-full" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <Skeleton className="h-7 w-11/12 rounded-lg" />
        <Skeleton className="h-7 w-3/5 rounded-lg" />
      </div>
      <SkeletonText lines={2} className="mt-4" lineClassName="rounded-full" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="aspect-[164/240] rounded-xl" />
        <Skeleton className="aspect-[164/240] rounded-xl" />
        <Skeleton className="aspect-[164/240] rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-11 rounded-xl" />
    </div>
  );
}

/** The edges of the next cards peeking above the top card (phone). They rise as the top card goes. */
function StackPeeks({ progress }: { progress: MotionValue<number> }) {
  const p = useSpring(progress, { stiffness: 400, damping: 36 });
  const backY = useTransform(p, [0, 1], [0, 4]);
  const backInset = useTransform(p, [0, 1], ["1.25rem", "0.75rem"]);
  const frontY = useTransform(p, [0, 1], [0, 4]);
  const frontInset = useTransform(p, [0, 1], ["0.75rem", "0rem"]);
  return (
    <>
      <motion.div
        aria-hidden
        style={{ y: backY, left: backInset, right: backInset }}
        className="absolute -top-2 h-4 rounded-t-3xl border border-border bg-card md:hidden"
      />
      <motion.div
        aria-hidden
        style={{ y: frontY, left: frontInset, right: frontInset }}
        className="absolute -top-1 h-4 rounded-t-3xl border border-border bg-card md:hidden"
      />
    </>
  );
}

function DraggableCard({
  card,
  enabled,
  dir,
  progress,
  onSwipe,
  onReward,
  ref,
}: {
  card: CardView;
  enabled: boolean;
  dir: 1 | -1;
  /** Written with how far this card is on its way out (0..1), for the stack behind it. */
  progress: MotionValue<number>;
  onSwipe: (answer: "positive" | "negative") => void;
  onReward: () => void;
  /** AnimatePresence "popLayout" measures the leaving card through this ref. */
  ref?: React.Ref<HTMLDivElement>;
}) {
  const reduce = useReducedMotion();
  const accent = ACCENT_VAR[card.product.accent];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-9, 0, 9]);
  // Stamps: the heart (in the product's colour) grows in on a drag right, the cross (neutral: both answers
  // pay the same, so no is not "bad") on a drag left. Icons, not words, so a Hindi card reads the same.
  const yesOpacity = useTransform(x, [16, SWIPE_DISTANCE], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_DISTANCE, -16], [1, 0]);
  const yesScale = useTransform(x, [16, SWIPE_DISTANCE], [0.6, 1]);
  const noScale = useTransform(x, [-SWIPE_DISTANCE, -16], [1, 0.6]);

  // Drag-only feedback: the exit animation also moves x past the commit point on taps and arrow keys.
  const dragging = React.useRef(false);
  const past = React.useRef(false);

  // A new top card starts the stack at rest.
  React.useEffect(() => {
    progress.set(0);
  }, [progress]);

  useMotionValueEvent(x, "change", (v) => {
    progress.set(Math.min(1, Math.abs(v) / SWIPE_DISTANCE));
    if (!dragging.current) return;
    const nowPast = Math.abs(v) > SWIPE_DISTANCE;
    if (nowPast !== past.current) {
      past.current = nowPast;
      if (nowPast) haptic("select");
    }
  });

  return (
    <motion.div
      ref={ref}
      style={{ x, rotate }}
      drag={enabled ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.5}
      onDragStart={() => {
        dragging.current = true;
        past.current = false;
      }}
      onDragEnd={(_, info) => {
        dragging.current = false;
        if (Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > 700) {
          onSwipe(info.offset.x > 0 ? "positive" : "negative");
        }
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0.15 } : SPRING_SNAPPY }}
      custom={dir}
      variants={{
        exit: (d: number) =>
          reduce
            ? { opacity: 0, transition: { duration: 0.15 } }
            : { x: d * 440, rotate: d * 14, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
      }}
      exit="exit"
      className="relative touch-pan-y"
    >
      <DeckCard card={card} onReward={onReward} rewardLocked={!enabled} />
      <motion.span
        aria-hidden
        style={{ opacity: yesOpacity, scale: yesScale, backgroundColor: accent }}
        className="pointer-events-none absolute left-1/2 top-1/2 -ml-9 -mt-9 flex size-[72px] items-center justify-center rounded-full text-accent-foreground shadow-xl"
      >
        <Heart className="size-9 fill-current" />
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: noOpacity, scale: noScale }}
        className="pointer-events-none absolute left-1/2 top-1/2 -ml-9 -mt-9 flex size-[72px] items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xl"
      >
        <X className="size-9" strokeWidth={2.5} />
      </motion.span>
    </motion.div>
  );
}

/** Paid / unpaid / link banner under the card (designs phone 34 and 40). */
function Banner({ card }: { card: CardView }) {
  if (card.source === "link") {
    return (
      <div className="rounded-xl bg-muted px-3 py-2 text-center text-[0.8125rem] leading-snug text-muted-foreground md:px-4 md:py-3 md:text-base md:leading-normal" lang="en">
        <span className="font-bold text-foreground">Your link (not verified).</span> Not paid, answers go to the founder.
      </div>
    );
  }
  return (
    <div className="space-y-2" lang="en">
      {card.paid ? (
        <div className="rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-center text-[0.8125rem] leading-snug text-foreground md:px-4 md:py-3 md:text-base md:leading-normal">
          <span className="font-bold text-accent">Paid card: {formatRs(card.paidRs)}</span> per valid swipe. Yes or no pays
          the same.
        </div>
      ) : (
        <div className="rounded-xl bg-muted px-3 py-2 text-center text-[0.8125rem] leading-snug text-muted-foreground md:px-4 md:py-3 md:text-base md:leading-normal">
          <span className="font-bold">Unpaid card.</span> Just your honest take.
        </div>
      )}
      {!card.counting ? (
        qualityCheckEnabled() ? (
          <p className="text-center text-[0.8125rem] leading-snug text-warning md:text-sm">
            Not counted yet: your quality score is below 70.{" "}
            <Link href="/practice" className="whitespace-nowrap font-semibold underline underline-offset-4">
              Re-check now
            </Link>
          </p>
        ) : (
          <p className="text-center text-[0.8125rem] leading-snug text-warning md:text-sm">
            Not counted yet: sign in so your swipes count.{" "}
            <Link href="/login?next=/swipe" className="whitespace-nowrap font-semibold underline underline-offset-4">
              Sign in
            </Link>
          </p>
        )
      ) : null}
    </div>
  );
}
