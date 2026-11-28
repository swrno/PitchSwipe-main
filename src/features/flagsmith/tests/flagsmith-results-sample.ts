/**
 * Sample payloads for the results parser tests: hand-built payloads, NOT recorded responses.
 *
 * They follow the real shape of GET /api/v1/environments/{env}/experiments/{id}/results/ in
 * Flagsmith/flagsmith main (SHA f6ecf07): experimentation/views.py `results` wraps
 * ExperimentResultsSerializer ({as_of, last_error_at, refresh_requested_at, payload, is_final}) in
 * {"results": ...}; `payload` is dataclasses.py ResultsSummary {srm_p_value, metrics: [MetricResult], exposures_timeseries};
 * MetricResult is {metric_id, variants: {key: VariantStats{n, sum, sum_squares}}, inference: {key: Inference | null},
 * conversions_timeseries}; Inference (stats.py) is {lift, ci_low, ci_high, chance_to_win}. Control's key is "control".
 *
 * srm_p_value is null in every sample, as the real server returns for experiments PitchSwipe creates (Flagsmith reads
 * the expected split from the environment default, which stays at 0% per option; see src/features/flagsmith/results.ts
 * "local SRM"). The SRM sample is broken by its counts alone, so the local check has to catch it.
 *
 * After a real run of scripts/flagsmith-lifecycle.mjs, add the recorded payload beside these.
 */

/** Metric ids the samples use (reward_claim is the primary metric). */
export const SAMPLE_METRIC_IDS = { reward_claim: 3, answer_positive: 4 } as const;

const NO_TIMESERIES = { granularity: "day", points: [] };

/** For an occurrence metric each identity is 0 or 1, so sum_squares equals sum. */
const stats = (n: number, conversions: number) => ({ n, sum: conversions, sum_squares: conversions });

/** Not computed yet (the endpoint's answer until the first refresh finishes). */
export const SAMPLE_RESULTS_PENDING = { results: null };

/** Headline deck mid-test: B leads at 91% (matches HEADLINE_FLAGSMITH_RESULTS), no SRM. */
export const SAMPLE_RESULTS_MIDTEST = {
  results: {
    as_of: "2026-11-15T13:10:00Z",
    last_error_at: null,
    refresh_requested_at: "2026-11-15T13:09:12Z",
    is_final: false,
    payload: {
      srm_p_value: null,
      metrics: [
        {
          metric_id: SAMPLE_METRIC_IDS.answer_positive,
          variants: { control: stats(72, 30), B: stats(71, 33), C: stats(71, 25) },
          inference: {
            control: null,
            B: { lift: 0.11, ci_low: -0.12, ci_high: 0.34, chance_to_win: 0.7 },
            C: { lift: -0.16, ci_low: -0.4, ci_high: 0.08, chance_to_win: 0.2 },
          },
          conversions_timeseries: NO_TIMESERIES,
        },
        {
          metric_id: SAMPLE_METRIC_IDS.reward_claim,
          variants: { control: stats(72, 9), B: stats(71, 14), C: stats(71, 7) },
          inference: {
            control: null,
            B: { lift: 0.61, ci_low: -0.04, ci_high: 1.4, chance_to_win: 0.91 },
            C: { lift: -0.2, ci_low: -0.7, ci_high: 0.3, chance_to_win: 0.23 },
          },
          conversions_timeseries: NO_TIMESERIES,
        },
      ],
      exposures_timeseries: NO_TIMESERIES,
    },
  },
};

/** Decided: B reaches 97.2%, 60+ identities on every card, no SRM. */
export const SAMPLE_RESULTS_DECIDED = {
  results: {
    as_of: "2026-11-16T09:00:00Z",
    last_error_at: null,
    refresh_requested_at: "2026-11-16T08:59:30Z",
    is_final: false,
    payload: {
      srm_p_value: null,
      metrics: [
        {
          metric_id: SAMPLE_METRIC_IDS.reward_claim,
          variants: { control: stats(64, 8), B: stats(66, 21), C: stats(61, 9) },
          inference: {
            control: null,
            B: { lift: 1.55, ci_low: 0.12, ci_high: 2.98, chance_to_win: 0.972 },
            C: { lift: 0.18, ci_low: -0.6, ci_high: 0.96, chance_to_win: 0.41 },
          },
          conversions_timeseries: NO_TIMESERIES,
        },
      ],
      exposures_timeseries: NO_TIMESERIES,
    },
  },
};

/**
 * Same chances, but a broken split: control got 150 identities against 66 and 61 on an equal three-way split
 * (chi-square ~54, p ~ 2e-12). Flagsmith still says srm_p_value: null; the local check must block the Result.
 */
export const SAMPLE_RESULTS_SRM = {
  results: {
    ...SAMPLE_RESULTS_DECIDED.results,
    payload: {
      ...SAMPLE_RESULTS_DECIDED.results.payload,
      metrics: [
        {
          ...SAMPLE_RESULTS_DECIDED.results.payload.metrics[0],
          variants: { control: stats(150, 19), B: stats(66, 21), C: stats(61, 9) },
        },
      ],
    },
  },
};

/** A real non-null srm_p_value (an environment whose default allocations match the split): it is honoured. */
export const SAMPLE_RESULTS_SRM_FROM_FLAGSMITH = {
  results: {
    ...SAMPLE_RESULTS_DECIDED.results,
    payload: { ...SAMPLE_RESULTS_DECIDED.results.payload, srm_p_value: 0.0002 },
  },
};

/** Too little data: Flagsmith reports no inference for B (null), which reads as chance 0, and n < 50. */
export const SAMPLE_RESULTS_SMALL = {
  results: {
    as_of: "2026-11-15T10:00:00Z",
    last_error_at: null,
    refresh_requested_at: null,
    is_final: false,
    payload: {
      srm_p_value: null,
      metrics: [
        {
          metric_id: SAMPLE_METRIC_IDS.reward_claim,
          variants: { control: stats(10, 1), B: stats(10, 4) },
          inference: { control: null, B: null },
          conversions_timeseries: NO_TIMESERIES,
        },
      ],
      exposures_timeseries: NO_TIMESERIES,
    },
  },
};
