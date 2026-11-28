"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { haptic } from "@/shared/lib/feel/haptics";
import { cn } from "@/shared/lib/utils";

import { AskPanel } from "./ask-panel";

/** The deck the page is about, from /decks/[id]/... (not /decks/new). Otherwise the server picks the newest deck. */
function deckIdFrom(pathname: string): string | null {
  const m = /^\/decks\/([^/]+)/.exec(pathname);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
}

/**
 * "Ask PitchSwipe": a pill in the bottom-right corner (above the tab bar on phones) that opens the chat panel
 * on the right. Hidden while the panel is open. The panel mounts on first open and keeps its conversation.
 */
export function AskFab() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            haptic("select");
            setMounted(true);
            setOpen(true);
          }}
          className={cn(
            "fixed right-4 z-30 flex h-12 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] outline-none transition-transform duration-150",
            "bottom-[calc(var(--tabbar-height)+1rem)] md:bottom-6 md:right-6",
            "hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Sparkles aria-hidden className="size-4" />
          Ask PitchSwipe
        </button>
      )}
      {mounted && <AskPanel open={open} onClose={close} deckId={deckIdFrom(pathname)} />}
    </>
  );
}
