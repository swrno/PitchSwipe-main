"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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
}: {
  labelledBy: string;
  onDismiss?: () => void;
  children: React.ReactNode;
  /** Pinned under the scrolling body (the dialog's action buttons). */
  footer?: React.ReactNode;
  className?: string;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center md:p-6">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-background shadow-2xl outline-none md:rounded-3xl",
          className,
        )}
      >
        <div
          ref={body}
          data-modal-body
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 md:p-6",
            footer ? "pb-3 md:pb-4" : "pb-[max(1.5rem,var(--safe-bottom))] md:pb-6",
          )}
        >
          <div ref={inner}>
            <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border md:hidden" />
            {children}
          </div>
        </div>
        {footer ? (
          <div
            data-modal-footer
            className={cn(
              "shrink-0 border-t bg-background px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-3 md:px-6 md:pb-6",
              scrolls ? "border-border" : "border-transparent",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
