"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReviewView } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

import { assistantJson, deckApi } from "./api";
import { ShipReviewDialog } from "./ship-dialog";

/**
 * "Ship winner" (web results header, phone results menu). Enabled only when Flagsmith says the
 * test is decided; opens the review sheet / dialog. Pressing it ships nothing by itself.
 */
export function ShipWinnerButton({
  deckId,
  className,
  variant = "outline",
  label = "Ship winner",
  onChanged,
}: {
  deckId: string;
  className?: string;
  variant?: "outline" | "default" | "secondary";
  label?: string;
  /** Extra callback after a ship or undo; the page also refreshes itself. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<"checking" | "ready" | "waiting" | "shipped">("checking");

  const check = React.useCallback(() => {
    assistantJson<ReviewView>("GET", deckApi(deckId))
      .then((v) => setState(v.alreadyShipped ? "shipped" : v.decided ? "ready" : "waiting"))
      .catch(() => setState("waiting"));
  }, [deckId]);

  React.useEffect(() => {
    check();
  }, [check]);

  const title =
    state === "waiting" ? "Available when Flagsmith reports a 95% chance" : state === "shipped" ? "Already shipped" : undefined;

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={cn("h-11 gap-2 px-4", className)}
        disabled={state !== "ready"}
        title={title}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Flag aria-hidden />
        {label}
      </Button>
      <ShipReviewDialog
        deckId={deckId}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={() => {
          check();
          router.refresh();
          onChanged?.();
        }}
      />
    </>
  );
}
