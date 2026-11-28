/**
 * Segment views for Who swiped: applies the >= 10 swipers rule (smaller groups are
 * rolled into "Other") and ranks what is left. Pure. Segment views are Leads, never
 * Results: the winner is decided only on the full experiment (rules.ts / decision.ts).
 */
import { LIMITS } from "@/shared/lib/limits";

import type { GroupRow, Tally } from "./aggregate";
import { joinRate } from "./rules";
import type { SegmentRowView, SegmentView } from "./types";

export interface RolledUp {
  shown: GroupRow[];
  /** Groups under the minimum (and any pre-hidden group), merged. Null when none. */
  hidden: (Tally & { groupCount: number }) | null;
  /** Hidden numbers may be displayed only when the merged group itself has 10+ swipers. */
  hiddenVisible: boolean;
}

/** Groups under 10 swipers are rolled into "Other". */
export function rollUp(
  groups: readonly GroupRow[],
  minSize: number = LIMITS.groupMinSize,
  /**
   * Partitions only (state, source, target): when the rolled-up total is itself under the minimum,
   * the smallest shown group joins it, so subtracting from the overall number cannot reveal a hidden group.
   */
  complementary = true,
): RolledUp {
  const shown: GroupRow[] = [];
  let hidden: (Tally & { groupCount: number }) | null = null;
  for (const g of groups) {
    if (g.swipers === 0) continue;
    if (g.forceHidden || g.swipers < minSize) {
      hidden ??= { swipers: 0, saidYes: 0, joined: 0, groupCount: 0 };
      hidden.swipers += g.swipers;
      hidden.saidYes += g.saidYes;
      hidden.joined += g.joined;
      hidden.groupCount += 1;
    } else {
      shown.push(g);
    }
  }
  while (complementary && hidden && hidden.swipers < minSize && shown.length > 0) {
    shown.sort((a, b) => a.swipers - b.swipers);
    const g = shown.shift() as GroupRow;
    hidden.swipers += g.swipers;
    hidden.saidYes += g.saidYes;
    hidden.joined += g.joined;
    hidden.groupCount += 1;
  }
  return { shown, hidden, hiddenVisible: hidden !== null && hidden.swipers >= minSize };
}

/** Join rate high to low; ties go to the larger group, then the label. */
export function rankGroups<T extends Tally & { label: string }>(groups: readonly T[]): T[] {
  return [...groups].sort(
    (a, b) =>
      joinRate(b.joined, b.swipers) - joinRate(a.joined, a.swipers) ||
      b.swipers - a.swipers ||
      a.label.localeCompare(b.label),
  );
}

export const DEFAULT_AXIS_MAX = 0.35;

export function buildSegmentView(
  groups: readonly GroupRow[],
  overall: Tally,
  options: { overlapping?: boolean } = {},
): SegmentView {
  const { shown, hidden, hiddenVisible } = rollUp(groups, LIMITS.groupMinSize, !options.overlapping);
  const ranked = rankGroups(shown);
  const rows: SegmentRowView[] = ranked.map((g, i) => ({
    key: g.key,
    label: g.label,
    swipers: g.swipers,
    saidYes: g.saidYes,
    joined: g.joined,
    joinRate: joinRate(g.joined, g.swipers),
    best: i === 0,
  }));
  const maxRate = Math.max(0, ...rows.map((r) => r.joinRate), joinRate(overall.joined, overall.swipers));
  return {
    rows,
    other: hidden && hiddenVisible ? { ...hidden } : null,
    otherVisible: hiddenVisible,
    overall: { ...overall, rate: joinRate(overall.joined, overall.swipers) },
    shown: shown.reduce<Tally>(
      (t, g) => ({ swipers: t.swipers + g.swipers, saidYes: t.saidYes + g.saidYes, joined: t.joined + g.joined }),
      { swipers: 0, saidYes: 0, joined: 0 },
    ),
    // The Lead line counts the shown groups plus one for "Other" when something was rolled up.
    groupCount: rows.length + (hidden ? 1 : 0),
    axisMax: Math.max(DEFAULT_AXIS_MAX, Math.ceil(maxRate * 1.6 * 20) / 20),
    overlapping: options.overlapping ?? false,
  };
}
