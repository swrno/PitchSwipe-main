"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type { ExportScope } from "@/features/export/types";

import { DownloadSheet, type TabId } from "./download-sheet";

export interface DownloadResultsButtonProps {
  deckId: string;
  /** The deck's product (used by the "Whole product" choice; the server derives it from the deck). */
  productId?: string;
  /** The dialog opens on the tab that matches the page it was opened from. */
  initialTab?: TabId;
  /** "product" on the product Overview tab. */
  initialScope?: ExportScope;
  className?: string;
}

/** The one Download button of a page: opens the Download results sheet (phone) or dialog (web). */
export function DownloadResultsButton({ deckId, initialTab, initialScope, className }: DownloadResultsButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4",
          className,
        )}
      >
        <Download aria-hidden /> Download
      </button>
      {open && createPortal(<DownloadSheet deckId={deckId} initialTab={initialTab} initialScope={initialScope} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
