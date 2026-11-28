"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Gift, MessageSquarePlus, X } from "lucide-react";
import { AnswerSavedSheet, earningPill } from "@/features/claims/ui/answer-saved-sheet";
import { ClaimSheet } from "@/features/claims/ui/claim-sheet";
import { useAuth } from "@/features/auth/ui/provider";
import { claimRewardRequest, type Fetcher } from "@/features/claims/ui/client";
import { haptic } from "@/shared/lib/feel/haptics";
import { canClaim } from "@/features/claims/rules";
import { getSwiperGuid } from "@/features/swipe/ui/client";
import type { CardView, SubmitSuccess } from "@/features/swipe/types";
import { cn } from "@/shared/lib/utils";

/**
 * What happens after an answer. Nothing blocks the next card: the next idea loads straight away and this
 * strip slides in at the top of the screen with what the answer earned.
 *
 *  - A valid, counted yes gets a "Claim reward" button. Claiming stays an explicit tap (spec 03: the swiper
 *    taps the reward button, then the sheet shows the verified email, then one more tap claims). That strip
 *    stays for 8 s, and as long as the pointer or focus is on it.
 *  - Every stored answer gets "Comment": the optional comment (typed or voice) in a sheet, only on request.
 *  - Other strips leave after 3.5 s. The next answer always replaces the strip.
 *
 * The wallet credit is not here any more: swipe-experience credits it once per answer, before the next card.
 */
export interface AnswerReceipt {
  /** Changes with every answer, so a new answer replaces the strip and its state. */
  id: number;
  card: CardView;
  /** What the server stored, or null when the answer was ignored (under 300 ms) or a duplicate. */
  result: SubmitSuccess | null;
  error: string | null;
  /** The swiper tapped the reward on the card: open the claim sheet straight away when the yes can claim. */
  openClaim?: boolean;
}

function ownTarget(e: React.SyntheticEvent<HTMLElement>): boolean {
  return e.currentTarget.contains(e.target as Node);
}

const AUTO_HIDE_MS = 3500;
const CLAIM_HIDE_MS = 8000;

export function AnswerReceiptStrip({
  receipt,
  onDismiss,
  onSheetChange,
}: {
  receipt: AnswerReceipt;
  onDismiss: () => void;
  /** True while the claim or comment sheet is open (the swipe page pauses arrow-key answers). */
  onSheetChange: (open: boolean) => void;
}) {
  const { card, result, error } = receipt;
  const { user, configured, authFetch } = useAuth();
  const fetcher = React.useMemo<Fetcher>(() => (user ? authFetch : (input, init) => fetch(input, init)), [user, authFetch]);
  const swiperGuid = React.useMemo(() => getSwiperGuid(), []);
  const reduceMotion = useReducedMotion();

  const [sheet, setSheetState] = React.useState<null | "claim" | "comment">(null);
  const [claimed, setClaimed] = React.useState(false);
  const [commented, setCommented] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);
  const [held, setHeld] = React.useState(false);

  // The signed-in, verified email.
  const email = configured ? (user?.email ?? undefined) : undefined;
  const verified = configured ? user?.emailVerified === true : false;

  const claimable = result !== null && canClaim(result) && !claimed;
  const setSheet = React.useCallback(
    (next: null | "claim" | "comment") => {
      setSheetState(next);
      // The button that opened the sheet is gone or unfocused when it closes; start the countdown afresh.
      setHeld(false);
      onSheetChange(next !== null);
    },
    [onSheetChange],
  );

  // Leaves by itself (longer when there is a reward to claim), never while a sheet is open or the pointer or
  // focus is on it. It sits over the bottom of the screen (the answer bar on phones), so it must not stay there.
  React.useEffect(() => {
    if (sheet || held) return;
    const timer = window.setTimeout(onDismiss, claimable ? CLAIM_HIDE_MS : error ? AUTO_HIDE_MS + 1500 : AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [claimable, sheet, held, error, onDismiss]);

  // A sheet still open when this strip goes away must not leave the swipe page paused.
  React.useEffect(() => () => onSheetChange(false), [onSheetChange]);

  // Tapping the reward on the card already was the explicit tap: skip the strip's button and show the claim.
  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (!receipt.openClaim || autoOpened.current || !claimable) return;
    autoOpened.current = true;
    setSheet("claim");
  }, [receipt.openClaim, claimable, setSheet]);

  async function claim() {
    if (!result) return;
    setBusy(true);
    setClaimError(null);
    try {
      await claimRewardRequest(fetcher, { swiperGuid, responseId: result.responseId, token: result.servedToken });
      setClaimed(true);
      haptic("success");
      setSheet(null);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Could not claim the reward.");
    } finally {
      setBusy(false);
    }
  }

  const earned = result !== null && result.earnedRs > 0;
  const title = error ? "Answer not saved" : !result ? "Not counted" : claimed ? "Reward claimed" : "Saved";
  const detail = claimed
    ? `You are on the ${card.product.name} waitlist`
    : (error ?? (result ? earningPill(card, result) : "That answer was too quick to count."));

  return (
    <>
      <motion.div
        role="status"
        aria-live="polite"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.18 } }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
        // Only the strip's own elements hold it. Events from the portalled sheets bubble here through React too.
        onPointerEnter={(e) => ownTarget(e) && setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocusCapture={(e) => ownTarget(e) && setHeld(true)}
        onBlurCapture={(e) => ownTarget(e) && setHeld(false)}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-background/95 p-2 pl-2.5 backdrop-blur"
      >
        <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            error
              ? "bg-warning-soft text-warning"
              : earned || claimed
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {error ? <X className="size-4" /> : <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-extrabold tracking-tight">{title}</span>
          <span
            className={cn(
              "block truncate text-[0.8125rem]",
              earned && !claimed ? "font-semibold text-accent" : "text-muted-foreground",
            )}
          >
            {detail}
          </span>
        </span>

        {result && !commented && !claimable ? (
          <button
            type="button"
            onClick={() => setSheet("comment")}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          >
            <MessageSquarePlus aria-hidden className="size-4" /> Comment
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
        </div>

        {/* A yes with a reward: the reward button gets its own row, so neither it nor the text is squeezed. */}
        {claimable ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSheet("claim")}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97]"
            >
              <Gift aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{card.reward ? `Claim: ${card.reward}` : "Claim reward"}</span>
            </button>
            {result && !commented ? (
              <button
                type="button"
                onClick={() => setSheet("comment")}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
              >
                <MessageSquarePlus aria-hidden className="size-4" /> Comment
              </button>
            ) : null}
          </div>
        ) : null}
      </motion.div>

      {/* The sheets are full-screen overlays: portalled out of the animated strip (a transform would trap `fixed`). */}
      {sheet === "claim" ? createPortal(
        <ClaimSheet
          card={card}
          email={email}
          verified={verified}
          busy={busy}
          error={claimError}
          onClaim={() => void claim()}
          onSkip={() => setSheet(null)}
        />,
        document.body,
      ) : null}
      {sheet === "comment" && result ? createPortal(
        <AnswerSavedSheet
          card={card}
          result={result}
          fetcher={fetcher}
          swiperGuid={swiperGuid}
          claimed={claimed}
          onSaved={() => {
            setCommented(true);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />,
        document.body,
      ) : null}
    </>
  );
}
