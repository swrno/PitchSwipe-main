/**
 * Alert lifecycle as a pure function (spec 05 6.6 rules): "Later" snoozes 24 h; if the
 * chance drops under the threshold before approval the alert is withdrawn. Never ships.
 */
import { SNOOZE_HOURS, type AlertRecord, type Assessment } from "./types";

export type AlertAction =
  | { kind: "raise" } // new alert: notify + email
  | { kind: "refresh" } // still decided: update numbers, no new notice
  | { kind: "resurface" } // snooze ended: show again, no new email
  | { kind: "withdraw" }
  | { kind: "none" };

export function nextAlertAction(existing: AlertRecord | null, assessment: Assessment, now: Date): AlertAction {
  if (existing?.status === "shipped") return { kind: "none" };
  const open = existing && (existing.status === "active" || existing.status === "snoozed");
  if (!assessment.decided) return open ? { kind: "withdraw" } : { kind: "none" };
  if (!open) return { kind: "raise" };
  if (existing.status === "snoozed") {
    const until = existing.snoozedUntil ? Date.parse(existing.snoozedUntil) : 0;
    return now.getTime() >= until ? { kind: "resurface" } : { kind: "none" };
  }
  return { kind: "refresh" };
}

export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + SNOOZE_HOURS * 3_600_000).toISOString();
}
