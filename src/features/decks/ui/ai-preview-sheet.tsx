"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

/**
 * F5 AI preview (phone 12, web 14). Always Simulated and Unproven; never counts toward the winner.
 * No persona service is wired, so it shows NO numbers or quotes and says so instead of inventing picks.
 */
export function AiPreviewSheet({
  open,
  onClose,
  onEdit,
  onPublish,
}: {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPublish: () => void;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-preview-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background md:max-w-[42rem] md:rounded-3xl"
      >
        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-3 md:p-5 md:pb-4">
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
          AI preview
        </h2>
        <p className="mb-5 text-muted-foreground">
          AI persona previews are not available yet. Nothing was simulated for your cards, so there are no picks to show. Publish when you are ready: a preview never counts toward the winner anyway.
        </p>

        <p className="text-sm text-muted-foreground">
          Simulated and unproven: an AI preview is just an idea before launch and never counts toward the winner.
        </p>

        </div>
        {/* Pinned under the scrolling body so the two buttons are always on screen. */}
        <div data-modal-footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-background px-5 pb-6 pt-3 md:px-6 md:pb-6">
          <Button variant="outline" size="lg" className="md:h-12" onClick={onEdit}>
            Edit cards
          </Button>
          <Button size="lg" className="md:h-12" onClick={onPublish}>
            Publish test
          </Button>
        </div>
      </div>
    </div>
  );
}
