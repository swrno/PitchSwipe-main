/**
 * Builds the wallet screen model from stored entries (pure). Payouts are not live yet: withdraw is always disabled.
 */
import { DAY_MS, relativeDay, roundRs, startOfDayIst, walletNoteLabel, type WalletView } from "@/features/claims/rules";
import type { WalletRecord } from "@/features/claims/server/store";

export const WALLET_LABEL = "Earnings" as const;
/** Withdraw is a Pitch-only feature: the button is shown but never enabled. */
export const WITHDRAW_ENABLED = false;

export function buildWalletView(
  record: WalletRecord,
  opts: { now?: number; counting: boolean; qualityScore?: number },
): WalletView {
  const now = opts.now ?? Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const live = record.entries;
  const week = live.filter((e) => e.createdAt.getTime() >= weekAgo);
  const weeklyRs = roundRs(week.reduce((sum, e) => sum + e.amountRs, 0));
  const weeklyValidSwipes =
    week.filter((e) => e.note === "valid").reduce((sum, e) => sum + e.swipeCount, 0);
  const dayStart = startOfDayIst(now);
  const today = live.filter((e) => e.createdAt.getTime() >= dayStart && e.createdAt.getTime() <= now);
  const todayRs = roundRs(today.reduce((sum, e) => sum + e.amountRs, 0));
  const todayValidSwipes =
    today.filter((e) => e.note === "valid").reduce((sum, e) => sum + e.swipeCount, 0);
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
  };
}
