/**
 * Price demand curve maths (spec/02 section 5.13). Pure functions, no I/O.
 *
 * - Join rate per price: joined / swipers, with a 90% credible range from the
 *   Beta(1 + joined, 1 + swipers - joined) posterior (uniform prior).
 * - Revenue per 100 swipers = price x join rate x 100 (range = price x rate range).
 * - Chance each price earns the most: Monte Carlo over the posteriors.
 */
import { LIMITS } from "@/fixtures";
import { isResult } from "@/lib/results/rules";

import { betaQuantile, createRng, sampleBeta, type Rng } from "./beta";

export const DEFAULT_DRAWS = 200_000;
export const DEFAULT_SEED = 20261115;
export const CREDIBLE_LEVEL = 0.9;

export interface PriceArm {
  /** Stable id, e.g. the card id or Flagsmith variant key. */
  key: string;
  /** Price in rupees per period (all arms must share one unit). */
  price: number;
  swipers: number;
  saidYes: number;
  joined: number;
}

export interface ArmStats {
  key: string;
  price: number;
  swipers: number;
  saidYes: number;
  joined: number;
  /** joined / swipers, 0 to 1 (point estimate, 0 when no swipers). */
  joinRate: number;
  /** 90% credible range of the join rate. */
  joinRateLow: number;
  joinRateHigh: number;
  /** Rs per 100 swipers per month, if every sign-up pays. */
  revenuePer100: number;
  revenueLow: number;
  revenueHigh: number;
}

export function armStats(arm: PriceArm): ArmStats {
  const a = 1 + arm.joined;
  const b = 1 + Math.max(0, arm.swipers - arm.joined);
  const tail = (1 - CREDIBLE_LEVEL) / 2;
  const low = betaQuantile(tail, a, b);
  const high = betaQuantile(1 - tail, a, b);
  const joinRate = arm.swipers === 0 ? 0 : arm.joined / arm.swipers;
  return {
    key: arm.key,
    price: arm.price,
    swipers: arm.swipers,
    saidYes: arm.saidYes,
    joined: arm.joined,
    joinRate,
    joinRateLow: low,
    joinRateHigh: high,
    // Multiply before dividing so exact halves (e.g. 2392.5) stay exact.
    revenuePer100: arm.swipers === 0 ? 0 : (arm.price * arm.joined * 100) / arm.swipers,
    revenueLow: arm.price * low * 100,
    revenueHigh: arm.price * high * 100,
  };
}

/** Chance (0 to 1) each arm has the highest revenue; sums to 1. Deterministic for a given seed. */
export function chanceEarnsMost(
  arms: readonly PriceArm[],
  options: { draws?: number; seed?: number; rng?: Rng } = {},
): number[] {
  const draws = options.draws ?? DEFAULT_DRAWS;
  const rng = options.rng ?? createRng(options.seed ?? DEFAULT_SEED);
  const wins = new Array<number>(arms.length).fill(0);
  if (arms.length === 0) return [];
  const alphas = arms.map((x) => 1 + x.joined);
  const betas = arms.map((x) => 1 + Math.max(0, x.swipers - x.joined));
  for (let d = 0; d < draws; d++) {
    let best = -1;
    let bestRevenue = -Infinity;
    for (let i = 0; i < arms.length; i++) {
      const revenue = arms[i].price * sampleBeta(alphas[i], betas[i], rng);
      if (revenue > bestRevenue) {
        bestRevenue = revenue;
        best = i;
      }
    }
    wins[best]++;
  }
  return wins.map((w) => w / draws);
}

/**
 * Smallest extra swipers per price (rounded up to a multiple of `step`) at which the
 * leading price would reach the confidence threshold, assuming today's join rates hold.
 * Returns 0 if already there and null if it is out of reach within `maxExtra`.
 */
export function swipersToReachConfidence(
  arms: readonly PriceArm[],
  options: { threshold?: number; step?: number; maxExtra?: number; draws?: number; seed?: number } = {},
): number | null {
  const threshold = options.threshold ?? LIMITS.winnerConfidence;
  const step = options.step ?? 10;
  const maxExtra = options.maxExtra ?? 2000;
  const draws = options.draws ?? 40_000;
  const seed = options.seed ?? DEFAULT_SEED;
  const base = chanceEarnsMost(arms, { draws, seed });
  const lead = base.indexOf(Math.max(...base));
  if (lead < 0) return null;
  if (base[lead] >= threshold) return 0;
  for (let extra = step; extra <= maxExtra; extra += step) {
    const scaled = arms.map((x) => {
      const f = x.swipers === 0 ? 1 : (x.swipers + extra) / x.swipers;
      return { ...x, swipers: x.swipers + extra, joined: Math.round(x.joined * f), saidYes: Math.round(x.saidYes * f) };
    });
    const c = chanceEarnsMost(scaled, { draws, seed });
    if (c[lead] >= threshold) return extra;
  }
  return null;
}

export type DemandVerdict = "result" | "lead";

/**
 * Result needs >= 95% chance, >= 50 identities on every price and no SRM warning
 * (the shared rule from src/lib/results/rules). Anything else is a Lead.
 */
export function classifyDemand(
  arms: readonly PriceArm[],
  chances: readonly number[],
  srmWarning: boolean,
): { verdict: DemandVerdict; bestIndex: number } {
  let bestIndex = 0;
  for (let i = 1; i < chances.length; i++) if (chances[i] > chances[bestIndex]) bestIndex = i;
  if (arms.length === 0) return { verdict: "lead", bestIndex: -1 };
  const allEnough = arms.every((x) => x.swipers >= LIMITS.minIdentitiesPerCard);
  const best = arms[bestIndex];
  const ok =
    allEnough &&
    isResult(
      { cardId: best.key, variantKey: best.key, identities: best.swipers, chanceToBeatControl: chances[bestIndex] },
      srmWarning,
    );
  return { verdict: ok ? "result" : "lead", bestIndex };
}
