/** Pure helpers for variant weights. Flagsmith stores weights on the non-control options; control is the remainder. */
import { FlagsmithInvalidInput } from "./errors";

/**
 * One row of `multivariate_feature_state_values`. `id` is the row id of an existing feature state's value:
 * the PUT on featurestates is a writable-nested update, so rows sent without their id are created anew
 * (MultivariateFeatureStateValueSerializer fields: id, multivariate_feature_option, percentage_allocation).
 */
export interface MultivariateStateValue {
  id?: number;
  multivariate_feature_option: number;
  percentage_allocation: number;
}

const EPSILON = 0.01;

/** Equal split over all variants; control (first key) takes the rounding remainder. */
export function equalWeights(variantKeys: string[]): Record<string, number> {
  const share = Math.floor((100 / variantKeys.length) * 100) / 100;
  const weights: Record<string, number> = {};
  let used = 0;
  for (const key of variantKeys.slice(1)) {
    weights[key] = share;
    used += share;
  }
  weights[variantKeys[0]] = Math.round((100 - used) * 100) / 100;
  return weights;
}

/** 100 for the winner, 0 for every other variant (control included). */
export function winnerTakesAll(variantKeys: string[], winnerKey: string): Record<string, number> {
  if (!variantKeys.includes(winnerKey)) {
    throw new FlagsmithInvalidInput(`Winner "${winnerKey}" is not one of: ${variantKeys.join(", ")}`);
  }
  return Object.fromEntries(variantKeys.map((key) => [key, key === winnerKey ? 100 : 0]));
}

/**
 * Turn per-variant weights into Flagsmith's multivariate_feature_state_values.
 * Every non-control option is listed, even at 0 (Flagsmith needs the full list).
 * Weights must cover every variant (control included) and sum to 100.
 * `rowIdsByOption` (option id -> existing row id) is added as `id` so a PUT updates rows in place.
 */
export function toStateValues(
  optionIdsByKey: Record<string, number>,
  controlKey: string,
  weights: Record<string, number>,
  rowIdsByOption: Record<number, number> = {},
): MultivariateStateValue[] {
  const keys = [controlKey, ...Object.keys(optionIdsByKey)];
  for (const key of Object.keys(weights)) {
    if (!keys.includes(key)) throw new FlagsmithInvalidInput(`Unknown variant "${key}"`);
  }
  for (const key of keys) {
    const w = weights[key];
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0 || w > 100) {
      throw new FlagsmithInvalidInput(`Weight for "${key}" must be a number from 0 to 100`);
    }
  }
  const total = keys.reduce((sum, key) => sum + weights[key], 0);
  if (Math.abs(total - 100) > EPSILON) {
    throw new FlagsmithInvalidInput(`Weights must sum to 100, got ${total}`);
  }
  return Object.entries(optionIdsByKey).map(([key, id]) => ({
    ...(rowIdsByOption[id] !== undefined ? { id: rowIdsByOption[id] } : {}),
    multivariate_feature_option: id,
    percentage_allocation: weights[key],
  }));
}
