"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import type { ReviewView, ShippedView } from "@/features/assistant/types";
import { cn } from "@/shared/lib/utils";

import { assistantJson, deckApi } from "./api";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "review"; view: ReviewView }
  | { kind: "shipping"; view: ReviewView }
  | { kind: "shipped"; view: ShippedView; busy?: boolean };

/**
 * Review sheet (phone 18, web 20) and Shipped confirmation (phone 19, web 21): a bottom sheet
 * on phones, a centred dialog from md up. Nothing ships until "Approve and ship" is pressed;
 * the server re-checks Flagsmith's decision and the signed-in owner.
 */
export function ShipReviewDialog(props: {
  deckId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a ship or an undo, so the page can refresh its data. */
  onChanged?: () => void;
}) {
  // Mounted only while open, so every opening starts from "loading" with fresh data.
  return props.open ? <DialogBody deckId={props.deckId} onClose={props.onClose} onChanged={props.onChanged} /> : null;
}

function DialogBody({ deckId, onClose, onChanged }: { deckId: string; onClose: () => void; onChanged?: () => void }) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [undoError, setUndoError] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let alive = true;
    assistantJson<ReviewView>("GET", deckApi(deckId))
      .then((view) => alive && setPhase({ kind: "review", view }))
      .catch((e: Error) => alive && setPhase({ kind: "error", message: e.message }));
    return () => {
      alive = false;
    };
  }, [deckId]);

  React.useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function approve(view: ReviewView) {
    setPhase({ kind: "shipping", view });
    try {
      const shipped = await assistantJson<ShippedView>("POST", deckApi(deckId), { approve: true, winnerKey: view.winnerKey });
      setPhase({ kind: "shipped", view: shipped });
      onChanged?.();
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  }

  async function undo(view: ShippedView) {
    setPhase({ kind: "shipped", view, busy: true });
    setUndoError(null);
    try {
      await assistantJson("POST", `${deckApi(deckId)}/undo`);
      onChanged?.();
      onClose();
    } catch (e) {
      setUndoError((e as Error).message);
      setPhase({ kind: "shipped", view });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-[34rem] flex-col overflow-hidden rounded-t-3xl bg-background outline-none md:max-w-[35rem] md:rounded-3xl"
      >
        {phase.kind === "loading" && (
          <SheetBody footer={false}>
            <p role="status" className="py-10 text-center text-muted-foreground">
              Checking Flagsmith...
            </p>
          </SheetBody>
        )}

        {phase.kind === "error" && (
          <SheetBody footer={false}>
            <div className="py-6">
              <h2 id="ship-title" className="mb-2 text-2xl">
                Could not continue
              </h2>
              <p role="alert" className="mb-5 text-muted-foreground">
                {phase.message}
              </p>
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </SheetBody>
        )}

        {(phase.kind === "review" || phase.kind === "shipping") && (
          <Review view={phase.view} busy={phase.kind === "shipping"} onKeep={onClose} onApprove={() => approve(phase.view)} />
        )}

        {phase.kind === "shipped" && (
          <Shipped view={phase.view} busy={phase.busy === true} undoError={undoError} onUndo={() => undo(phase.view)} onDone={onClose} />
        )}
      </div>
    </div>
  );
}

function Review({ view, busy, onKeep, onApprove }: { view: ReviewView; busy: boolean; onKeep: () => void; onApprove: () => void }) {
  if (!view.decided) {
    return (
      <SheetBody footer={false}>
        <div className="py-4">
          <h2 id="ship-title" className="mb-2 text-2xl">
            {view.alreadyShipped ? "Already shipped" : "Not decided yet"}
          </h2>
          <p className="mb-5 text-muted-foreground">
            {view.alreadyShipped ? "This deck's winner is already live." : (view.notDecidedText ?? "Nothing is ready to ship.")}
          </p>
          <Button variant="outline" className="w-full" onClick={onKeep}>
            Keep testing
          </Button>
        </div>
      </SheetBody>
    );
  }
  return (
    <>
      <SheetBody>
        <div className="mb-3 flex items-start justify-between">
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent">Test decided</span>
          <button type="button" aria-label="Close" onClick={onKeep} className="-mr-1 -mt-1 hidden rounded-full p-2 hover:bg-muted md:block">
            <X className="size-5" />
          </button>
        </div>
        <h2 id="ship-title" className="mb-3 text-3xl leading-tight md:mb-2 md:text-[1.75rem]">
          {view.headline}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground md:mb-3">{view.fromLine}</p>

        <ul className="mb-5 space-y-2.5 md:mb-3">
          {view.cards.map((c) => (
            <li
              key={c.key}
              className={cn("flex items-center gap-3 rounded-2xl border px-3 py-3 md:py-2.5", c.isWinner ? "border-2 border-primary" : "border-border")}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white",
                  c.isWinner ? "bg-accent" : "bg-muted-foreground/40",
                )}
              >
                {c.key}
              </span>
              <span className={cn("min-w-0 flex-1 text-[0.95rem]", c.isWinner && "font-bold")}>{c.text}</span>
              <span className={cn("text-lg tabular-nums", c.isWinner ? "font-extrabold" : "font-semibold")}>{c.chancePercent}%</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-3 text-base font-bold">When you approve</h3>
        <ol className="mb-5 space-y-2.5 md:mb-3">
          {view.steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-[0.95rem] text-muted-foreground">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>

        {view.insight && (
          <p className="flex gap-3 rounded-2xl bg-accent-soft p-4 text-[0.95rem] md:p-3.5">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <span>
              <strong>AI insight:</strong> {view.insight}
            </span>
          </p>
        )}
      </SheetBody>
      {/* Pinned under the scrolling body, so the buttons are always on screen (web 20, phone 18). */}
      <SheetFooter className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        <Button variant="outline" size="lg" className="px-3 text-base md:h-12" onClick={onKeep} disabled={busy}>
          Keep testing
        </Button>
        <Button size="lg" className="px-3 text-base md:h-12" onClick={onApprove} disabled={busy}>
          {busy ? "Shipping..." : `Approve and ship ${view.winnerKey}`}
        </Button>
      </SheetFooter>
    </>
  );
}

function Shipped({
  view,
  busy,
  undoError,
  onUndo,
  onDone,
}: {
  view: ShippedView;
  busy: boolean;
  undoError: string | null;
  onUndo: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <SheetBody>
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-7" aria-hidden />
        </span>
        <h2 id="ship-title" className="mb-2 text-3xl leading-tight">
          {view.headline}
        </h2>
        <p className="mb-5 text-muted-foreground">{view.approvedLine}</p>

        <ul className="mb-5 space-y-4">
          {view.ticks.map((t) => (
            <li key={t.title} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                  t.ok ? "bg-accent text-accent-foreground" : "bg-warning text-white",
                )}
              >
                {t.ok ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <span aria-hidden className="text-xs font-bold">
                    !
                  </span>
                )}
              </span>
              <span>
                <span className="block font-bold">{t.title}</span>
                <span className="block text-sm text-muted-foreground">{t.detail}</span>
              </span>
            </li>
          ))}
        </ul>

        {view.next && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assistant suggests next</p>
              <p className="font-bold">{view.next.text}</p>
            </div>
            <Link
              href="/decks/new"
              className="inline-flex h-11 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Draft it
            </Link>
          </div>
        )}
      </SheetBody>
      <SheetFooter>
        {view.undoAvailable && view.undoNote && !undoError && (
          <p className="mb-3 text-sm text-muted-foreground">{view.undoNote}</p>
        )}
        {undoError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {undoError}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {view.undoAvailable && (
            <Button variant="outline" size="lg" className="px-3 text-base" onClick={onUndo} disabled={busy}>
              {busy ? "Switching back..." : "Undo: switch back"}
            </Button>
          )}
          <Button size="lg" className={cn("px-3 text-base", !view.undoAvailable && "col-span-2")} onClick={onDone} disabled={busy}>
            Done
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

/** Scrolling body of the sheet / dialog. `footer={false}` when no pinned action bar follows. */
function SheetBody({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return (
    <div
      data-modal-body
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 md:p-5", footer ? "pb-3 md:pb-4" : "pb-6 md:pb-6")}
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden />
      {children}
    </div>
  );
}

/** Action bar pinned under the scrolling body (always visible, even in a short window). */
function SheetFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-modal-footer className={cn("shrink-0 border-t border-border bg-background px-5 pb-6 pt-3 md:px-6", className)}>
      {children}
    </div>
  );
}
