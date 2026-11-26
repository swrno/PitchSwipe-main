/** Timestamps and Result / Lead tags shared by every export file. Pure. */
import type { ResultsPayload } from "@/lib/results/types";

const IST_OFFSET_MIN = 330;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function istParts(d: Date) {
  const t = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: p(t.getUTCHours()), mi: p(t.getUTCMinutes()), p };
}

/** "15 Nov 2026, 18:20 IST": the time the numbers were taken. */
export function stampLabel(d: Date): string {
  const t = istParts(d);
  return `${t.d} ${MONTHS[t.mo]} ${t.y}, ${t.h}:${t.mi} IST`;
}

/** "20261115-1820" for file names. */
export function stampSlug(d: Date): string {
  const t = istParts(d);
  return `${t.y}${t.p(t.mo + 1)}${t.p(t.d)}-${t.h}${t.mi}`;
}

/** ISO time with the seconds dropped, for the every-swipe file. */
export function minuteIso(d: Date): string {
  return `${d.toISOString().slice(0, 16)}Z`;
}

/** First line of every demo export (demo mode only; real exports never carry it). */
export const DEMO_NOTE = "Demo data: every number, time, comment and email in this file is made up for the mockup. Not from real swipers.";

/** True when any deck in the export came from demo fixtures. */
export function isDemoExport(decks: readonly { payload: ResultsPayload }[]): boolean {
  return decks.some((d) => d.payload.demo);
}

export type Tag = "Result" | "Lead" | "";

/**
 * Result vs Lead (spec/05 section 6.5). Only the Flagsmith decision makes a Result: the
 * decided winner. A card in the lead is a Lead. Everything else carries no tag.
 */
export function versionTag(payload: ResultsPayload, cardKey: string): Tag {
  const v = payload.verdict;
  if (v.leaderKey !== cardKey) return "";
  if (v.kind === "decided") return "Result";
  if (v.kind === "leading") return "Lead";
  return "";
}

/** Tag text for the deck verdict line. */
export function verdictTag(payload: ResultsPayload): string {
  switch (payload.verdict.kind) {
    case "decided":
      return "Result";
    case "leading":
      return "Lead (not decided yet)";
    case "too_close":
      return "Not decided (too close to call)";
    default:
      return "Not decided (collecting data)";
  }
}

/** Every segment split is a Lead, never a Result. */
export const SEGMENT_TAG: Tag = "Lead";

export const LEADS_NOTE =
  "Result = decided by Flagsmith (95% chance, 50+ identities per card, no sample ratio warning). Lead = a pattern worth testing, not proof. Groups under 10 swipers are grouped as Other.";

export const PRIVACY_NOTE =
  "Swipers stay anonymous: no names, emails or IP addresses appear in these files. Emails appear only in the waitlist file, for people who tapped to claim the reward.";
