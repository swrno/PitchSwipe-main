"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PERSONA_PREVIEW } from "@/fixtures";
import { VARIANT_KEYS } from "@/lib/decks/fields";

const QUOTES = [
  { text: "Chasing dues is my biggest headache. B speaks to that.", persona: "cloth wholesaler, Surat" },
  { text: "C sounds cheap, but I do not know what I get.", persona: "grocery distributor, Patna" },
];

/**
 * F5 AI preview (phone 12, web 14). Always Simulated and Unproven; never counts toward the winner.
 * Demo mode shows the designed fixture numbers, labelled "Demo data" (the persona quotes and the
 * "1 of 3" record are the designed sample). Real mode shows NO numbers or quotes: no persona
 * service is wired, so it says so instead of inventing picks.
 */
export function AiPreviewSheet({
  open,
  onClose,
  onEdit,
  onPublish,
  labels,
  roles,
  question,
  demo = false,
}: {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPublish: () => void;
  /** Short label per version, in A, B, C order. */
  labels: string[];
  roles: string[];
  question: string;
  demo?: boolean;
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const picks = demo ? [PERSONA_PREVIEW.picksOfTwenty.A, PERSONA_PREVIEW.picksOfTwenty.B, PERSONA_PREVIEW.picksOfTwenty.C] : [];
  const rows = labels.map((label, i) => ({ key: VARIANT_KEYS[i], label, picks: picks[i] ?? 0 })).sort((a, b) => b.picks - a.picks);
  const personas = labels.length * PERSONA_PREVIEW.personasPerCard;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-preview-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background md:max-w-[42rem] md:rounded-3xl"
      >
        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-3 md:p-6 md:pb-4">
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-3 flex items-start justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-sm font-bold text-warning">
              <Sparkles className="size-4" /> Simulated: not real swipes
            </span>
            <span className="rounded-full bg-warning-soft px-3 py-1.5 text-sm font-bold text-warning">Unproven</span>
          </div>
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <h2 id="ai-preview-title" className="mb-2 flex flex-wrap items-center gap-3 text-4xl">
          AI preview {demo ? <DemoBadge /> : null}
        </h2>
        {demo ? (
          <p className="mb-5 text-muted-foreground">
            {personas} AI personas based on “{roles.join(", ") || "everyone"}”: {PERSONA_PREVIEW.personasPerCard} per version, and each sees only one card, just like real swipers. {question}
          </p>
        ) : (
          <p className="mb-5 text-muted-foreground">
            AI persona previews are not available yet. Nothing was simulated for your cards, so there are no picks to show. Publish when you are ready: a preview never counts toward the winner anyway.
          </p>
        )}

      {demo ? (
      <>
        <ul className="mb-5 space-y-4">
          {rows.map((r, i) => (
            <li key={r.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-bold">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground">{r.key}</span>
                  <span className="truncate">{r.label || `Version ${r.key}`}</span>
                </span>
                <span className="shrink-0 font-bold">{r.picks} of {PERSONA_PREVIEW.personasPerCard}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted">
                <div className={i === 0 ? "grow-x h-full rounded-full bg-accent" : "grow-x h-full rounded-full bg-[#a1a1aa]"} style={{ width: `${(r.picks / PERSONA_PREVIEW.personasPerCard) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div className="mb-4 space-y-3">
          {QUOTES.map((q) => (
            <figure key={q.text} className="rounded-xl bg-muted p-4">
              <blockquote className="font-semibold">“{q.text}”</blockquote>
              <figcaption className="mt-1 text-sm text-muted-foreground">Persona: {q.persona}</figcaption>
            </figure>
          ))}
        </div>

      </>
      ) : null}

        <p className="text-sm text-muted-foreground">
          {demo
            ? `Sample preview with demo numbers; the AI service is built separately. Unproven: so far the AI picked the real winner in ${PERSONA_PREVIEW.trackRecord.replace("right in ", "")}. Just an idea before launch; it never counts toward the winner.`
            : "Simulated and unproven: an AI preview is just an idea before launch and never counts toward the winner."}
        </p>

        </div>
        {/* Pinned under the scrolling body so the two buttons are always on screen. */}
        <div data-modal-footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-background px-5 pb-6 pt-3 md:px-6 md:pb-6">
          <Button variant="outline" size="lg" className="md:h-12" onClick={onEdit}>
            Edit cards
          </Button>
          <Button size="lg" className="md:h-12" onClick={onPublish}>
            Publish deck
          </Button>
        </div>
      </div>
    </div>
  );
}
