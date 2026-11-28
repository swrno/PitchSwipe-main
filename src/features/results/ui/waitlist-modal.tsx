"use client";

import * as React from "react";
import { Check, Copy, Download, X } from "lucide-react";

import { ModalSheet } from "@/features/claims/ui/modal-sheet";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";

import { fetchWaitlistRows, type WaitlistRow } from "./api";

const FOCUSABLE = 'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** Full waitlist: search, copy all, download. Focus is trapped and returned to the trigger on close. */
export function WaitlistModal({
  deckId,
  count,
  onClose,
  onDownload,
  downloading,
}: {
  deckId: string;
  count: number;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [rows, setRows] = React.useState<WaitlistRow[] | null>(null);
  const [error, setError] = React.useState<string>();
  const [query, setQuery] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const wrap = React.useRef<HTMLDivElement>(null);
  const opener = React.useRef<Element | null>(null);

  React.useEffect(() => {
    opener.current = document.activeElement;
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    fetchWaitlistRows(deckId)
      .then((r) => live && setRows(r))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [deckId, tick]);
  const load = () => {
    setError(undefined);
    setRows(null);
    setTick((n) => n + 1);
  };

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => r.email.toLowerCase().includes(q));

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(shown.map((r) => r.email).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Use Download emails instead.");
    }
  };

  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const dialog = wrap.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={wrap}
      onKeyDown={trap}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('[role="dialog"]')) onClose();
      }}
    >
      <ModalSheet
        labelledBy="waitlist-modal-title"
        onDismiss={onClose}
        className="h-dvh max-h-none rounded-none md:h-auto md:max-h-[85dvh] md:max-w-4xl md:rounded-xl"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={copyAll}
              disabled={shown.length === 0}
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy all emails"}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className={cn(buttonVariants({ variant: "default" }), "h-11")}
            >
              <Download aria-hidden /> Download emails
            </button>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="waitlist-modal-title" className="text-lg font-semibold">
            Waitlist ({rows ? rows.length : count})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close waitlist"
            className="flex size-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <label htmlFor="waitlist-search" className="sr-only">
          Search by email
        </label>
        <input
          id="waitlist-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email"
          className="mt-3 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div aria-live="polite" className="mt-3">
          {error ? (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-destructive">{error}</p>
              <button type="button" onClick={load} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Try again
              </button>
            </div>
          ) : !rows ? (
            <div aria-busy className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted motion-safe:animate-pulse" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "No email matches your search." : "No one has joined yet."}</p>
          ) : (
            <ul>
              {shown.map((r, i) => (
                <li
                  key={`${r.email}-${r.claimedAt}-${i}`}
                  className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{r.email}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="rounded-md border border-border px-2 py-0.5 font-medium">{r.card}</span>
                    <span className="tnum w-24 text-right text-muted-foreground">{fmtDate(r.claimedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalSheet>
    </div>
  );
}
