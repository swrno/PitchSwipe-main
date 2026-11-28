/**
 * The swiper's answer history: maps stored responses + their deck, card and wallet entry to display rows (pure).
 */
import { TEST_VARIABLE_LABELS, type TestVariable } from "@/shared/lib/lists";
import { composeCard } from "@/features/swipe/card";
import type { SwipeDeck } from "@/features/swipe/types";
import { roundRs } from "./rules";

export const HISTORY_PAGE_SIZE = 50;

/** One stored answer, as the store lists it. */
export interface AnswerRecord {
  responseId: string;
  deckId: string;
  cardId: string;
  answer: string;
  valid: boolean;
  counted: boolean;
  createdAt: Date;
}

/** The slice of a wallet entry the history needs. */
export interface HistoryEntry {
  responseId: string;
  amountRs: number;
  note: string;
}

/** One row of /history. No ids of other people; `id` is the swiper's own response id. */
export interface HistoryItem {
  id: string;
  product: string;
  variable: string;
  headline: string;
  answer: "yes" | "no";
  paid: boolean;
  earnedRs: number;
  counted: boolean;
  valid: boolean;
  claimed: boolean;
  answeredAt: string;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export function toHistoryItem(
  answer: AnswerRecord,
  deck: SwipeDeck | null,
  entry: HistoryEntry | undefined,
  claimed: boolean,
): HistoryItem {
  const card = deck?.cards.find((c) => c.id === answer.cardId);
  const headline =
    deck && card ? composeCard(deck, card, { source: "feed", paid: false, paidRs: 0, counting: false }).headline : "";
  const earnedRs = roundRs(entry?.amountRs ?? 0);
  return {
    id: answer.responseId,
    product: deck?.product.name ?? "Removed product",
    variable: deck ? (TEST_VARIABLE_LABELS[deck.variable as TestVariable] ?? "") : "",
    headline,
    answer: answer.answer === "yes" ? "yes" : "no",
    // An unpaid card is the only thing the wallet note marks as unpaid; a credited paid answer earned money.
    paid: entry ? entry.note !== "unpaid" : false,
    earnedRs,
    counted: answer.counted,
    valid: answer.valid,
    claimed,
    answeredAt: answer.createdAt.toISOString(),
  };
}

/** `rows` is newest first and may hold one extra row (limit + 1) that only signals another page. */
export function buildHistoryPage(
  rows: readonly AnswerRecord[],
  decks: ReadonlyMap<string, SwipeDeck>,
  entries: ReadonlyMap<string, HistoryEntry>,
  claimedDeckIds: ReadonlySet<string>,
  limit = HISTORY_PAGE_SIZE,
): HistoryPage {
  const page = rows.slice(0, limit);
  const items = page.map((r) =>
    toHistoryItem(r, decks.get(r.deckId) ?? null, entries.get(r.responseId), claimedDeckIds.has(r.deckId)),
  );
  const last = page[page.length - 1];
  return { items, nextCursor: rows.length > limit && last ? String(last.createdAt.getTime()) : null };
}

/** The cursor is the createdAt (ms) of the last row of the previous page. */
export function parseCursor(raw: string | null): Date | null | "invalid" {
  if (raw === null || raw === "") return null;
  if (!/^\d{1,15}$/.test(raw)) return "invalid";
  return new Date(Number(raw));
}

export interface HistorySummary {
  total: number;
  yes: number;
  earnedRs: number;
}

export function summarize(items: readonly HistoryItem[]): HistorySummary {
  return {
    total: items.length,
    yes: items.filter((i) => i.answer === "yes").length,
    earnedRs: roundRs(items.reduce((sum, i) => sum + i.earnedRs, 0)),
  };
}

export type HistoryFilter = "all" | "yes" | "no" | "claimed";

export function filterItems(items: readonly HistoryItem[], filter: HistoryFilter): HistoryItem[] {
  if (filter === "yes") return items.filter((i) => i.answer === "yes");
  if (filter === "no") return items.filter((i) => i.answer === "no");
  if (filter === "claimed") return items.filter((i) => i.claimed);
  return [...items];
}

/** Group newest-first rows by India-time day: "Today", "Yesterday", else "12 Nov 2026". */
export function groupByDay(items: readonly HistoryItem[], now = Date.now()): { label: string; items: HistoryItem[] }[] {
  const IST = 5.5 * 3_600_000;
  const DAY = 86_400_000;
  const dayOf = (ms: number) => Math.floor((ms + IST) / DAY);
  const today = dayOf(now);
  const groups: { day: number; label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const ms = new Date(item.answeredAt).getTime();
    const day = dayOf(ms);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      const label =
        day >= today
          ? "Today"
          : day === today - 1
            ? "Yesterday"
            : new Date(ms + IST).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      group = { day, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups.map(({ label, items: rows }) => ({ label, items: rows }));
}
