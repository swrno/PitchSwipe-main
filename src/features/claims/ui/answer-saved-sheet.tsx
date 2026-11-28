"use client";

import * as React from "react";
import { Send, Wallet } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { MAX_COMMENT_CHARS } from "@/features/claims/rules";
import { appendComment, founderFirstName, saveCommentRequest, type Fetcher, type VoiceDraft } from "@/features/claims/ui/client";
import type { CardView, SubmitSuccess } from "@/features/swipe/types";
import { cn, formatRs } from "@/shared/lib/utils";
import { ModalSheet } from "./modal-sheet";
import { VoiceNote } from "./voice-note";

export interface AnswerSavedSheetProps {
  card: CardView;
  result: SubmitSuccess;
  fetcher: Fetcher;
  swiperGuid: string;
  /** The swiper tapped "Claim reward" (and it was stored). */
  claimed: boolean;
  /** The comment was stored. */
  onSaved: () => void;
  /** Closed without sending. */
  onClose: () => void;
}

/** What the pill at the top right says. Unpaid decks and not-counted swipes earn nothing. */
export function earningPill(card: CardView, result: SubmitSuccess): string {
  if (result.earnedRs > 0) return `+${formatRs(result.earnedRs)} earned`;
  if (card.source === "link") return "Not paid";
  if (!result.valid) return "Too fast to count";
  if (!result.counted) return "Not counted yet";
  return "Unpaid card";
}

/**
 * S8, opened on request from the answer strip: the optional comment (typed or voice), no target question.
 * The answer is already saved and the next card is already on screen, so this never stands between swipes.
 */
export function AnswerSavedSheet({ card, result, fetcher, swiperGuid, claimed, onSaved, onClose }: AnswerSavedSheetProps) {
  const founder = founderFirstName(card.ownerName);
  const [text, setText] = React.useState("");
  const [voice, setVoice] = React.useState<VoiceDraft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasComment = text.trim().length > 0 || voice !== null;

  async function send() {
    if (!hasComment) return;
    setBusy(true);
    setError(null);
    try {
      await saveCommentRequest(fetcher, {
        swiperGuid,
        responseId: result.responseId,
        token: result.servedToken,
        comment: text,
        voice,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your comment. Try again.");
      setBusy(false);
    }
  }

  // The buttons stay pinned under the scrolling body, so a long voice-note review never pushes them off screen.
  const footer = (
    <>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 md:flex-row-reverse md:gap-3">
        <Button size="lg" className="w-full text-base md:h-12 md:flex-1" onClick={() => void send()} disabled={busy || !hasComment}>
          <Send aria-hidden />
          {busy ? "Sending..." : "Send comment"}
        </Button>
        <Button variant="ghost" size="lg" className="w-full text-muted-foreground md:h-12 md:flex-1 md:border md:border-border md:text-foreground" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  );

  return (
    <ModalSheet labelledBy="saved-title" footer={footer} onDismiss={busy ? undefined : onClose}>
      <div className="flex items-start justify-between gap-3">
        <h2 id="saved-title" className="max-w-[9ch] text-3xl leading-[1.05] md:max-w-none md:text-4xl">
          Add a comment.
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-semibold",
            // Green only when money was earned; "Not counted yet", "Unpaid card" and the rest are neutral, not a win.
            result.earnedRs > 0 ? "border-accent/25 bg-accent-soft text-accent" : "border-border bg-muted text-muted-foreground",
          )}
        >
          <Wallet aria-hidden className="size-5 md:hidden" />
          {earningPill(card, result)}
        </span>
      </div>

      <p className="mt-3 text-lg text-muted-foreground">
        {claimed
          ? `You are on ${founder}'s waitlist for ${card.product.name}. Tell ${founder} what would make it better.`
          : `Your answer is in. Tell ${founder} what would make it better.`}
      </p>

      <label htmlFor="answer-comment" className="mt-5 block text-base font-bold">
        Anything that would make you more likely to use it? <span className="font-normal text-muted-foreground">Optional</span>
      </label>
      <textarea
        id="answer-comment"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_COMMENT_CHARS}
        rows={2}
        placeholder="One line is plenty"
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="mt-3">
        <VoiceNote
          fetcher={fetcher}
          swiperGuid={swiperGuid}
          founder={founder}
          value={voice}
          onChange={setVoice}
          onKeepAsText={(words) => setText((typed) => appendComment(typed, words))}
        />
      </div>
    </ModalSheet>
  );
}
