/**
 * Builds the wallet screen model from stored entries (pure). "Demo earnings": no real money moves and
 * withdraw is always disabled in the hackathon build.
 */
import { DAY_MS, relativeDay, roundRs, startOfDayIst, walletNoteLabel, type WalletView } from "@/lib/claims/rules";
import type { WalletRecord } from "@/lib/claims/store";

export const WALLET_LABEL = "Demo earnings" as const;
/** Withdraw is a Pitch-only feature: the button is shown but never enabled. */
export const WITHDRAW_ENABLED = false;

export function buildWalletView(
  record: WalletRecord,
  opts: { now?: number; counting: boolean; qualityScore?: number; demo: boolean },
): WalletView {
  const now = opts.now ?? Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const live = record.entries.filter((e) => !e.responseId.startsWith("seed-"));
  const week = live.filter((e) => e.createdAt.getTime() >= weekAgo);
  const weeklyRs = roundRs(record.weeklyBaseRs + week.reduce((sum, e) => sum + e.amountRs, 0));
  const weeklyValidSwipes =
    record.weeklyBaseSwipes + week.filter((e) => e.note === "valid").reduce((sum, e) => sum + e.swipeCount, 0);
  const dayStart = startOfDayIst(now);
  const today = live.filter((e) => e.createdAt.getTime() >= dayStart && e.createdAt.getTime() <= now);
  const todayRs = roundRs(record.todayBaseRs + today.reduce((sum, e) => sum + e.amountRs, 0));
  const todayValidSwipes =
    record.todayBaseSwipes + today.filter((e) => e.note === "valid").reduce((sum, e) => sum + e.swipeCount, 0);
  return {
    label: WALLET_LABEL,
    balanceRs: roundRs(record.balanceRs),
    weeklyRs,
    weeklyValidSwipes,
    todayRs,
    todayValidSwipes,
    entries: record.entries.slice(0, 20).map((e) => ({
      id: e.responseId,
      title: e.title,
      detail: `${walletNoteLabel(e.note, e.swipeCount)} · ${relativeDay(e.createdAt, now)}`,
      amountRs: e.amountRs,
    })),
    qualityScore: opts.qualityScore,
    counting: opts.counting,
    demo: opts.demo,
  };
}
