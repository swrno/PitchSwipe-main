/**
 * Shapes computed stats into exactly what the demand-curve UI renders: the join-rate
 * line chart, the revenue bar chart, the numbers table, the headline and the lead
 * sentence. Every number shown is filled here by code (CLAUDE.md rule).
 */
import { LIMITS } from "@/shared/lib/limits";

import {
  armStats,
  chanceEarnsMost,
  classifyDemand,
  swipersToReachConfidence,
  type ArmStats,
  type DemandVerdict,
  type PriceArm,
} from "./compute";

export interface DemandCurveInput {
  arms: readonly PriceArm[];
  /** Sample ratio mismatch warning from Flagsmith. */
  srmWarning?: boolean;
  /** Shown after every price, e.g. "/ mo". */
  unitLabel?: string;
  draws?: number;
  seed?: number;
}

export interface DemandRow {
  key: string;
  priceLabel: string; // "Rs 199 / mo"
  priceShort: string; // "Rs 199"
  price: number;
  swipers: number;
  saidYes: number;
  joined: number;
  joinedPct: number; // 24
  joinedLowPct: number; // 18
  joinedHighPct: number; // 31
  joinedText: string; // "24% (18-31%)"
  revenue: number; // 4809
  revenueLow: number;
  revenueHigh: number;
  revenueText: string; // "Rs 4,809 (3,666-6,210)"
  chance: number; // 0 to 1, unrounded
  chancePct: number; // 88
  isBest: boolean;
  joinedOfText: string; // "29 of 120 joined"
}

export interface DemandCurveData {
  verdict: DemandVerdict;
  bestKey: string | null;
  headline: string; // "Rs 199 earns the most."
  /** "88% chance · not decided yet" for a Lead, "95% chance · Result" otherwise. */
  chanceBadge: string;
  /** Web stat tile, e.g. "Earns the most · 88% chance". */
  bestTileLabel: string;
  /** Short price for the web stat tile, e.g. "Rs 199". */
  bestTileValue: string;
  totals: {
    swipers: number;
    saidYes: number;
    saidYesPct: number;
    joined: number;
    joinedPct: number;
    perPriceSwipers: number | null; // 120 when every price has the same count
  };
  rows: DemandRow[];
  /** Line chart: x order is ascending price. Values are fractions 0 to 1. */
  lineChart: {
    yMax: number; // fraction, a multiple of 0.1
    ticks: number[];
    points: { key: string; label: string; rate: number; low: number; high: number; isBest: boolean; text: string }[];
  };
  /** Bar chart (value in Rs per 100 swipers). */
  barChart: {
    yMax: number;
    bars: { key: string; label: string; value: number; valueText: string; subLabel: string; isBest: boolean }[];
  };
  /** Extra swipers per price (rounded to 10) to reach 95%; null when a Result or out of reach. */
  moreSwipersPerPrice: number | null;
  /** Lead explainer (code-filled). Null for a Result. */
  leadText: string | null;
  srmWarning: boolean;
}

/** Round half to even, so exact halves (2392.5, 1662.5) match the spec table. */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  if (Math.abs(x - f - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export function formatNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatRs(n: number): string {
  return `Rs ${formatNumber(n)}`;
}

const pct = (x: number) => Math.round(x * 100);

function ratioWord(r: number): string {
  if (Math.abs(r - 2) < 0.15) return "about twice as much";
  return `about ${Math.round(r * 10) / 10}x as much`;
}

function buildLeadText(stats: ArmStats[], best: ArmStats, more: number | null): string {
  const parts: string[] = [];
  const tie = stats
    // A tie at 0% is not a tie worth a revenue ratio: 0 sign-ups earn Rs 0 at any price.
    .filter((s) => best.joinRate > 0 && s.price < best.price && pct(s.joinRate) === pct(best.joinRate))
    .sort((a, b) => b.price - a.price)[0];
  if (tie) {
    parts.push(`${formatRs(tie.price)} gets no more sign-ups than ${formatRs(best.price)}.`);
    parts.push(`Both ${pct(best.joinRate)}%, so ${formatRs(best.price)} earns ${ratioWord(best.price / tie.price)}.`);
  } else {
    parts.push(`${formatRs(best.price)} leads on revenue, but it is not decided yet.`);
  }
  const next = stats.filter((s) => s.price > best.price).sort((a, b) => a.price - b.price)[0];
  if (next && best.joinRate > 0 && next.joinRate <= best.joinRate * 0.55) {
    parts.push(`Above ${formatRs(best.price)}, sign-ups halve.`);
  }
  if (more !== null && more > 0) {
    parts.push(`About ${more} more swipers per price to reach ${pct(LIMITS.winnerConfidence)}%.`);
  }
  return parts.join(" ");
}

export function shapeDemandCurve(input: DemandCurveInput): DemandCurveData {
  const unit = input.unitLabel ?? "/ mo";
  const arms = [...input.arms].sort((a, b) => a.price - b.price);
  const srm = input.srmWarning ?? false;
  const stats = arms.map(armStats);
  const chances = chanceEarnsMost(arms, { draws: input.draws, seed: input.seed });
  const classified = classifyDemand(arms, chances, srm);
  const { verdict } = classified;
  // With no sign-ups at any price every price earns Rs 0: none of them "earns the most", so no best is named.
  const noJoins = stats.length > 0 && stats.every((s) => s.joined === 0);
  const bestIndex = noJoins ? -1 : classified.bestIndex;
  const best = bestIndex >= 0 ? stats[bestIndex] : null;

  const rows: DemandRow[] = stats.map((s, i) => {
    const joinedPct = pct(s.joinRate);
    const lo = pct(s.joinRateLow);
    const hi = pct(s.joinRateHigh);
    const rev = roundHalfEven(s.revenuePer100);
    const rl = roundHalfEven(s.revenueLow);
    const rh = roundHalfEven(s.revenueHigh);
    return {
      key: s.key,
      priceLabel: `${formatRs(s.price)} ${unit}`.trim(),
      priceShort: formatRs(s.price),
      price: s.price,
      swipers: s.swipers,
      saidYes: s.saidYes,
      joined: s.joined,
      joinedPct,
      joinedLowPct: lo,
      joinedHighPct: hi,
      joinedText: `${joinedPct}% (${lo}–${hi}%)`,
      revenue: rev,
      revenueLow: rl,
      revenueHigh: rh,
      revenueText: `${formatRs(rev)} (${formatNumber(rl)}–${formatNumber(rh)})`,
      chance: chances[i],
      chancePct: pct(chances[i]),
      isBest: i === bestIndex,
      joinedOfText: `${s.joined} of ${s.swipers} joined`,
    };
  });

  const swipers = stats.reduce((n, s) => n + s.swipers, 0);
  const saidYes = stats.reduce((n, s) => n + s.saidYes, 0);
  const joined = stats.reduce((n, s) => n + s.joined, 0);
  const same = stats.length > 0 && stats.every((s) => s.swipers === stats[0].swipers);

  const maxRate = Math.max(0, ...stats.map((s) => s.joinRate));
  const yMax = Math.max(0.1, Math.ceil(maxRate * 10 - 1e-9) / 10);
  const ticks: number[] = [];
  for (let t = 0; t <= Math.round(yMax * 10); t++) ticks.push(t / 10);
  const maxRevenue = Math.max(0, ...stats.map((s) => s.revenuePer100));

  const more = verdict === "lead" && best ? swipersToReachConfidence(arms, { seed: input.seed }) : null;
  const bestChance = best ? chances[bestIndex] : 0;

  return {
    verdict,
    bestKey: best ? best.key : null,
    headline: best ? `${formatRs(best.price)} earns the most.` : "Not enough data yet.",
    chanceBadge: noJoins
      ? "No sign-ups yet · not decided yet"
      : verdict === "result"
        ? `${pct(bestChance)}% chance · Result`
        : `${pct(bestChance)}% chance · not decided yet`,
    bestTileLabel: noJoins ? "Earns the most · no sign-ups yet" : `Earns the most · ${pct(bestChance)}% chance`,
    bestTileValue: best ? formatRs(best.price) : "–",
    totals: {
      swipers,
      saidYes,
      saidYesPct: swipers === 0 ? 0 : pct(saidYes / swipers),
      joined,
      joinedPct: swipers === 0 ? 0 : pct(joined / swipers),
      perPriceSwipers: same ? stats[0].swipers : null,
    },
    rows,
    lineChart: {
      yMax,
      ticks,
      points: rows.map((r, i) => ({
        key: r.key,
        label: r.priceShort,
        rate: stats[i].joinRate,
        low: stats[i].joinRateLow,
        high: stats[i].joinRateHigh,
        isBest: r.isBest,
        text: `${r.joinedPct}%`,
      })),
    },
    barChart: {
      yMax: maxRevenue,
      bars: rows.map((r, i) => ({
        key: r.key,
        label: r.priceShort,
        value: stats[i].revenuePer100,
        valueText: formatRs(r.revenue),
        subLabel: r.joinedOfText,
        isBest: r.isBest,
      })),
    },
    moreSwipersPerPrice: more && more > 0 ? more : null,
    leadText:
      verdict !== "lead"
        ? null
        : noJoins
          ? "No sign-ups at any price yet. Until someone joins, no price earns more than another."
          : best
            ? buildLeadText(stats, best, more)
            : null,
    srmWarning: srm,
  };
}
