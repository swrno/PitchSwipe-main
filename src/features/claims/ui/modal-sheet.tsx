"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/utils";

/**
 * Bottom sheet on phone, centred dialog from md up (designs phone 36-38, web 34-35).
 * Escape calls onDismiss when given. Focus moves into the panel on open.
 *
 * The panel never grows past 92% of the screen height: the body scrolls inside it. Pass `footer` (the
 * action buttons) to keep them pinned below the scrolling body, so they are always visible, even in a
 * 1440 x 900 browser window or on a short phone.
 */
export function ModalSheet({
  labelledBy,
  onDismiss,
  children,
  footer,
  className,
  scroll = true,
}: {
  labelledBy: string;
  onDismiss?: () => void;
  children: React.ReactNode;
  /** Pinned under the scrolling body (the dialog's action buttons). */
  footer?: React.ReactNode;
  className?: string;
  /** False: the body never scrolls; children fill it (flex column) and scroll inside their own frames. */
  scroll?: boolean;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const body = React.useRef<HTMLDivElement>(null);
  const inner = React.useRef<HTMLDivElement>(null);
  // The divider above the pinned footer only shows when the body really scrolls (design: no line on a short sheet).
  const [scrolls, setScrolls] = React.useState(false);

  React.useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (inner.current) observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    panel.current?.focus();
    if (!onDismiss) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Rendered into <body>: a transformed ancestor (draggable cards, animated strips) would otherwise trap the
  // fixed backdrop inside it, leaving the sidebar and top bar undimmed. The page behind does not scroll while open.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-[2px] md:items-center md:p-5">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)] outline-none ring-1 ring-foreground/10 md:rounded-2xl",
          className,
        )}
      >
        <div
          ref={body}
          data-modal-body
          className={cn(
            "min-h-0 flex-1 px-5 pt-3 md:p-5",
            scroll ? "overflow-y-auto overscroll-contain" : "flex flex-col overflow-hidden",
            footer ? "pb-3 md:pb-4" : "pb-[max(1.5rem,var(--safe-bottom))] md:pb-6",
          )}
        >
          <div ref={inner} className={scroll ? undefined : "flex min-h-0 flex-1 flex-col"}>
            <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border md:hidden" />
            {children}
          </div>
        </div>
        {footer ? (
          <div
            data-modal-footer
            className={cn(
              "shrink-0 border-t bg-card px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-3 md:px-6 md:pb-6",
              scrolls ? "border-border" : "border-transparent",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
