/**
 * Experiment results: a typed interface plus a parser for Flagsmith's real results payload.
 *
 * Shape (Flagsmith/flagsmith api, SHA f6ecf07: experimentation/views.py `results`, serializers.py
 * ExperimentResultsSerializer, dataclasses.py ResultsSummary / MetricResult, stats.py VariantStats / Inference):
 *
 *   GET .../experiments/{id}/results/ ->
 *     { "results": null }                                   until computed, otherwise
 *     { "results": { as_of, last_error_at, refresh_requested_at, is_final,
 *                    payload: { srm_p_value: float | null,
 *                               metrics: [ { metric_id: int,
 *                                            variants:  { "<key>": { n, sum, sum_squares } },
 *                                            inference: { "<key>": { lift, ci_low, ci_high, chance_to_win } | null },
 *                                            conversions_timeseries } ],
 *                               exposures_timeseries } } }
 *
 * Variant keys are the multivariate option keys, plus the literal "control" (features/constants.py
 * CONTROL_VARIANT_KEY). `chance_to_win` is 0-1 that the variant beats control; `lift` is a fraction (0.12 = +12%);
 * an SRM p-value below 0.001 means the split is broken (stats.py). Flagsmith decides; nothing here invents a number.
 * For our experiments Flagsmith's srm_p_value is always null (see "local SRM" below), so the same test runs here.
 */
import type { FlagsmithExperimentResults } from "@/types";

/** Flagsmith's literal key for the control arm (the flag's own value). */
export const CONTROL_VARIANT_KEY = "control";
/** stats.py: a sample-ratio-mismatch p-value below this means the split is broken. */
export const SRM_P_THRESHOLD = 0.001;
/** The local SRM check only runs from this many exposed identities (chi-square is unreliable on tiny counts). */
export const SRM_MIN_TOTAL = 100;

/* ------------------------------ local SRM ------------------------------ */
/*
 * Why a local check: at SHA f6ecf07 Flagsmith builds the expected split for srm_p_value from the ENVIRONMENT
 * DEFAULT feature state (experimentation/services.py `_expected_variant_shares`, with a TODO to read the rollout
 * override), and stats.py `srm_p_value` returns None when any expected share is <= 0. Our experiments keep every
 * option's default allocation at 0 (the split lives in the rollout override), so Flagsmith's srm_p_value is
 * always null for them. We therefore run the same chi-square test (a port of stats.py `srm_p_value` /
 * `_chi_squared_survival`) against the split we configured. It can only BLOCK a winner call, never make one.
 */

/** Lanczos approximation of ln(Gamma(x)), x > 0 (g = 7, n = 9; ~15 significant digits). */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Complementary error function (Numerical Recipes erfcc, fractional error < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
          t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** P(X >= statistic) for a chi-square with `df` degrees of freedom (stats.py `_chi_squared_survival`). */
export function chiSquaredSurvival(statistic: number, df: number): number {
  if (statistic <= 0) return 1;
  const y = statistic / 2;
  let total: number;
  let k: number;
  if (df % 2 === 1) {
    total = erfc(Math.sqrt(y));
    k = 0.5;
  } else {
    total = 0;
    k = 0;
  }
  // Adds e^-y * y^k / Gamma(k + 1) for k = (odd: 1/2, 3/2, ...; even: 0, 1, ...) up to df/2 - 1.
  for (; k < df / 2 - 1e-9; k += 1) total += Math.exp(-y + k * Math.log(y) - lnGamma(k + 1));
  return Math.min(1, Math.max(0, total));
}

/**
 * Sample-ratio-mismatch p-value (port of stats.py `srm_p_value`): chi-square of observed exposures against the
 * expected shares, df = k - 1. Null with fewer than 2 variants, no traffic, or a share <= 0 (as upstream).
 * A variant missing from `observed` counts as 0 exposures (the most broken split of all).
 */
export function srmPValue(observed: Record<string, number>, expectedShares: Record<string, number>): number | null {
  const keys = Object.keys(expectedShares);
  if (keys.length < 2) return null;
  const shareTotal = keys.reduce((s, k) => s + expectedShares[k], 0);
  if (keys.some((k) => !(expectedShares[k] > 0)) || !(shareTotal > 0)) return null;
  const total = keys.reduce((s, k) => s + (observed[k] ?? 0), 0);
  if (total <= 0) return null;
  let statistic = 0;
  for (const k of keys) {
    const expected = (total * expectedShares[k]) / shareTotal;
    statistic += ((observed[k] ?? 0) - expected) ** 2 / expected;
  }
  return chiSquaredSurvival(statistic, keys.length - 1);
}

export interface ExperimentVariantResult {
  /** Flagsmith's key: "control" or the option key (= the card's variant key). */
  key: string;
  isControl: boolean;
  /** Exposed identities (`variants[key].n`). */
  identities: number;
  /** For an occurrence metric, identities that converted (`variants[key].sum`). */
  conversions: number | null;
  /** Chance this variant beats control, 0 to 1 (`inference[key].chance_to_win`). Null for control or when not computed. */
  chanceToBeatControl: number | null;
  /** Relative lift vs control as a fraction (0.12 = +12%). */
  lift: number | null;
  /** 95% credible interval of the lift, [ci_low, ci_high]. */
  credibleInterval: [number, number] | null;
}

export interface ExperimentResults {
  experimentId: string;
  /** "final" once Flagsmith marks the results final (completed experiment), else null. */
  status: string | null;
  /** Flagsmith's srm_p_value < 0.001, or (when Flagsmith reports none) the local check < 0.001. */
  srmWarning: boolean;
  srmPValue: number | null;
  /** Where srmPValue came from: Flagsmith's payload, the local chi-square, or nowhere (too little data). */
  srmSource: "flagsmith" | "local" | null;
  /** The metric the variants were read from. */
  metricId: string | null;
  variants: ExperimentVariantResult[];
  /** `as_of`: when Flagsmith computed the numbers. */
  computedAt: Date | null;
  /** The untouched payload, kept so the lifecycle script can record it. */
  raw: unknown;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Accepts the endpoint body ({results}), the results object ({as_of, payload}) or the bare ResultsSummary. */
function unwrap(payload: unknown): { meta: Obj; summary: Obj } | null {
  if (!isObj(payload)) return null;
  let meta: unknown = payload;
  if ("results" in payload) meta = payload.results;
  if (!isObj(meta)) return null;
  const summary = "payload" in meta ? meta.payload : meta;
  if (!isObj(summary) || !Array.isArray(summary.metrics)) return null;
  return { meta, summary };
}

function pickMetric(metrics: Obj[], metricId: string | undefined): Obj | undefined {
  if (metricId !== undefined) return metrics.find((m) => String(m.metric_id) === String(metricId));
  // No id known: the reward metric is created first on the experiment, so it is first in the payload.
  return metrics[0];
}

function orderKeys(keys: string[]): string[] {
  const others = keys.filter((k) => k !== CONTROL_VARIANT_KEY).sort();
  return keys.includes(CONTROL_VARIANT_KEY) ? [CONTROL_VARIANT_KEY, ...others] : others;
}

/**
 * Parse a results payload. Returns null when Flagsmith has not computed results yet (`{"results": null}`),
 * when the metric is missing from the payload, or when it has no variants.
 * @param options.metricId the reward_claim metric id (`metric_id` in the payload); stored on the deck at publish.
 * @param options.expectedShares the configured split per Flagsmith key ("control" + option keys), used by the
 *   local SRM check. Default: an equal split over the keys present in the payload (misses a variant with no
 *   exposures at all, so callers that know the cards should pass it; admin.getExperimentResults does).
 */
export function parseExperimentResults(
  experimentId: string,
  payload: unknown,
  options: { metricId?: string; expectedShares?: Record<string, number> } = {},
): ExperimentResults | null {
  const unwrapped = unwrap(payload);
  if (!unwrapped) return null;
  const { meta, summary } = unwrapped;
  const metric = pickMetric((summary.metrics as unknown[]).filter(isObj), options.metricId);
  if (!metric || !isObj(metric.variants)) return null;

  const stats = metric.variants;
  const inference = isObj(metric.inference) ? metric.inference : {};
  const variants: ExperimentVariantResult[] = [];
  for (const key of orderKeys(Object.keys(stats))) {
    const s = stats[key];
    const n = isObj(s) ? num(s.n) : null;
    if (n === null) continue;
    const inf = inference[key];
    const lo = isObj(inf) ? num(inf.ci_low) : null;
    const hi = isObj(inf) ? num(inf.ci_high) : null;
    const chance = isObj(inf) ? num(inf.chance_to_win) : null;
    variants.push({
      key,
      isControl: key === CONTROL_VARIANT_KEY,
      identities: n,
      conversions: isObj(s) ? num(s.sum) : null,
      chanceToBeatControl: chance !== null && chance >= 0 && chance <= 1 ? chance : null,
      lift: isObj(inf) ? num(inf.lift) : null,
      credibleInterval: lo !== null && hi !== null ? [lo, hi] : null,
    });
  }
  if (variants.length === 0) return null;

  // Flagsmith's own value when it has one; otherwise the local check against the split we configured.
  const flagsmithP = num(summary.srm_p_value);
  const observed = Object.fromEntries(variants.map((v) => [v.key, v.identities]));
  const shares = options.expectedShares ?? Object.fromEntries(variants.map((v) => [v.key, 1]));
  const observedTotal = Object.keys(shares).reduce((s, k) => s + (observed[k] ?? 0), 0);
  const localP = observedTotal >= SRM_MIN_TOTAL ? srmPValue(observed, shares) : null;
  const srm = flagsmithP ?? localP;
  return {
    experimentId,
    status: meta.is_final === true ? "final" : null,
    srmWarning: (flagsmithP !== null && flagsmithP < SRM_P_THRESHOLD) || (localP !== null && localP < SRM_P_THRESHOLD),
    srmPValue: srm,
    srmSource: flagsmithP !== null ? "flagsmith" : localP !== null ? "local" : null,
    metricId: metric.metric_id !== undefined ? String(metric.metric_id) : null,
    variants,
    computedAt: date(meta.as_of),
    raw: payload,
  };
}

/** The control card's variant key: the given one, else the first card key in sort order (cards[0] everywhere). */
export function controlKeyOf(cardIds: Record<string, string>, controlKey?: string): string {
  return controlKey ?? Object.keys(cardIds).sort()[0] ?? CONTROL_VARIANT_KEY;
}

/**
 * The split we configured, in Flagsmith's keys: the control card becomes "control", every other card keeps its
 * key. Publish always uses an equal split (admin.ts createDeckExperiment, weights.ts equalWeights).
 */
export function expectedSharesFor(cardIds: Record<string, string>, controlKey?: string): Record<string, number> {
  const control = controlKeyOf(cardIds, controlKey);
  return Object.fromEntries(Object.keys(cardIds).map((k) => [k === control ? CONTROL_VARIANT_KEY : k, 1]));
}

/**
 * Adapt parsed results to the app-wide FlagsmithExperimentResults type.
 * Flagsmith's "control" becomes the deck's control card key (variantKey AND cardId), so decideDeck's
 * `variantKey !== controlKey` check works. Control reports chance 0 (it cannot beat itself); a missing
 * inference (too little data) also reports 0.
 */
export function toFlagsmithResults(
  parsed: ExperimentResults,
  context: { flagName: string; cardIds: Record<string, string>; controlKey?: string; refreshedAt?: Date },
): FlagsmithExperimentResults {
  const control = controlKeyOf(context.cardIds, context.controlKey);
  const cards = parsed.variants.map((v) => {
    const key = v.isControl ? control : v.key;
    return {
      cardId: context.cardIds[key] ?? key,
      variantKey: key,
      identities: v.identities,
      chanceToBeatControl: v.isControl ? 0 : (v.chanceToBeatControl ?? 0),
    };
  });
  // A card Flagsmith reports nothing for (no exposures yet) is still a card: 0 identities, chance 0. Otherwise the
  // ">= 50 identities on every card" rule would only look at the cards that happen to be in the payload.
  for (const key of Object.keys(context.cardIds).sort()) {
    if (!cards.some((c) => c.variantKey === key)) {
      cards.push({ cardId: context.cardIds[key], variantKey: key, identities: 0, chanceToBeatControl: 0 });
    }
  }
  return {
    experimentId: parsed.experimentId,
    flagName: context.flagName,
    cards,
    srmWarning: parsed.srmWarning,
    refreshedAt: parsed.computedAt ?? context.refreshedAt ?? new Date(),
  };
}
