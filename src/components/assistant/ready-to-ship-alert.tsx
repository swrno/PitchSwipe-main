"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import type { AlertView } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

import { assistantJson } from "./api";
import { ShipReviewDialog } from "./ship-dialog";

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/**
 * Dark "Test decided" card at the top of My decks (phone 17, web 19). Renders nothing when no
 * alert is open. "Review and ship" opens the review sheet; "Later" snoozes the alert for 24 h.
 * Re-checks every minute so a withdrawn alert disappears.
 */
export function ReadyToShipAlert({ className, onChanged }: { className?: string; onChanged?: () => void }) {
  const router = useRouter();
  const [alerts, setAlerts] = React.useState<AlertView[]>([]);
  const [reviewing, setReviewing] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const load = React.useCallback(() => {
    assistantJson<{ alerts: AlertView[] }>("GET", "/api/notifications")
      .then((d) => {
        setAlerts(d.alerts);
        setNow(Date.now());
      })
      .catch(() => setAlerts([]));
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function later(deckId: string) {
    setAlerts((a) => a.filter((x) => x.deckId !== deckId));
    try {
      await assistantJson("POST", "/api/notifications", { deckId, action: "snooze" });
    } catch {
      load();
    }
  }

  if (alerts.length === 0 && !reviewing) return null;

  return (
    <>
      {alerts.map((a) => (
        <section
          key={a.deckId}
          aria-label="Test decided"
          className={cn("tile bg-sun p-5 md:p-6", className)}
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-ink-foreground">
              <Bell className="size-3.5" aria-hidden /> Test decided
            </span>
            <span className="font-semibold text-ink/60">Assistant · {ago(a.raisedAt, now)}</span>
          </div>
          <h2 className="mb-3 text-2xl leading-tight md:text-[1.7rem]">{a.headline}</h2>
          <p className="mb-5 text-ink/75">{a.body}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setReviewing(a.deckId)}
              className="pressable h-12 flex-1 rounded-full bg-ink text-base font-bold text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink md:max-w-xs"
            >
              Review and ship
            </button>
            <button
              type="button"
              onClick={() => later(a.deckId)}
              className="pressable h-12 rounded-full border-2 border-ink px-7 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              Later
            </button>
          </div>
        </section>
      ))}
      {reviewing && (
        <ShipReviewDialog
          deckId={reviewing}
          open
          onClose={() => {
            setReviewing(null);
            load();
          }}
          onChanged={() => {
            load();
            router.refresh();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
