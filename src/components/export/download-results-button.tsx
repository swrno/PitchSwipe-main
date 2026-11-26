"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

import { DownloadSheet } from "./download-sheet";

export interface DownloadResultsButtonProps {
  deckId: string;
  /** The deck's product (used by the "Whole product" choice; the server derives it from the deck). */
  productId?: string;
  /**
   * "icon": round icon button for the phone header (designs phone 16).
   * "labelled": outlined "Download results" button for the web actions row (web 18).
   */
  variant?: "icon" | "labelled";
  className?: string;
}

/** Opens the Download results sheet (phone) or dialog (web). Mount it where the disabled Download buttons are. */
export function DownloadResultsButton({ deckId, variant = "icon", className }: DownloadResultsButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label="Download results"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Download className="size-5" />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-background px-6 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:size-4",
            className,
          )}
        >
          <Download /> Download results
        </button>
      )}
      {open && createPortal(<DownloadSheet deckId={deckId} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
