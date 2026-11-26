"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Heart, X } from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/feel/haptics";
import { cn } from "@/lib/utils";
import { ANSWER_LOCK_MS } from "@/lib/swipe/validity";
import type { CardView } from "@/lib/swipe/types";
import { ACCENT_VAR } from "./deck-card";

/** The two round answer buttons. Locked (disabled) for the first 2 s so nobody answers without reading. */
export function AnswerButtons({
  card,
  locked,
  onAnswer,
}: {
  card: CardView;
  locked: boolean;
  onAnswer: (answer: "positive" | "negative") => void;
}) {
  const accent = ACCENT_VAR[card.product.accent];

  // A light tick when the 2 s lock lifts: the answers are live now.
  const wasLocked = React.useRef(locked);
  React.useEffect(() => {
    if (wasLocked.current && !locked) haptic("tick");
    wasLocked.current = locked;
  }, [locked]);

  // The commit haptic fires in the swipe page's answer(), so taps, drags and arrow keys all get exactly one.
  function choose(answer: "positive" | "negative") {
    onAnswer(answer);
  }

  return (
    <div>
      <div className="flex items-start justify-center gap-14 md:gap-10" lang={card.lang}>
        <button
          type="button"
          disabled={locked}
          onClick={() => choose("negative")}
          aria-label={card.negativeLabel}
          className="group flex flex-col items-center gap-1.5 outline-none disabled:cursor-not-allowed md:gap-3"
        >
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-[opacity,transform] duration-150 group-enabled:group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-ring md:size-[72px]",
              locked && "opacity-50",
            )}
          >
            <X aria-hidden className="size-7" />
          </span>
          <span className="max-w-[9rem] text-center text-sm text-muted-foreground md:sr-only md:text-base">{card.negativeLabel}</span>
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => choose("positive")}
          aria-label={card.positiveLabel}
          className="group flex flex-col items-center gap-1.5 outline-none disabled:cursor-not-allowed md:gap-3"
        >
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-[opacity,transform] duration-150 group-enabled:group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 md:size-[72px]",
              locked && "opacity-50",
            )}
            style={{ backgroundColor: accent }}
          >
            <Heart aria-hidden className="size-7 fill-current" />
          </span>
          <span className="max-w-[9rem] text-center text-sm font-bold md:sr-only md:text-base">{card.positiveLabel}</span>
        </button>
      </div>

      <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
        {locked ? (
          <motion.div
            key={card.cardId}
            className="h-full origin-left rounded-full"
            style={{ backgroundColor: accent }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: ANSWER_LOCK_MS / 1000, ease: "linear" }}
          />
        ) : (
          <div className="h-full rounded-full" style={{ backgroundColor: accent }} />
        )}
      </div>
      <p className="mt-1.5 h-4 text-center text-xs text-muted-foreground md:mt-2 md:h-5" aria-live="polite">
        {locked ? "Read the card. Answers unlock in 2 seconds." : "Swipe the card or tap an answer."}
      </p>
    </div>
  );
}

/** Web only: the arrow-key hints under the big question (design web 33). */
export function KeyHints({ card }: { card: CardView }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-6 text-muted-foreground" lang={card.lang}>
      <span className="flex items-center gap-3">
        <kbd className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
          <ArrowLeft aria-hidden className="size-4" />
        </kbd>
        {card.negativeLabel}
      </span>
      <span className="flex items-center gap-3">
        <kbd className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground">
          <ArrowRight aria-hidden className="size-4" />
        </kbd>
        {card.positiveLabel}
      </span>
    </div>
  );
}
